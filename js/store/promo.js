/* KasirQuh — Store Module: Promo
 * FASE 1 refactor store.js (2026-10-16)
 * Berisi: savePromo, setPromoActive, deletePromo
 * Dependensi: this.needOnline(), this.assertAdmin(), __offlineError(), FB
 */
const StorePromo = {
  async savePromo(data, id) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    const title = String((data && data.title) || '').trim();
    if (!title) throw new Error('Isi judul promo dulu');
    const payload = {
      title: title.slice(0, 64),
      copy: String((data && data.copy) || '').slice(0, 110),
      badge: (String((data && data.badge) || 'PROMO').slice(0, 12) || 'PROMO'),
      isActive: !data || data.isActive !== false,
      updatedAt: FB.serverTimestamp(),
    };
    if (id) {
      await FB.db.collection('promos').doc(id).update(payload);
    } else {
      payload.createdAt = FB.serverTimestamp();
      await FB.db.collection('promos').add(payload);
    }
  },

  async setPromoActive(id, isActive) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    await FB.db.collection('promos').doc(id).update({ isActive: isActive !== false, updatedAt: FB.serverTimestamp() });
  },

  async deletePromo(id) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    await FB.db.collection('promos').doc(id).delete();
  },
};
