/* KasirQuh — Store Module: Derived (Data Turunan)
 * FASE 12 refactor store.js (2026-10-16) — FASE TERAKHIR
 * Berisi: rebuildRiwayat, rebuildPopular, refreshCustomerSpend,
 *   rebuildInboxDebounced, rebuildInbox, pushLocalInbox
 * CATATAN: data turunan — dihitung jujur dari data nyata, bukan siluman.
 */
const StoreDerived = {
  rebuildRiwayat() {
    const byProduct = {};
    (S.onlineOrders || []).forEach(order => {
      (order.stockLines || []).forEach(line => {
        if (!line.productId || byProduct[line.productId]) return;
        byProduct[line.productId] = {
          productId: line.productId,
          terakhirDibeli: order._dateKey || S.todayKey,
          qty: line.qty,
        };
      });
    });
    S.riwayatBelanjaPelanggan = Object.values(byProduct);
  },

  rebuildPopular() {
    const agg = {};
    if (S.sessionRole === 'admin') {
      (S.onlineOrders || []).forEach(order => {
        (order.stockLines || []).forEach(line => {
          if (line.productId) agg[line.productId] = (agg[line.productId] || 0) + line.qty;
        });
      });
      /* Tambah dari counter penjualan kasir (totalTerjual di produk) */
      (S.products || []).forEach(prod => {
        const t = Number(prod.totalTerjual) || 0;
        if (t > 0 && prod.id) agg[prod.id] = (agg[prod.id] || 0) + t;
      });
      /* 8 terlaris → persist ke store_settings agar tamu/pelanggan ikut dapat (rantai C2).
       * Hanya tulis bila daftar berubah (cegah loop tulis→snapshot→tulis);
       * lewati bila pesanan belum termuat agar tidak menimpa dengan daftar kosong. */
      const top8 = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([pid]) => pid);
      const curTop = ((S.storeSettings || {}).topProductIds || []).join('|');
      if (top8.length && top8.join('|') !== curTop) {
        this.saveStoreSettings({ topProductIds: top8 }).catch(() => {});
      }
    } else {
      /* Tamu/pelanggan: pakai agregat admin bila sudah dihitung (topProductIds) */
      const top = (S.storeSettings && S.storeSettings.topProductIds) || [];
      top.forEach((pid, i) => { agg[pid] = 1000 - i; });
    }
    S.penjualanGlobal = Object.entries(agg).map(([productId, totalTerjual]) => ({ productId, totalTerjual }));
  },

  refreshCustomerSpend() {
    const spendMap = {}, histMap = {};
    (S.onlineOrders || []).forEach(order => {
      if (!order.customerId) return;
      spendMap[order.customerId] = (spendMap[order.customerId] || 0) + order.total;
      (histMap[order.customerId] = histMap[order.customerId] || []).push([
        '#' + order.id + ' · ' + this.orderStatusLabel(order._rawStatus),
        order.time + ' · Rp' + order.total.toLocaleString('id-ID'),
      ]);
    });
    (S.customerData || []).forEach(c => {
      c.spend = spendMap[c.id] || 0;
      c.history = histMap[c.id] || [];
    });
    this.refreshThreadNames();
  },

  /* Inbox admin: diturunkan dari koleksi live (bukan notifikasi siluman).
   * Item lokal sesi (titip/share) dipertahankan; status "dibaca" sesi ini
   * ikut dipertahankan antar rebuild. */
  _rebuildInboxTimer: null,
  rebuildInboxDebounced() {
    if (this._rebuildInboxTimer) clearTimeout(this._rebuildInboxTimer);
    this._rebuildInboxTimer = setTimeout(() => {
      this._rebuildInboxTimer = null;
      this.rebuildInbox();
    }, 500);
  },
  rebuildInbox() {
    const prevRead = {};
    (S.inboxItems || []).forEach(x => { if (x && x.read) prevRead[x.id] = true; });
    const local = (S.inboxItems || []).filter(x => x && this.localInboxKinds.indexOf(x.kind) >= 0);
    const persisted = new Set(S.inboxReadIds || []);
    const read = id => !!prevRead[id] || persisted.has(id);
    const derived = [];

    (S.pendingCustomers || []).filter(x => x.status !== 'rejected').forEach(x => {
      derived.push({
        id: 'notif-signup-' + x.id, kind: 'signup', icon: 'user',
        title: 'Pendaftaran ' + x.name + ' menunggu persetujuan',
        time: x.meta || 'Baru saja', target: 'approvals', read: read('notif-signup-' + x.id),
      });
    });
    (S.onlineOrders || []).filter(o => o.status === 'active').slice(0, 20).forEach(o => {
      derived.push({
        id: 'order-' + o.id, kind: 'order', icon: 'bag',
        title: '#' + o.id + ' · ' + o.name, time: o.time,
        target: 'online', read: read('order-' + o.id),
      });
    });
    (S.titipRequests || []).filter(r => r.status === 'baru').slice(0, 20).forEach(r => {
      derived.push({
        id: 'titip-' + r.id, kind: 'titip', icon: 'bag',
        title: 'Titipan · ' + r.item + ' (' + r.customerName + ')',
        time: r.time || 'Baru saja', target: 'dashboard', read: read('titip-' + r.id),
      });
    });
    (S.products || []).filter(p => p.stock <= S.lowStockThreshold).slice(0, 20).forEach(p => {
      derived.push({
        id: 'notif-stock-' + p.id, kind: 'stock', icon: 'box',
        title: 'Stok menipis · ' + p.name + ' (sisa ' + p.stock + ')',
        time: 'Perlu dikulak', target: 'produk', read: read('notif-stock-' + p.id),
      });
    });
    Object.entries(S.directThreads || {}).forEach(([id, t]) => {
      if (t && t.unread > 0) {
        derived.push({
          id: 'notif-chat-' + id, kind: 'chat', icon: 'chat',
          title: 'Chat baru dari ' + t.name, time: 'Baru saja',
          target: 'chat', read: read('notif-chat-' + id),
        });
      }
    });

    S.inboxItems = [...local, ...derived];
    this.render('inbox');
  },

  /* Item inbox lokal sesi (titip/share) — tidak ditimpa rebuild turunan */
  pushLocalInbox(item) {
    S.inboxItems = [item, ...(S.inboxItems || [])];
    this.render('inbox');
  },
};
