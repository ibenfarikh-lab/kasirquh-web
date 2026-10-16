/* KasirQuh — Store Module: Orders
 * FASE 4 refactor store.js (2026-10-16)
 * Berisi: settleOrder, rejectTransfer, setOrderStatus, cancelOrder, deleteOrder
 * Dependensi: this.needOnline(), this.assertAdmin(), __offlineError(), FB
 */
const StoreOrders = {
  async settleOrder(orderId, trigger) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    const db = FB.db;
    const ts = FB.serverTimestamp();
    await db.runTransaction(async t => {
      const ref = db.collection('orders').doc(orderId);
      const snap = await t.get(ref);
      if (!snap.exists) throw new Error('Pesanan tidak ditemukan');
      const d = snap.data() || {};
      if (d.status === 'selesai') return;
      if (d.status !== 'menunggu' && d.status !== 'dikemas' && d.status !== 'dikirim') {
        throw new Error('Pesanan tidak dapat diselesaikan');
      }
      /* Laba: harga jual saat checkout − modal saat ini */
      let profit = 0, itemCount = 0;
      for (const it of (d.items || [])) {
        const qty = Number(it.qty) || 0;
        itemCount += qty;
        let cost = 0;
        if (it.productId) {
          const pSnap = await t.get(db.collection('products').doc(it.productId));
          if (pSnap.exists) cost = Math.max(0, Math.round(Number(pSnap.data().costPrice) || 0));
        }
        profit += Math.max(0, (Math.round(Number(it.price) || 0) - cost)) * qty;
      }
      t.update(ref, { status: 'selesai', updatedAt: ts });
      const total = Math.round(Number(d.total) || 0);
      t.set(db.collection('journal').doc(), {
        type: 'pemasukan', category: 'penjualan', amount: total,
        note: 'Penjualan · Online', refId: String(d.code || orderId),
        method: d.paymentMethod === 'transfer' ? 'Transfer' : (d.fulfillment === 'delivery' ? 'COD' : 'Bayar di warung'),
        profit: profit, itemCount: itemCount, createdAt: ts,
      });
      const coinValue = Math.round(Number(d.coinValue) || 0);
      if (coinValue > 0) {
        t.set(db.collection('journal').doc(), {
          type: 'pengeluaran', category: 'beban_promosi', amount: coinValue,
          note: 'Penukaran koin · ' + String(d.code || orderId),
          refId: String(d.code || orderId), method: 'Koin Warga',
          profit: 0, itemCount: 0, createdAt: ts,
        });
      }
    });
  },

  /* Tolak bukti transfer (admin): status penolakan persisten di dokumen
   * `orders` (transferStatus + rejectedAt + reason). Kartu tidak hilang
   * dan tidak kembali "PERIKSA" saat snapshot orders rebuild. */
  async rejectTransfer(orderId, reason) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    const db = FB.db;
    const ref = db.collection('orders').doc(orderId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Pesanan tidak ditemukan');
    const d = snap.data() || {};
    if (d.status === 'selesai') throw new Error('Pesanan sudah lunas, tidak dapat ditolak');
    await ref.update({
      transferStatus: 'rejected',
      transferRejectedAt: FB.serverTimestamp(),
      transferRejectReason: String(reason || ''),
      updatedAt: FB.serverTimestamp(),
    });
  },

  /* Ubah status pesanan: menunggu → dikemas → dikirim (admin) */
  async setOrderStatus(orderId, status) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    const allowed = ['dikemas', 'dikirim'];
    if (!allowed.includes(status)) throw new Error('Status tidak valid');
    const db = FB.db;
    const ref = db.collection('orders').doc(orderId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Pesanan tidak ditemukan');
    const d = snap.data() || {};
    if (d.status === 'selesai' || d.status === 'dibatalkan') throw new Error('Pesanan sudah selesai/dibatalkan');
    await ref.update({ status: status, updatedAt: FB.serverTimestamp() });
  },
  /* Batalkan pesanan (admin): kembalikan stok + koin, status → dibatalkan */
  async cancelOrder(orderId) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    const db = FB.db;
    const FV = FB.FieldValue;
    const ts = FB.serverTimestamp();
    await db.runTransaction(async t => {
      const ref = db.collection('orders').doc(orderId);
      const snap = await t.get(ref);
      if (!snap.exists) throw new Error('Pesanan tidak ditemukan');
      const d = snap.data() || {};
      if (d.status !== 'menunggu') throw new Error('Pesanan sudah diproses, tidak dapat dibatalkan');
      (d.items || []).forEach(it => {
        if (it.productId) {
          t.update(db.collection('products').doc(it.productId), {
            stock: FV.increment(Number(it.qty) || 0), updatedAt: ts,
          });
        }
      });
      const coinBack = Math.round(Number(d.coinUsed) || 0) - Math.round(Number(d.earnedCoins) || 0);
      if (coinBack !== 0 && d.customerId) {
        t.update(db.collection('customers').doc(d.customerId), { coins: FV.increment(coinBack) });
      }
      if (d.coinUsed > 0 && d.customerId) {
        t.set(db.collection('coin_ledger').doc(), {
          customerId: d.customerId, amount: Math.round(d.coinUsed), reason: 'tukar',
          label: 'Koin kembali · #' + (d.code || ''), detail: 'Pesanan dibatalkan',
          orderId: ref.id, createdAt: ts,
        });
      }
      if (d.earnedCoins > 0 && d.customerId) {
        t.set(db.collection('coin_ledger').doc(), {
          customerId: d.customerId, amount: -Math.round(d.earnedCoins), reason: 'belanja',
          label: 'Bonus dibatalkan · #' + (d.code || ''), detail: 'Pesanan dibatalkan',
          orderId: ref.id, createdAt: ts,
        });
      }
      t.update(ref, { status: 'dibatalkan', updatedAt: ts });
    });
  },

  async deleteOrder(orderId) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    await FB.db.collection('orders').doc(orderId).delete();
  },
};
