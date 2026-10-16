/* KasirQuh — Store Module: Notes
 * FASE 2 refactor store.js (2026-10-16)
 * Berisi: addCustomerNote, addStoreMemo, deleteStoreMemo, submitTitipRequest, setTitipStatus
 * Dependensi: this.needOnline(), this.assertAdmin(), __offlineError(), __withTimeout(), WRITE_TIMEOUT_MS, FB, S
 */
const StoreNotes = {
  async addCustomerNote({ customerId, type, amount, note, date }) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    if (!customerId) throw new Error('Pilih pelanggan dulu');
    if (!String(note || '').trim()) throw new Error('Tulis isi catatan dulu');
    const payload = {
      customerId: customerId,
      type: type || 'catatan',
      amount: Math.round(Number(amount) || 0),
      note: String(note).trim(),
      createdAt: FB.serverTimestamp(),
    };
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      payload.noteDate = date.trim();
    }
    await FB.db.collection('customer_notes').add(payload);
  },

  /* Catatan Toko: pengingat internal admin (koleksi `store_memos`).
   * Skema disatukan (Domain A Harmonisasi): title, body, createdAt.
   * Dokumen lama yang hanya punya `text` tetap terbaca sebagai body. */
  async addStoreMemo({ title, body }) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    const isi = String(body || '').trim();
    if (!isi) throw new Error('Tulis catatan dulu');
    await FB.db.collection('store_memos').add({
      title: String(title || '').trim().slice(0, 80),
      body: isi.slice(0, 500),
      createdAt: FB.serverTimestamp(),
    });
  },

  async deleteStoreMemo(id) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    await FB.db.collection('store_memos').doc(id).delete();
  },

  async submitTitipRequest({ item, note, method }) {
    if (!this.needOnline()) throw __offlineError();
    const uid = S.activeCustomerId;
    if (!uid) throw new Error('Masuk dulu sebagai pelanggan');
    const barang = String(item || '').trim();
    if (!barang) throw new Error('Tulis barang yang dititip dulu');
    await __withTimeout(FB.db.collection('titip_requests').add({
      customerId: uid,
      customerName: S.sessionName || 'Pelanggan',
      item: barang.slice(0, 100),
      note: String(note || '').slice(0, 300),
      method: String(method || 'Ambil di warung'),
      status: 'baru',
      createdAt: FB.serverTimestamp(),
    }), WRITE_TIMEOUT_MS, 'Kirim titipan');
  },

  /* Ubah status titipan MANUAL oleh admin (tidak otomatis) */
  async setTitipStatus(docId, status) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    const allowed = ['baru', 'diproses', 'tersedia', 'selesai', 'dibatalkan'];
    if (!allowed.includes(status)) throw new Error('Status tidak valid');
    await FB.db.collection('titip_requests').doc(docId).update({
      status: status,
      updatedAt: FB.serverTimestamp(),
    });
  },
};
