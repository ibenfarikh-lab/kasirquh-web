/* KasirQuh — Firebase Cloud Messaging (Push Notification)
 *
 * PENTING: VAPID_KEY harus diisi dari Firebase Console
 * (Project Settings → Cloud Messaging → Web Push certificates).
 * Tanpa VAPID key, getToken() akan gagal.
 */
const FCM_VAPID_KEY = 'BCqm7CrTfNFb3NWswI3crJLVuL_LptKcU3iR9_miapPhkKwfREd1liSoJ-h0dpTcdGwNiKtlA75nTZeA1vJusCE'; // VAPID public key (aman di client-side)

const FCM = {
  messaging: null,
  token: null,
  initialized: false,
  swRegistration: null,

  /* Inisialisasi FCM (dipanggil setelah Firebase ready & user login) */
  async init() {
    if (this.initialized) return true;
    try {
      if (!('Notification' in window)) {
        console.log('[FCM] Browser tidak mendukung notifikasi');
        return false;
      }
      if (!firebase.messaging.isSupported()) {
        console.log('[FCM] Messaging tidak didukung browser ini');
        return false;
      }
      this.messaging = firebase.messaging();

      // Daftarkan service worker untuk FCM (wajib sebelum getToken)
      try {
        if ('serviceWorker' in navigator) {
          this.swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          console.log('[FCM] Service worker terdaftar');
        }
      } catch (swErr) {
        console.log('[FCM] SW gagal:', swErr.message);
      }

      this.initialized = true;

      // Foreground message handler
      this.messaging.onMessage((payload) => {
        const title = (payload.notification && payload.notification.title) || 'Warunge Mimi';
        const body = (payload.notification && payload.notification.body) || 'Ada kabar baru';
        // Tampilkan sebagai toast + notifikasi browser jika diizinkan
        if (typeof toast === 'function') toast(title + ': ' + body);
        if (Notification.permission === 'granted') {
          new Notification(title, { body, icon: '/assets/img/img-005.png' });
        }
      });

      return true;
    } catch (e) {
      console.log('[FCM] Init gagal:', e.message);
      return false;
    }
  },

  /* Minta izin notifikasi ke user */
  async requestPermission() {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (e) {
      return false;
    }
  },

  /* Ambil token FCM dan simpan ke Firestore */
  async registerToken() {
    if (!this.initialized) await this.init();
    if (!this.messaging) return null;
    if (!FCM_VAPID_KEY) {
      console.log('[FCM] VAPID_KEY belum diisi — token tidak bisa diambil');
      return null;
    }
    try {
      const granted = await this.requestPermission();
      if (!granted) {
        console.log('[FCM] Izin notifikasi ditolak user');
        return null;
      }
      const tokenOpts = { vapidKey: FCM_VAPID_KEY };
      if (this.swRegistration) tokenOpts.serviceWorkerRegistration = this.swRegistration;
      const token = await this.messaging.getToken(tokenOpts);
      if (!token) return null;
      this.token = token;

      // Simpan token ke Firestore (per user/device)
      // Pakai Firebase Auth UID langsung agar admin pun teridentifikasi
      let uid = 'anon';
      try {
        const au = (window.firebase && firebase.auth && firebase.auth().currentUser) || null;
        if (au && au.uid) uid = au.uid;
        else if (window.S && S.activeCustomerId) uid = S.activeCustomerId;
      } catch (e) {}
      const db = firebase.firestore();
      try {
        await db.collection('fcm_tokens').doc(uid + '_' + token.slice(-12)).set({
          uid: uid,
          token: token,
          platform: 'web',
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      } catch (dbErr) {
        console.log('[FCM] Firestore gagal:', dbErr.message);
        // Simpan token lokal sebagai fallback agar bisa didiagnosis
        try { localStorage.setItem('fcm_token_pending', token); } catch (e) {}
        throw new Error('Firestore: ' + (dbErr.message || 'tulis ditolak'));
      }

      console.log('[FCM] Token terdaftar');
      return token;
    } catch (e) {
      console.log('[FCM] Register gagal:', e.message);
      if (typeof toast === 'function') {
        const msg = String(e.message || '');
        if (msg.includes('permission')) toast('Izin notifikasi dibutuhkan');
        else if (msg.includes('ServiceWorker') || msg.includes('service worker')) toast('Gagal daftar service worker');
        else toast('Notifikasi gagal aktif: ' + msg.slice(0, 50));
      }
      return null;
    }
  },

  /* Hapus token saat logout */
  async unregisterToken() {
    if (!this.messaging || !this.token) return;
    try {
      await this.messaging.deleteToken();
      this.token = null;
    } catch (e) {}
  },
};

window.FCM = FCM;
