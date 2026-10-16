/* KasirQuh — Store Module: Auth
 * FASE 10 refactor store.js (2026-10-16)
 * Berisi: beginSession, endSession, whenSessionReady, setGuestSession, handleAuthState,
 *   authErrorMessage, registerCustomer, loginCustomer, loginAdmin, logout
 * CATATAN: fungsi dipindah apa adanya, tidak di-refactor. SANGAT BERISIKO - baru diperbaiki 4x.
 */
const StoreAuth = {

  beginSession() {
    this._sessionSeq += 1;
    const seq = this._sessionSeq;
    this._sessionPromise = new Promise(resolve => { this._sessionResolve = resolve; });
    this._sessionToken = seq;
  },

  endSession() {
    if (this._sessionResolve && this._sessionToken === this._sessionSeq) {
      const resolve = this._sessionResolve;
      this._sessionResolve = null;
      resolve();
    }
  },

  whenSessionReady() {
    return this._sessionPromise || Promise.resolve();
  },

  setGuestSession() {
    S.isGuest = true;
    S.sessionRole = null;
    S.sessionName = null;
    S.sessionStartedAt = null;
    S.activeCustomerId = null;
    S.activeOrder = null;
    S.pendingGuestAction = null;
    S.myCustomerDoc = null;
    S.coinBalance = 0;
    S.coinHistory = [];
    S.onlineOrders = [];
    S.customerNotesList = [];
    S.customerData = [];
    S.pendingCustomers = [];
    S.journalEntries = [];
    S.purchaseNotes = {};
    S.directThreads = {};
    S.adminCustomerNotes = [];
    S.inboxItems = [];
    S.dailyCheckedIn = false;
    S.dailyCheckinPending = false;
  },

  async handleAuthState(user) {
    // Catat status SEBELUM reset: bila sesi pulih setelah timer gateway
    // kadung memasukkan aplikasi ke mode tamu (balapan timer), layar
    // harus dikembalikan ke layar peran yang benar.
    const sessionWasGuest = S.isGuest;
    this.beginSession();
    try {
      this.clearRoleSubs();
      this.setGuestSession();

      if (!user) {
        this.render('session', 'profile', 'orders', 'coins', 'customerNotes', 'customers',
          'journal', 'stockNotes', 'chat', 'inbox');
        return;
      }

      const uid = user.uid;

      /* Admin: custom claim admin:true (TIDAK ADA pendaftaran admin mandiri) */
      let isAdmin = false;
      try {
        const token = await user.getIdTokenResult();
        isAdmin = !!(token && token.claims && token.claims.admin === true);
      } catch (e) {
        // Gagal transient (jaringan belum siap saat tab baru dibuka):
        // coba sekali lagi sebelum menyerah. Kegagalan di sini tidak
        // boleh menghancurkan sesi (lihat bawah: tanpa signOut).
        try {
          await new Promise(resolve => setTimeout(resolve, 1500));
          const retryToken = await user.getIdTokenResult();
          isAdmin = !!(retryToken && retryToken.claims && retryToken.claims.admin === true);
        } catch (e2) { isAdmin = false; }
      }

      if (isAdmin) {
        // [2026-10-16] Cegah admin salah pintu: jika login via pintu pelanggan,
        // jangan bentuk sesi admin — signOut agar loginCustomer menolak tegas.
        if (S._loginDoor === 'customer') {
          S._loginDoor = null;
          try { await FB.auth.signOut(); } catch (e) {}
          this.render('session', 'profile');
          return;
        }
        S.isGuest = false;
        S.sessionRole = 'admin';
        S.sessionName = 'Admin Warunge Mimi';
        S.sessionStartedAt = new Date().toISOString();
        S.activeCustomerId = null;
        this.startAdminSubs();
        this.render('session', 'profile');
        // Sesi pulih/login: yang sudah login langsung lewati gateway
        // (keputusan terkunci) + pastikan timer gateway mati.
        // Juga kembalikan layar bila sesi pulih setelah aplikasi kadung
        // masuk mode tamu (balapan timer di tab baru).
        const gatewayUI=window.KasirQuhUI||{};
        if (typeof gatewayUI.stopGatewayTimer==='function')gatewayUI.stopGatewayTimer();
        if (typeof gatewayUI.go==='function') {
          const gw = document.getElementById('gateway');
          if ((gw && gw.classList.contains('active')) || sessionWasGuest) gatewayUI.go('admin');
        }
        return;
      }

      /* Pelanggan: dokumen customers/{uid} wajib approved */
      let snap = null;
      try {
        snap = await FB.db.collection('customers').doc(uid).get();
      } catch (e) { snap = null; }
      const data = snap && snap.exists ? snap.data() : null;
      if (!data || data.approvalStatus !== 'approved') {
        // JALUR RESTORE: jangan hancurkan sesi Firebase di sini — cukup
        // tampilkan mode tamu. signOut hanya untuk penolakan login
        // eksplisit (sudah diurus form login masing-masing).
        this.render('session', 'profile');
        return;
      }

      S.isGuest = false;
      S.sessionRole = 'customer';
      S.activeCustomerId = uid;
      S.sessionName = data.name || 'Pelanggan';
      S.sessionStartedAt = new Date().toISOString();
      S.myCustomerDoc = Object.assign({ id: uid }, data);
      if (Array.isArray(data.priceAlerts)) S.priceAlerts = data.priceAlerts;
      if (Array.isArray(data.routines)) S.routines = data.routines;
      S.coinBalance = Math.max(0, Math.round(Number(data.coins) || 0));
      this.startCustomerSubs(uid);
      this.render('session', 'profile');
      // Sesi pulih: yang sudah login langsung lewati gateway (keputusan terkunci).
      // Juga kembalikan layar bila sesi pulih setelah aplikasi kadung
      // masuk mode tamu (balapan timer di tab baru).
      const gatewayUI=window.KasirQuhUI||{};
      if (typeof gatewayUI.stopGatewayTimer==='function')gatewayUI.stopGatewayTimer();
      if (typeof gatewayUI.go==='function') {
        const gw = document.getElementById('gateway');
        if ((gw && gw.classList.contains('active')) || sessionWasGuest) gatewayUI.go('customer');
      }
    } finally {
      this.endSession();
    }
  },

  authErrorMessage(error) {
    const code = (error && error.code) || '';
    if (code === 'auth/email-already-in-use') return 'Email sudah dipakai';
    if (code === 'auth/invalid-email') return 'Format email belum benar';
    if (code === 'auth/weak-password') return 'Kata sandi minimal 6 karakter';
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') return 'Email atau kata sandi salah';
    if (code === 'auth/user-not-found') return 'Belum terdaftar, silakan daftar dulu';
    if (code === 'auth/too-many-requests') return 'Terlalu banyak percobaan, coba lagi nanti';
    if (code === 'auth/network-request-failed' || code === 'OFFLINE') return 'Butuh koneksi internet';
    if (code === 'permission-denied') return 'Akses ditolak — hubungi admin warung';
    return (error && error.message) || 'Terjadi kesalahan, coba lagi';
  },

  /* Daftar pelanggan: Auth + customers/{uid} {approvalStatus:'pending'}.
   * Setelah daftar langsung signOut → kembali mode tamu dengan pesan
   * "menunggu persetujuan" (1:1 alur yang dikunci). */
  async registerCustomer({ name, email, password, wa }) {
    if (!this.needOnline()) throw __offlineError();
    let cred;
    try {
      cred = await __withTimeout(FB.auth.createUserWithEmailAndPassword(email, password), WRITE_TIMEOUT_MS, 'Pendaftaran');
    } catch (error) {
      throw new Error(this.authErrorMessage(error));
    }
    const uid = cred.user.uid;
    try {
      await __withTimeout(FB.db.collection('customers').doc(uid).set({
        name: name,
        email: email,
        wa: wa || '',
        approvalStatus: 'pending',
        coins: 0,
        createdAt: FB.serverTimestamp(),
      }), WRITE_TIMEOUT_MS, 'Pendaftaran');
    } catch (error) {
      try { await cred.user.delete(); } catch (e) {}
      throw new Error(this.authErrorMessage(error));
    }
    try { await FB.auth.signOut(); } catch (e) {}
  },

  /* Masuk pelanggan: approved → sesi penuh; pending/rejected → pesan jujur */
  async loginCustomer(email, password) {
    if (!this.needOnline()) throw __offlineError();
    let cred;
    // [2026-10-16] Tandai pintu login agar handleAuthState bisa cegah admin salah pintu.
    S._loginDoor = 'customer';
    try {
      cred = await FB.auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
      S._loginDoor = null;
      throw new Error(this.authErrorMessage(error));
    }
    const uid = cred.user.uid;
    const reject = async msg => { S._loginDoor = null; try { await FB.auth.signOut(); } catch (e) {} throw new Error(msg); };
    // Tunggu agar handleAuthState sempat jalan (cegah admin salah pintu).
    // 2500ms > retry 1500ms di handleAuthState (tutup lubang race saat jaringan blip).
    await new Promise(r => setTimeout(r, 2500));
    S._loginDoor = null;
    if (!FB.auth.currentUser) {
      throw new Error('Ini akun admin — masuk lewat pintu admin (ketuk logo toko)');
    }
    let snap = null;
    try {
      snap = await FB.db.collection('customers').doc(uid).get();
    } catch (error) {
      try { await FB.auth.signOut(); } catch (e) {}
      throw new Error(this.authErrorMessage(error));
    }
    const data = snap && snap.exists ? snap.data() : null;
    if (!data) await reject('Akun tidak ditemukan, silakan daftar dulu');
    if (data.approvalStatus === 'pending') await reject('Pendaftaran masih menunggu persetujuan warung');
    if (data.approvalStatus === 'rejected') await reject('Pendaftaran ditolak');
    await this.whenSessionReady();
    return { id: uid, name: data.name || 'Pelanggan' };
  },

  /* Masuk admin: email+password + custom claim admin:true.
   * Bukan admin → pesan error + signOut. TIDAK ADA pendaftaran mandiri. */
  async loginAdmin(email, password) {
    if (!this.needOnline()) throw __offlineError();
    let cred;
    try {
      cred = await FB.auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
      throw new Error(this.authErrorMessage(error));
    }
    let claims = null;
    try {
      const token = await cred.user.getIdTokenResult(true);
      claims = (token && token.claims) || {};
    } catch (error) { claims = null; }
    if (!claims || claims.admin !== true) {
      try { await FB.auth.signOut(); } catch (e) {}
      throw new Error('Akun ini bukan admin');
    }
    await this.whenSessionReady();
    if (S.sessionRole !== 'admin') {
      // Sesi auth tidak berubah (pengguna sudah masuk) sehingga handleAuthState
      // tidak jalan ulang — pasang status admin eksplisit (klaim sudah terverifikasi).
      this.clearRoleSubs();
      S.isGuest = false;
      S.sessionRole = 'admin';
      S.sessionName = 'Admin Warunge Mimi';
      S.sessionStartedAt = new Date().toISOString();
      S.activeCustomerId = null;
      this.startAdminSubs();
      this.render('session', 'profile');
    }
    return { email: email };
  },

  async logout() {
    this.clearRoleSubs();
    this.setGuestSession();
    try { await FB.auth.signOut(); } catch (e) {}
    this.render('session', 'profile', 'orders', 'coins', 'customerNotes', 'customers',
      'journal', 'stockNotes', 'chat', 'inbox');
  },
};
