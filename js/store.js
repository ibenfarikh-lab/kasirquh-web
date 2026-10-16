/*
 * KasirQuh Web — js/store.js
 *
 * 1) `const S` — satu-satunya wadah state aplikasi (92 variabel state,
 *    tanpa data dummy; koleksi terisi dari Firestore lewat adapter di bawah).
 *    DIHAPUS TOTAL — diganti Firebase Auth.
 *    Kunci baru: promos, storeSettings, customerNotesList,
 *    adminCustomerNotes, myCustomerDoc (semuanya dari Firestore).
 *
 * 2) `const Store` — lapisan data Firebase: adapter onSnapshot per koleksi,
 *    Auth (pelanggan/admin/tamu), dan semua API tulis sesuai
 *    FIRESTORE_SCHEMA.md. Semua tulis mewajibkan online (gagal → pesan
 *    jujur "Butuh koneksi internet", tanpa antrean siluman).
 *
 * Prinsip data: tidak ada istilah/data siluman — angka hanya dari transaksi
 * nyata; koleksi kosong → empty state jujur di UI ("belum ada transaksi").
 */

// Gambar "kosong" untuk produk yang belum ada foto: 1x1 piksel transparan.
// Prinsip: foto produk HANYA dari database (photoUrl). Tidak ada lagi
// placeholder gambar produk di assets/ — yang belum difoto tampil kosong
// agar jelas perlu diinput manual. (2026-10-14)
const IMG_EMPTY = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Kunci tanggal sesi (Asia/Jakarta). Dipakai juga sebagai nilai
// awal S.activePurchaseDate — dihitung sekali di sini agar konsisten.

/* === MODULE: core.js (FASE 11 refactor) — S, utils, StoreCore pindah ke core.js === */
const Store = {};


/* ---------------- adapter langganan ---------------- */

Object.assign(Store, {

  async init() {
    /* Auth boot adalah satu jalur resmi. UI tidak boleh memutuskan
     * "tamu"/gateway sebelum Firebase selesai memastikan sesi awal. */
    this._authBootSettled = false;
    this._authBootPromise = new Promise(resolve => { this._authBootResolve = resolve; });

    if (!window.FB || !FB.ready()) {
      console.error('[KasirQuh] Firebase belum siap — adapter data tidak dijalankan.',
        window.FB && FB.initError ? FB.initError() : '');
      this._authBootSettled = true;
      this._authBootResolve();
      return;
    }
    try {
      /* Persistence LOCAL harus selesai sebelum listener awal dipasang.
       * Ini bagian dari boot auth, bukan patch setelah login gagal. */
      if (FB.authPersistenceReady) await FB.authPersistenceReady;
    } catch (error) {
      console.error('[KasirQuh] Auth persistence tidak tersedia; listener sesi tidak dijalankan.', error);
      this._authBootSettled = true;
      this._authBootResolve();
      return;
    }
    this.startPublicSubs();
    FB.auth.onAuthStateChanged(async user => {
      try {
        await this.handleAuthState(user);
        /* FCM: daftarkan token push (non-blocking, abaikan gagal) */
        if (window.FCM && user) {
          FCM.init().then(ok => { if (ok) FCM.registerToken().catch(()=>{}); }).catch(()=>{});
        }
      } finally {
        /* Hanya callback pertama yang menutup gerbang boot. Perubahan auth
         * berikutnya tetap berjalan normal tanpa menahan UI. */
        if (!this._authBootSettled) {
          this._authBootSettled = true;
          if (this._authBootResolve) this._authBootResolve();
          this._authBootResolve = null;
        }
      }
    });
  },

  whenAuthReady() {
    return this._authBootPromise || Promise.resolve();
  },

  /* Koleksi publik: berlaku untuk tamu, pelanggan, dan admin */
  startPublicSubs() {
    const db = FB.db;

    this.refreshProducts();
    this.watchPatungan();
    this.watchRutinPackages();
    this.watchHajatanPackages();
    this.watchRecipes();

    /* Promo: tarik manual (hemat kuota) — bukan real-time. */
    this.refreshPromos = async () => {
      try {
        const snap = await db.collection('promos').where('isActive', '==', true).get();
        S.promos = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
        this.render('promos');
      } catch (err) { this.onSubError('promos', err); }
    };
    this.refreshPromos();

    this.onPublic(db.collection('store_settings').doc('main').onSnapshot(snap => {
      this.applyStoreSettings(snap.exists ? snap.data() : null);
    }, err => this.onSubError('store_settings', err)));

    this.onPublic(db.collection('rumpi_posts').orderBy('createdAt', 'desc').limit(20).onSnapshot(snap => {
      S.rumpiMessages = snap.docs.map(d => this.mapRumpi(d));
      this.render('rumpi');
    }, err => this.onSubError('rumpi_posts', err)));
  },

  applyStoreSettings(data) {
    S.storeSettings = data || {};
    const d = S.storeSettings;
    if (Array.isArray(d.dashboardShortcutIds) && d.dashboardShortcutIds.length) S.dashboardShortcutIds = d.dashboardShortcutIds.filter(id => typeof id === 'string').slice(0, 6);
    if (d.carouselSlots && typeof d.carouselSlots === 'object') S.carouselSlots = d.carouselSlots;
    if (Array.isArray(d.inboxReadIds)) S.inboxReadIds = d.inboxReadIds.filter(id => typeof id === 'string').slice(0, 200);
    if (typeof d.coinRate === 'number') S.coinValue = Math.max(1, Math.round(d.coinRate));
    if (typeof d.coinRedeemLimit === 'number') S.coinRedeemPercent = Math.min(100, Math.max(0, Math.round(d.coinRedeemLimit)));
    if (typeof d.lowStockDefault === 'number') S.lowStockThreshold = Math.min(99, Math.max(1, Math.round(d.lowStockDefault)));
    /* Program koin: nyala/mati + event + hadiah (live) */
    if (typeof d.coinProgramEnabled === 'boolean') S.coinProgramEnabled = d.coinProgramEnabled;
    if (d.coinEvents && typeof d.coinEvents === 'object') {
      ['checkin', 'mission', 'guess', 'spend'].forEach(k => {
        if (typeof d.coinEvents[k] === 'boolean') S.coinEvents[k] = d.coinEvents[k];
      });
    }
    if (d.coinRewards && typeof d.coinRewards === 'object') {
      ['checkin', 'mission', 'guess'].forEach(k => {
        if (typeof d.coinRewards[k] === 'number') S.coinRewards[k] = Math.max(0, Math.round(d.coinRewards[k]));
      });
    }
    if (typeof d.coinSpendReward === 'number') S.coinSpendReward = Math.max(0, Math.round(d.coinSpendReward));
    if (typeof d.coinSpendRule === 'number') S.coinSpendRule = Math.max(1, Math.round(d.coinSpendRule));
    if (typeof d.coinRule === 'string') S.coinRule = d.coinRule;
    /* Promo kilat: produk + harga → peta harga promo (live) */
    S.flashEndsAt = (d.flashEndsAt && typeof d.flashEndsAt.toDate === 'function') ? d.flashEndsAt : null;
    /* Auto-off: jika waktu habis, promo mati otomatis */
    const flashExpired = S.flashEndsAt && typeof S.flashEndsAt.toMillis === 'function' && S.flashEndsAt.toMillis() <= Date.now();
    const flashId = (!flashExpired && typeof d.flashProductId === 'string' && d.flashProductId.trim()) ? d.flashProductId.trim() : null;
    S.flashProductId = flashId;
    const flashPrice = Number(d.flashPrice) > 0 ? Math.round(Number(d.flashPrice)) : 0;
    S.promoUnitPrice = (flashId && flashPrice > 0) ? { [flashId]: flashPrice } : {};
    if (typeof d.flashRule === 'string') S.flashRule = d.flashRule;
    if (typeof d.flashProductName === 'string') S.flashProductName = d.flashProductName;
    /* Promo utama + slide gateway + kabar (live) */
    if (typeof d.promoTitle === 'string') S.promoTitle = d.promoTitle;
    if (typeof d.promoProductId === 'string') S.promoProductId = d.promoProductId || null;
    if (typeof d.promoCopy === 'string') S.promoCopy = d.promoCopy;
    const gs = S.gatewaySlides || {};
    const gsText = (v, fb) => (typeof v === 'string' && v.trim()) ? v : fb;
    S.gatewaySlides = {
      title1: gsText(d.gatewayTitle1, gs.title1),
      copy1: gsText(d.gatewayCopy1, gs.copy1),
      title2: gsText(d.gatewayTitle2, gs.title2),
      copy2: gsText(d.gatewayCopy2, gs.copy2),
      title3: gsText(d.gatewayTitle3, gs.title3),
      copy3: gsText(d.gatewayCopy3, gs.copy3),
    };
    if (typeof d.kabarStatus === 'string') S.kabarStatus = d.kabarStatus;
    if (typeof d.kabarMood === 'string') S.kabarMood = d.kabarMood;
    /* Bagian Beranda (live) */
    ['restock', 'popular', 'recipe'].forEach(k => {
      const sec = d.homeSections && d.homeSections[k];
      if (sec && typeof sec === 'object') {
        if (typeof sec.show === 'boolean') S.homeSections[k].show = sec.show;
        const ord = Number(sec.order);
        if (ord >= 1 && ord <= 3) S.homeSections[k].order = ord;
      }
    });
    /* Jam operasional (live, format HH:MM) */
    const hhmm = v => (typeof v === 'string' && /^\d{2}:\d{2}$/.test(v.trim())) ? v.trim() : '';
    d.openTime = hhmm(d.openTime);
    d.closeTime = hhmm(d.closeTime);
    /* Preferensi admin (persist): tema, dering, animasi navigasi.
     * Hanya ke state di sini; efek tampilan lewat renderer 'settings'. */
    const adminTheme = String(d.adminTheme || '').trim();
    if (['light', 'dark', 'system'].indexOf(adminTheme) >= 0) S.adminTheme = adminTheme;
    if (d.adminSoundSettings && typeof d.adminSoundSettings === 'object') {
      ['order', 'promo', 'chat'].forEach(k => { if (typeof d.adminSoundSettings[k] === 'string') S.soundSettings[k] = d.adminSoundSettings[k]; });
      if (typeof d.adminSoundSettings.vibrate === 'boolean') S.vibrateWhenSilent = d.adminSoundSettings.vibrate;
    }
    if (typeof d.adminNavMotion === 'boolean') S.navMotion = d.adminNavMotion;
    /* Terapkan yang tampil: nama warung (satu sumber) + running text.
     * Input form TIDAK disentuh di sini — pakai syncSettingsForms() saat sheet dibuka. */
    try {
      const name = (String(d.storeName || 'Warunge Mimi')).trim() || 'Warunge Mimi';
      const adminTitle = document.querySelector('.admin-home-link h2');
      if (adminTitle) adminTitle.textContent = name;
      const gatewayName = document.getElementById('gatewayStoreName');
      if (gatewayName) gatewayName.textContent = name;
      const homeTitle = document.querySelector('.home-head h1');
      if (homeTitle) homeTitle.textContent = name;
      if (typeof d.runningText === 'string' && d.runningText.trim()) {
        const rt = document.getElementById('runningText');
        if (rt) rt.textContent = d.runningText;
      }
    } catch (e) { /* DOM belum siap — render berikutnya memperbaiki */ }
    this.rebuildPopular();
    this.render('settings');
    /* Tampilan promo & tata letak Beranda dipegang app.js (guard: boleh belum ada) */
    if (typeof renderFlashCard === 'function') renderFlashCard();
    if (typeof renderPromoCarousel === 'function') renderPromoCarousel();
    if (typeof syncHomeSectionLayout === 'function') syncHomeSectionLayout();
    if (typeof renderKabar === 'function') renderKabar();
    if (window.KasirQuhUI&&typeof window.KasirQuhUI.syncGatewayPromo==='function')window.KasirQuhUI.syncGatewayPromo();
  },

  /* Isi semua input form admin dari state — dipanggil app.js saat sheet
   * pengaturan dibuka. Hanya input form; tampilan display ditangani
   * applyStoreSettings/render. Tiap elemen di-guard (boleh tidak ada). */
  syncSettingsForms() {
    const d = S.storeSettings || {};
    const setVal = (id, v) => {
      try {
        const el = document.getElementById(id);
        if (el && v !== undefined && v !== null) el.value = String(v);
      } catch (e) {}
    };
    /* Profil toko */
    setVal('adminStoreNameInput', String(d.storeName || 'Warunge Mimi'));
    setVal('adminOpenTime', d.openTime || '');
    setVal('adminCloseTime', d.closeTime || '');
    setVal('adminStoreAddress', String(d.storeAddress || ''));
    setVal('adminStorePhone', String(d.storePhone || ''));
    /* Koin Warga */
    setVal('coinValueInput', S.coinValue);
    setVal('coinRedeemPercentInput', S.coinRedeemPercent);
    setVal('coinCheckinInput', S.coinRewards.checkin);
    setVal('coinMissionInput', S.coinRewards.mission);
    setVal('coinGuessInput', S.coinRewards.guess);
    setVal('coinSpendRewardInput', S.coinSpendReward);
    setVal('coinSpendInput', S.coinSpendRule);
    setVal('coinRuleInput', String(d.coinRule || ''));
    /* Beranda pelanggan */
    setVal('homeInfoInput', String(d.runningText || ''));
    const slides = S.gatewaySlides || {};
    setVal('gatewayTitle1Input', slides.title1 || '');
    setVal('gatewayCopy1Input', slides.copy1 || '');
    setVal('gatewayTitle2Input', slides.title2 || '');
    setVal('gatewayCopy2Input', slides.copy2 || '');
    setVal('gatewayTitle3Input', slides.title3 || '');
    setVal('gatewayCopy3Input', slides.copy3 || '');
    setVal('promoTitleInput', S.promoTitle || '');
    setVal('flashPriceInput', (S.flashProductId && S.promoUnitPrice[S.flashProductId]) || '');
    setVal('flashRuleInput', S.flashRule || '');
    setVal('kabarStatusInput', S.kabarStatus || '');
    setVal('kabarMoodInput', S.kabarMood || '');
    /* Tema admin (persist) → tandai pilihan aktif di Pengaturan */
    try {
      document.querySelectorAll('[data-admin-theme]').forEach(b => b.classList.toggle('active', b.getAttribute('data-admin-theme') === (S.adminTheme || 'dark')));
    } catch (e) {}
    /* Toggle tampil/sembunyi + urutan bagian Beranda */
    try {
      document.querySelectorAll('.home-section-toggle[data-section]').forEach(btn => {
        const sec = (S.homeSections || {})[btn.getAttribute('data-section')];
        if (!sec) return;
        btn.setAttribute('aria-pressed', String(!!sec.show));
        btn.textContent = sec.show ? 'TAMPIL' : 'SEMBUNYI';
      });
      document.querySelectorAll('[data-section-order]').forEach(sel => {
        const sec = (S.homeSections || {})[sel.getAttribute('data-section-order')];
        if (sec && sec.order) sel.value = String(sec.order);
      });
    } catch (e) {}
  },

  /* Simpan pengaturan toko (admin). Snapshot store_settings/main otomatis
   * menerapkan balik lewat applyStoreSettings. */
  /* Produk: tarik manual (hemat kuota) — bukan real-time.
   * Dipanggil saat boot, saat admin simpan produk, dan via tombol refresh. */
  /* === MODULE: products.js (FASE 3 refactor) === */

  /* === MODULE: catalog.js (FASE 7 refactor) === */

  async saveStoreSettings(patch) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    await FB.db.collection('store_settings').doc('main').set(
      Object.assign({ updatedAt: FB.serverTimestamp() }, patch || {}),
      { merge: true }
    );
  },

  /* === MODULE: catalog.js (FASE 7 refactor, lanjutan) === */

  /* ---------------- langganan pelanggan ---------------- */

  /* === MODULE: chat.js (FASE 8 refactor) === */

  /* ---------------- langganan admin ---------------- */

  /* === MODULE: chat.js (FASE 8 refactor, lanjutan) === */

  /* === MODULE: derived.js (FASE 12 refactor) === */
});

/* === MODULE: auth.js (FASE 10 refactor) === */

/* ---------------- API tulis (semua: requireOnline dulu) ---------------- */

Object.assign(Store, {

  /* === MODULE: checkout.js (FASE 9 refactor) === */

  /* Produk: tambah (stok awal langsung) / ubah (stok via DELTA, bukan absolut) */
  /* === MODULE: products.js (FASE 3 refactor, lanjutan) === */

  /* Jurnal manual / dari alur lain (bentuk UI -> skema) */
  /* === MODULE: ledger.js (FASE 5 refactor) === */

  /* Selesaikan pesanan online: status → selesai + jurnal penjualan
   * (+ beban promosi bila ada koin ditukar). Stok sudah dikurangi saat checkout. */
  /* === MODULE: orders.js (FASE 4 refactor) === */

  /* === MODULE: customers.js (FASE 6 refactor) === */

  /* Chat: kirim pesan (thread dibuat dulu agar lolos rules get()) */
  /* === MODULE: chat.js (FASE 8 refactor, kirim) === */

  /* Catatan toko / kasbon digital: admin tulis, pelanggan baca di Akun.
   * `date` opsional (string YYYY-MM-DD) — disimpan sebagai noteDate. */
  /* === MODULE: notes.js (FASE 2 refactor) === */

  /* ---------------- Catatan Toko, resep, titip, profil (API tulis baru) ---------------- */

  /* === MODULE: catalog.js (FASE 7 refactor, resep) === */

  /* Titip barang: pelanggan tulis ke `titip_requests` (status awal 'baru') */
  /* === MODULE: notes.js (FASE 2 refactor, lanjutan) === */
  /* Muat stock_notes MANUAL dengan filter tanggal (tidak auto-load) */
  /* === MODULE: ledger.js (FASE 5 refactor, lanjutan) === */
  /* === MODULE: customers.js (FASE 6 refactor, lanjutan) === */
});

/* === MERGE MODULE (refactor bertahap) === */
if (typeof StoreCore !== 'undefined') Object.assign(Store, StoreCore);
if (typeof StoreDerived !== 'undefined') Object.assign(Store, StoreDerived);
if (typeof StorePromo !== 'undefined') Object.assign(Store, StorePromo);
if (typeof StoreNotes !== 'undefined') Object.assign(Store, StoreNotes);
if (typeof StoreProducts !== 'undefined') Object.assign(Store, StoreProducts);
if (typeof StoreOrders !== 'undefined') Object.assign(Store, StoreOrders);
if (typeof StoreLedger !== 'undefined') Object.assign(Store, StoreLedger);
if (typeof StoreCustomers !== 'undefined') Object.assign(Store, StoreCustomers);
if (typeof StoreCatalog !== 'undefined') Object.assign(Store, StoreCatalog);
if (typeof StoreChat !== 'undefined') Object.assign(Store, StoreChat);
if (typeof StoreCheckout !== 'undefined') Object.assign(Store, StoreCheckout);
if (typeof StoreAuth !== 'undefined') Object.assign(Store, StoreAuth);

/* Boot lapisan data — sebelum js/app.js (render dipicu ulang setelah
 * app.js mendaftarkan Store.renderers + memanggil Store.refreshAll()). */
Store.init().catch(function (error) {
  console.error('[KasirQuh] Store.init gagal:', error);
});
