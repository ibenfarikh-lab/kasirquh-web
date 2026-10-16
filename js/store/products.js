/* KasirQuh — Store Module: Products
 * FASE 3 refactor store.js (2026-10-16)
 * Berisi: refreshProducts, saveProduct, deleteProduct, importProducts
 * Dependensi: this.needOnline(), this.assertAdmin(), this.mapProduct, this.rebuildPopular,
 *   this.render, this.onSubError, this.refreshProducts, this.watchPatungan,
 *   __offlineError(), __withTimeout(), WRITE_TIMEOUT_MS, FB, S
 */
const StoreProducts = {
  async refreshProducts() {
    try {
      const snap = await FB.db.collection('products').get();
      S.products = snap.docs.map(d => this.mapProduct(d)).filter(p => p);
      this.rebuildPopular();
      this.render('products');
    } catch (err) { this.onSubError('products', err); }
  },

  async saveProduct(data, id) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    const db = FB.db;
    const ts = FB.serverTimestamp();
    const base = {
      name: data.name,
      category: data.cat,
      unit: data.unit || 'pcs',
      price: Math.round(data.price),
      costPrice: Math.round(data.cost),
      photoUrl: data.img || '',
      barcode: data.barcode || '',
      isActive: true,
      budgetEligible: !!data.budgetEligible,
      budgetMaxQty: Math.min(20, Math.max(1, Math.round(Number(data.budgetMaxQty) || 4))),
      wholesaleQty: Math.max(0, Math.round(Number(data.wholesaleQty) || 0)),
      wholesalePrice: Math.max(0, Math.round(Number(data.wholesalePrice) || 0)),
      wholesaleLabel: String(data.wholesaleLabel || ''),
      updatedAt: ts,
    };
    if (id) {
      const ref = db.collection('products').doc(id);
      const snap = await ref.get();
      const current = snap.exists ? Math.max(0, Math.round(Number(snap.data().stock) || 0)) : 0;
      const delta = Math.round(data.stock) - current;
      if (delta !== 0) base.stock = FB.FieldValue.increment(delta);
      await ref.update(base);
    } else {
      base.stock = Math.max(0, Math.round(data.stock));
      base.lowStockAt = S.lowStockThreshold;
      base.createdAt = ts;
      await db.collection('products').add(base);
    }
    this.refreshProducts();
    this.watchPatungan();
  },

  /* Hapus produk (base fix: tanpa `stockTasks` yang tak pernah dideklarasikan) */
  async deleteProduct(id) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    await FB.db.collection('products').doc(id).delete();
    this.refreshProducts();
    this.watchPatungan();
  },

  /* Impor produk dari CSV (admin): cocokkan Kode -> barcode.
   * Kode sudah ada -> UPDATE (timpa data CSV); Kode baru -> tambah.
   * items: [{barcode, name, cat, unit, stock, cost, price}] (sudah tervalidasi UI).
   * onProgress(done, total) opsional. Gagal di tengah -> throw dengan
   * properti importedSoFar = jumlah batch yang sudah ter-commit. */
  async importProducts(items, onProgress) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    const db = FB.db;
    const ts = FB.serverTimestamp();
    const byBarcode = {};
    (S.products || []).forEach(p => {
      const code = String(p.barcode || '').trim();
      if (code && !byBarcode[code]) byBarcode[code] = p.id;
    });
    const ops = (items || []).map(item => {
      const code = String(item.barcode || '').trim();
      const data = {
        name: String(item.name || '').trim(),
        category: String(item.cat || 'Lainnya').trim() || 'Lainnya',
        unit: String(item.unit || 'pcs').trim() || 'pcs',
        price: Math.max(0, Math.round(Number(item.price) || 0)),
        costPrice: Math.max(0, Math.round(Number(item.cost) || 0)),
        stock: Math.max(0, Number(item.stock) || 0),
        barcode: code,
        photoUrl: String(item.photo || '').trim(),
        isActive: true,
        updatedAt: ts,
      };
      return { existingId: code ? byBarcode[code] || null : null, data };
    }).filter(op => op.data.name);
    const BATCH = 400;
    let done = 0, created = 0, updated = 0;
    try {
      for (let i = 0; i < ops.length; i += BATCH) {
        const batch = db.batch();
        const slice = ops.slice(i, i + BATCH);
        slice.forEach(op => {
          if (op.existingId) {
            batch.set(db.collection('products').doc(op.existingId), op.data, { merge: true });
            updated++;
          } else {
            const ref = db.collection('products').doc();
            batch.set(ref, Object.assign({ createdAt: ts, lowStockAt: S.lowStockThreshold }, op.data));
            created++;
          }
        });
        await __withTimeout(batch.commit(), WRITE_TIMEOUT_MS, 'Impor produk');
        done += slice.length;
        if (onProgress) onProgress(done, ops.length);
      }
    } catch (e) {
      e.importedSoFar = done;
      throw e;
    }
    return { created, updated, total: ops.length };
  },
};
