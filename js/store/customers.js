/* KasirQuh — Store Module: Customers (Pelanggan Admin)
 * FASE 6 refactor store.js (2026-10-16)
 * Berisi: approveCustomer, rejectCustomer, grantCoins, adjustCoins, saveCustomerDoc, updateCustomerName
 * Dependensi: this.needOnline(), this.assertAdmin(), this.render,
 *   __offlineError(), __withTimeout(), WRITE_TIMEOUT_MS, FB, S
 */
const StoreCustomers = {
  /* Persetujuan pendaftar */
  async approveCustomer(uid) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    /* Opsi A: generate memberCode unik KQ-XXXXXXXX (8 char awal UID, uppercase) */
    const memberCode = 'KQ-' + String(uid).slice(0, 8).toUpperCase();
    await FB.db.collection('customers').doc(uid).update({ approvalStatus: 'approved', memberCode: memberCode });
  },

  async rejectCustomer(uid) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    await FB.db.collection('customers').doc(uid).update({ approvalStatus: 'rejected' });
  },

  /* Koin pelanggan (check-in/misi/tebak/belanja): koin + ledger.
   * CATATAN aturan: coin_ledger tulis = admin di sketsa rules — perlu
   * pelonggaran agar pelanggan bisa mencatat perolehannya (lihat laporan). */
  async grantCoins(uid, amount, meta) {
    amount = Math.round(Number(amount) || 0);
    if (!uid || !amount) return;
    if (!this.needOnline()) throw __offlineError();
    meta = meta || {};
    const db = FB.db;
    const ts = FB.serverTimestamp();
    const update = { coins: FB.FieldValue.increment(amount) };
    if (meta.reason === 'harian') update.lastCheckin = S.todayKey;
    if (meta.reason === 'tebak_harga') update.lastGuessDate = S.todayKey;
    if (meta.reason === 'misi' && meta.claimKey) update['missionClaims.' + String(meta.claimKey).replace(/[./]/g, '_')] = true;
    const batch = db.batch();
    batch.update(db.collection('customers').doc(uid), update);
    batch.set(db.collection('coin_ledger').doc(), {
      customerId: uid, amount: amount, reason: meta.reason || 'harian',
      label: meta.label || 'Koin masuk', detail: meta.detail || '',
      createdAt: ts,
    });
    await __withTimeout(batch.commit(), WRITE_TIMEOUT_MS, 'Klaim koin');
  },

  /* Koreksi koin oleh admin: delta negatif → jurnal beban_promosi
   * |delta|×coinRate dalam batch atomik yang sama (sesuai skema). */
  async adjustCoins(uid, delta, meta) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    delta = Math.round(Number(delta) || 0);
    if (!uid || !delta) return;
    meta = meta || {};
    const db = FB.db;
    const ts = FB.serverTimestamp();
    const batch = db.batch();
    batch.update(db.collection('customers').doc(uid), { coins: FB.FieldValue.increment(delta) });
    batch.set(db.collection('coin_ledger').doc(), {
      customerId: uid, amount: delta, reason: meta.reason || 'koreksi_admin',
      label: meta.label || 'Koreksi admin', detail: meta.detail || '',
      createdAt: ts,
    });
    if (delta < 0) {
      batch.set(db.collection('journal').doc(), {
        type: 'pengeluaran', category: 'beban_promosi',
        amount: Math.abs(delta) * Math.max(1, S.coinValue),
        note: 'Penukaran koin · ' + Math.abs(delta).toLocaleString('id-ID') + ' koin',
        refId: '', method: 'Koin Warga', profit: 0, itemCount: 0, createdAt: ts,
      });
    }
    await __withTimeout(batch.commit(), WRITE_TIMEOUT_MS, 'Atur koin');
  },

  /* Simpan field profil pelanggan sendiri (pantauan harga, jadwal rutin).
   * Tamu: hanya sesi ini (tanpa uid). approvalStatus TIDAK ikut diubah. */
  async saveCustomerDoc(patch) {
    if (!S.activeCustomerId || S.isGuest) return; // tamu: sesi-saja
    if (!this.needOnline()) throw __offlineError();
    await FB.db.collection('customers').doc(S.activeCustomerId).update(patch);
  },

  /* Ganti nama pelanggan sendiri. Izin ditolak → diam (nama tetap sesi-saja), tanpa crash. */
  async updateCustomerName(name) {
    if (!this.needOnline()) throw __offlineError();
    const uid = S.activeCustomerId;
    if (!uid) throw new Error('Masuk dulu sebagai pelanggan');
    const nama = String(name || '').trim().slice(0, 50);
    if (!nama) throw new Error('Isi nama dulu');
    S.sessionName = nama; // langsung berlaku di sesi
    try {
      await FB.db.collection('customers').doc(uid).update({ name: nama });
    } catch (error) {
      if (!error || error.code !== 'permission-denied') throw error;
      // permission-denied → diam: nama tetap sesi-saja, tanpa crash
    }
    this.render('profile', 'session');
  },
};
