/* KasirQuh — Store Module: Checkout/Kasir
 * FASE 9 refactor store.js (2026-10-16)
 * Berisi: checkoutCustomer, completeCashSale
 * CATATAN: fungsi dipindah apa adanya, tidak di-refactor.
 * Dependensi: this.*, __offlineError(), __withTimeout(), WRITE_TIMEOUT_MS, FB, S
 */
const StoreCheckout = {
  /* CHECKOUT pelanggan — WAJIB transaksi Firestore:
   * nomor urut counters/orders → validasi stok (baca ulang) → decrement
   * atomik → buat dokumen orders. Batal total + pesan jujur bila stok kurang. */
  async checkoutCustomer({ cart, fulfillment, address, slot, name, payMethod, transferReference }) {
        if (!this.needOnline()) throw __offlineError();
    const uid = S.activeCustomerId;
    if (!uid) throw new Error('Masuk dulu sebagai pelanggan');
    const entries = Object.entries(cart || {}).filter(([, q]) => q > 0);
    if (!entries.length) throw new Error('Keranjang masih kosong');

    const db = FB.db;
    const FV = FB.FieldValue;
    const orderRef = db.collection('orders').doc();

        return __withTimeout(db.runTransaction(async t => {
            /* 1. nomor urut */
      const counterRef = db.collection('counters').doc('orders');
      const counterSnap = await t.get(counterRef);
            const seq = ((counterSnap.exists ? counterSnap.data().seq : 0) || 0) + 1;

      /* 2. pelanggan: wajib approved; ambil saldo koin terkini */
      const custRef = db.collection('customers').doc(uid);
      const custSnap = await t.get(custRef);
      if (!custSnap.exists || custSnap.data().approvalStatus !== 'approved') {
        throw new Error('Akun belum disetujui warung');
      }
            const coins = Math.max(0, Math.round(Number(custSnap.data().coins) || 0));

      /* 3. validasi stok per item (baca ulang dokumen produk) + harga */
      const items = [];
      let total = 0;
      for (const [pid, qty] of entries) {
        const pRef = db.collection('products').doc(pid);
        const pSnap = await t.get(pRef);
        if (!pSnap.exists) throw new Error('Ada produk yang sudah tidak tersedia');
        const pd = pSnap.data() || {};
        const stock = Math.max(0, Number(pd.stock) || 0);
        if (stock < qty) {
          throw new Error('Stok ' + (pd.name || 'produk') + ' tidak cukup · tersedia ' + stock + ', diminta ' + qty);
        }
        /* Promo kilat: tegakkan batas per pesanan (rantai C13).
         * Angka diambil dari teks aturan admin bila ada ("Maksimal 5 bungkus…"), default 5. Label tidak diubah. */
        if (S.flashProductId && pid === S.flashProductId) {
          const capMatch = String(S.flashRule || '').match(/\d+/);
          const cap = capMatch ? Math.max(1, parseInt(capMatch[0], 10)) : 5;
          if (qty > cap) throw new Error('Promo kilat maksimal ' + cap + ' per pesanan · kurangi jumlah ' + (pd.name || 'produk'));
        }
        const unit = this.customerUnitPrice({
          id: pid,
          price: Math.max(0, Math.round(Number(pd.price) || 0)),
          wholesaleQty: pd.wholesaleQty,
          wholesalePrice: pd.wholesalePrice,
        }, qty);
        const subtotal = unit * qty;
        total += subtotal;
        items.push({ productId: pid, name: String(pd.name || 'Produk'), price: unit, qty: qty, subtotal: subtotal, _ref: pRef });
      }

      /* 4. koin: penukaran (batas admin) + bonus belanja */
            const fee = fulfillment === 'delivery' ? 5000 : 0;
      const fullTotal = total + fee;
      let redeemCoins = 0, redeemValue = 0;
      if (S.coinProgramEnabled && S.coinRedeemEnabled && S.coinValue > 0 && S.coinRedeemPercent > 0) {
        const maxValue = Math.floor(total * S.coinRedeemPercent / 100);
        redeemCoins = Math.max(0, Math.min(coins, Math.floor(maxValue / S.coinValue)));
        redeemValue = redeemCoins * S.coinValue;
      }
      if (redeemCoins > coins) throw new Error('Saldo koin tidak cukup');
      const paidTotal = Math.max(0, fullTotal - redeemValue);
      let earned = 0;
      if (S.coinProgramEnabled && S.coinEvents.spend && S.coinSpendReward > 0 && S.coinSpendRule > 0) {
        earned = Math.floor(total / S.coinSpendRule) * S.coinSpendReward;
      }

      /* 5. tulis atomik */
      const code = 'WM-' + String(seq).padStart(6, '0');
      const ts = FB.serverTimestamp();
      t.set(counterRef, { seq: seq }, { merge: true });
      items.forEach(it => {
        t.update(it._ref, { stock: FV.increment(-it.qty), updatedAt: ts });
      });
      const coinDelta = earned - redeemCoins;
      if (coinDelta !== 0) t.update(custRef, { coins: FV.increment(coinDelta) });
      t.set(orderRef, {
        code: code,
        customerId: uid,
        customerName: name,
        items: items.map(it => ({ productId: it.productId, name: it.name, price: it.price, qty: it.qty, subtotal: it.subtotal })),
        total: paidTotal,
        fullTotal: fullTotal,
        paymentMethod: payMethod === 'transfer' ? 'transfer' : 'cod',
        transferReference: payMethod === 'transfer' ? String(transferReference || '').slice(0, 80) : '',
        fulfillment: fulfillment,
        status: 'menunggu',
        note: fulfillment === 'delivery' ? ('Diantar · ' + address) : 'Ambil di warung',
        coinUsed: redeemCoins,
        coinValue: redeemValue,
        earnedCoins: earned,
        createdAt: ts,
        updatedAt: ts,
      });
      if (redeemCoins > 0) {
        t.set(db.collection('coin_ledger').doc(), {
          customerId: uid, amount: -redeemCoins, reason: 'tukar',
          label: 'Ditukar pada #' + code,
          detail: 'Potongan Rp' + redeemValue.toLocaleString('id-ID'),
          orderId: orderRef.id, createdAt: ts,
        });
      }
      if (earned > 0) {
        t.set(db.collection('coin_ledger').doc(), {
          customerId: uid, amount: earned, reason: 'belanja',
          label: 'Bonus belanja #' + code,
          detail: 'Rp' + total.toLocaleString('id-ID') + ' belanja',
          orderId: orderRef.id, createdAt: ts,
        });
      }

      return {
        code: code,
        total: paidTotal,
        fullTotal: fullTotal,
        redeemCoins: redeemCoins,
        redeemValue: redeemValue,
        earned: earned,
        method: payMethod === 'transfer' ? 'Transfer' : (fulfillment === 'delivery' ? 'COD' : 'Bayar di warung'),
        itemCount: entries.reduce((a, [, q]) => a + q, 0),
      };
    }), WRITE_TIMEOUT_MS, 'Checkout');
  },

  /* Kasir admin (tunai + kembalian): decrement stok atomik (batch) +
   * jurnal pemasukan penjualan. Struk tetap dirender app.js. */
  async completeCashSale({ lines, total, profit, itemCount, redeemCoins, earnedCoins }) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    if (!lines || !lines.length) throw new Error('Transaksi masih kosong');
    const db = FB.db;
    const FV = FB.FieldValue;
    const ts = FB.serverTimestamp();
    const batch = db.batch();
    lines.forEach(l => {
      batch.update(db.collection('products').doc(l.productId), {
        stock: FV.increment(-l.qty), updatedAt: ts,
      });
    });
    /* Opsi A: catat member jika teridentifikasi di kasir */
    const km = (typeof S !== 'undefined' && S.kasirMember) || null;
    /* Opsi B: koin tukar & dapat */
    redeemCoins = Math.max(0, Math.round(Number(redeemCoins) || 0));
    earnedCoins = Math.max(0, Math.round(Number(earnedCoins) || 0));
    const coinVal = Math.max(1, Math.round(Number(S.coinValue) || 1));
    /* [FIX SOP 2026-10-16] Cegah koin minus: S.kasirMember.coins dibaca sekali
     * saat scan (bisa stale jika saldo berubah sebelum bayar).
     * Baca ulang saldo aktual, clamp redeemCoins, hitung ulang total konsisten. */
    if (km && km.uid && redeemCoins > 0) {
      let actualCoins = 0;
      try {
        const cs = await db.collection('customers').doc(km.uid).get();
        actualCoins = Math.max(0, Math.round(Number(cs.data() && cs.data().coins) || 0));
      } catch (e) { actualCoins = 0; }
      if (redeemCoins > actualCoins) {
        redeemCoins = actualCoins;
        const rawTotal = lines.reduce((s, l) => s + (Number(l.total) || 0), 0);
        total = Math.max(0, rawTotal - redeemCoins * coinVal);
      }
    }
    batch.set(db.collection('journal').doc(), {
      type: 'pemasukan', category: 'penjualan',
      amount: Math.round(total),
      note: 'Penjualan · Kasir', refId: '', method: 'Tunai',
      profit: Math.round(profit || 0), itemCount: itemCount || 0,
      customerId: km ? km.uid : '', customerName: km ? km.name : '',
      coinUsed: redeemCoins, coinValue: redeemCoins * coinVal, earnedCoins: earnedCoins,
      createdAt: ts,
    });
    if (km && km.uid) {
      const coinDelta = earnedCoins - redeemCoins;
      if (coinDelta !== 0) batch.update(db.collection('customers').doc(km.uid), { coins: FV.increment(coinDelta) });
      if (redeemCoins > 0) {
        batch.set(db.collection('coin_ledger').doc(), {
          customerId: km.uid, amount: -redeemCoins, reason: 'tukar',
          label: 'Ditukar di kasir',
          detail: 'Potongan Rp' + (redeemCoins * coinVal).toLocaleString('id-ID'),
          createdAt: ts,
        });
        /* Beban promosi untuk koin yang ditukar */
        batch.set(db.collection('journal').doc(), {
          type: 'pengeluaran', category: 'beban_promosi',
          amount: redeemCoins * coinVal,
          note: 'Penukaran koin · ' + redeemCoins.toLocaleString('id-ID') + ' koin (kasir)',
          refId: '', method: 'Koin Warga', profit: 0, itemCount: 0,
          customerId: km.uid, customerName: km.name,
          createdAt: ts,
        });
      }
      if (earnedCoins > 0) {
        batch.set(db.collection('coin_ledger').doc(), {
          customerId: km.uid, amount: earnedCoins, reason: 'belanja',
          label: 'Bonus belanja kasir',
          detail: 'Rp' + Math.round(total + redeemCoins * coinVal).toLocaleString('id-ID') + ' belanja',
          createdAt: ts,
        });
      }
    }
    /* Naikkan counter penjualan per produk agar masuk Sedang Laris */
    lines.forEach(l => {
      batch.update(db.collection('products').doc(l.productId), {
        totalTerjual: FV.increment(l.qty),
      });
    });
    await __withTimeout(batch.commit(), WRITE_TIMEOUT_MS, 'Kasir tunai');
  },

};
