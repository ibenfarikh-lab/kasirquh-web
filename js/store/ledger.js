/* KasirQuh — Store Module: Ledger (Pembukuan)
 * FASE 5 refactor store.js (2026-10-16)
 * Berisi: recordJournal, saveRestock, addManualPurchaseNote, updateStockNote, deleteStockNote, loadStockNotes
 * Dependensi: this.needOnline(), this.assertAdmin(), this.mapStockNote, this.render,
 *   __offlineError(), __withTimeout(), WRITE_TIMEOUT_MS, FB, S
 */
const StoreLedger = {
  async recordJournal(entry) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    const category = {
      'Penjualan': 'penjualan',
      'Kulakan': 'kulakan',
      'Penukaran koin': 'beban_promosi',
      'Saldo Awal': 'lainnya',
      'Lainnya': 'lainnya',
    }[entry.type] || 'lainnya';
    await FB.db.collection('journal').add({
      type: entry.direction === 'expense' ? 'pengeluaran' : 'pemasukan',
      category: category,
      amount: Math.round(Number(entry.amount) || 0),
      note: String(entry.description || 'Transaksi'),
      refId: String(entry.orderId || entry.source || ''),
      method: String(entry.method || ''),
      profit: Math.round(Number(entry.profit) || 0),
      itemCount: Math.round(Number(entry.itemCount) || 0),
      createdAt: FB.serverTimestamp(),
    });
  },

  /* Belanja Stok: 1 simpan = 1 supplier/nota → stok nambah (increment),
   * harga tersimpan, jurnal kulakan, arsip stock_notes, modal berkurang. */
  async saveRestock({ supplier, items, total }) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    if (!items || !items.length) throw new Error('Tidak ada barang belanjaan');
    const db = FB.db;
    const FV = FB.FieldValue;
    const ts = FB.serverTimestamp();
    const dateKey = S.todayKey;

    await db.runTransaction(async t => {
      const noteItems = [];
      for (const item of items) {
        if (item.productId) {
          const ref = db.collection('products').doc(item.productId);
          const snap = await t.get(ref);
          if (!snap.exists) throw new Error('Produk "' + item.name + '" tidak ditemukan');
          const pd = snap.data() || {};
          const oldStock = Math.max(0, Number(pd.stock) || 0);
          const oldCost = Math.max(0, Math.round(Number(pd.costPrice) || 0));
          const newCost = item.costChoice === 'new'
            ? item.unitCost
            : (oldStock + item.qtyPcs > 0
              ? Math.round((oldCost * oldStock + item.unitCost * item.qtyPcs) / (oldStock + item.qtyPcs))
              : item.unitCost);
          t.update(ref, {
            stock: FV.increment(item.qtyPcs),
            costPrice: newCost,
            price: Math.round(item.salePrice),
            updatedAt: ts,
          });
        } else {
          const ref = db.collection('products').doc();
          t.set(ref, {
            name: item.name, category: 'Lainnya', unit: 'pcs',
            price: Math.round(item.salePrice), costPrice: item.unitCost,
            stock: item.qtyPcs, lowStockAt: S.lowStockThreshold,
            photoUrl: '', barcode: '', isActive: true,
            createdAt: ts, updatedAt: ts,
          });
        }
        noteItems.push({ name: item.name, qty: item.qtyPcs + ' pcs', price: item.lineTotal });
      }
      t.set(db.collection('journal').doc(), {
        type: 'pengeluaran', category: 'kulakan',
        amount: Math.round(total), note: 'Kulakan · Belanja Stok',
        refId: supplier, method: 'Kas', profit: 0, itemCount: 0, createdAt: ts,
      });
      t.set(db.collection('stock_notes').doc(), {
        date: dateKey, supplier: supplier, items: noteItems,
        total: Math.round(total), source: 'belanja_stok', createdAt: ts,
      });
      t.set(db.collection('store_settings').doc('main'), {
        modal: FV.increment(-Math.round(total)), updatedAt: ts,
      }, { merge: true });
    });
  },

  /* Catatan belanja manual → arsip + jurnal kulakan (tanpa ubah stok) */
  async addManualPurchaseNote({ supplier, items, total }) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    const db = FB.db;
    const ts = FB.serverTimestamp();
    const batch = db.batch();
    batch.set(db.collection('stock_notes').doc(), {
      date: S.todayKey, supplier: supplier,
      items: items.map(name => ({ name: String(name), qty: '1' })),
      total: Math.round(total), source: 'manual', createdAt: ts,
    });
    batch.set(db.collection('journal').doc(), {
      type: 'pengeluaran', category: 'kulakan',
      amount: Math.round(total), note: 'Kulakan · Catatan manual',
      refId: supplier, method: 'Kas', profit: 0, itemCount: 0, createdAt: ts,
    });
    await __withTimeout(batch.commit(), WRITE_TIMEOUT_MS, 'Catat belanja');
  },

  /* Ubah/hapus arsip catatan: HANYA arsip — stok & Pembukuan tidak dihitung ulang */
  async updateStockNote(docId, { supplier, items, total }) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    await FB.db.collection('stock_notes').doc(docId).update({
      supplier: supplier,
      items: items.map(it => ({ name: String(it.name), qty: String(it.qty) })),
      total: Math.round(total),
    });
  },

  async deleteStockNote(docId) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    await FB.db.collection('stock_notes').doc(docId).delete();
  },

  /* Muat stock_notes MANUAL dengan filter tanggal (tidak auto-load) */
  async loadStockNotes(dateStr) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    const db = FB.db;
    let q = db.collection('stock_notes').orderBy('date', 'desc');
    if (dateStr) q = q.where('date', '==', dateStr);
    else q = q.limit(50);
    const snap = await q.get();
    const grouped = {};
    snap.docs.forEach(d => {
      const note = this.mapStockNote(d);
      (grouped[note.date] = grouped[note.date] || []).push(note);
    });
    S.purchaseNotes = grouped;
    this.render('stockNotes');
    return Object.values(grouped).flat().length;
  },
};
