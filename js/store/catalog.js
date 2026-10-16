/* KasirQuh — Store Module: Catalog (Patungan + Resep)
 * FASE 7 refactor store.js (2026-10-16)
 * Berisi: watchPatungan, watchRutinPackages, saveRutinPackage, deleteRutinPackage,
 *   watchHajatanPackages, saveHajatanPackage, deleteHajatanPackage, createPatungan,
 *   joinPatungan, confirmPatunganPayment, setPatunganStatus,
 *   watchRecipes, saveRecipe, deleteRecipe, saveMyRecipe, deleteMyRecipe
 * Dependensi: this.needOnline(), this.assertAdmin(), this.onPublic(), this.onSubError(),
 *   this.render(), this.mapRecipe(), this.cleanRecipeItems(),
 *   __offlineError(), FB, S
 */
const StoreCatalog = {
  /* Patungan Warga: list aktif (limit 20 hemat kuota) */
  watchPatungan() {
    const db = FB.db;
    const tsVal = x => {
      const c = x && x.createdAt;
      if (!c) return 0;
      if (typeof c.toMillis === 'function') return c.toMillis();
      const t = new Date(c).getTime();
      return isNaN(t) ? 0 : t;
    };
    this.onPublic(db.collection('patungan').where('status', 'in', ['aktif', 'penuh']).limit(20).onSnapshot(snap => {
      try {
        S.patunganList = snap.docs.map(d => Object.assign({ id: d.id }, d.data()))
          .sort((a, b) => tsVal(b) - tsVal(a));
        this.render('patungan');
      } catch (e) { console.error('[KasirQuh] patungan render gagal:', e); }
    }, err => this.onSubError('patungan', err)));
  },

  watchRutinPackages() {
    if (!this.needOnline()) return;
    const db = FB.db;
    this.onPublic(db.collection('rutinPackages').where('isActive', '==', true).onSnapshot(snap => {
      try {
        S.rutinPackages = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
        this.render('rutinPackages');
        if (typeof renderRutinAdminList === 'function') { try { renderRutinAdminList(); } catch(e){ console.error('renderRutinAdminList gagal', e); } }
      } catch (e) { console.error('[KasirQuh] rutin render gagal:', e); }
    }, err => this.onSubError('rutinPackages', err)));
  },

  async saveRutinPackage(data, id) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    const db = FB.db, ts = FB.serverTimestamp();
    const base = {
      name: String(data.name || ''),
      description: String(data.description || ''),
      items: Array.isArray(data.items) ? data.items : [],
      isActive: true,
      updatedAt: ts,
    };
    if (id) {
      await db.collection('rutinPackages').doc(id).update(base);
    } else {
      base.createdAt = ts;
      await db.collection('rutinPackages').add(base);
    }
  },

  async deleteRutinPackage(id) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    await FB.db.collection('rutinPackages').doc(id).update({ isActive: false, updatedAt: FB.serverTimestamp() });
  },

  watchHajatanPackages() {
    if (!this.needOnline()) return;
    const db = FB.db;
    this.onPublic(db.collection('hajatanPackages').where('isActive', '==', true).onSnapshot(snap => {
      try {
        S.hajatanPackages = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
        this.render('hajatanPackages');
        if (typeof renderHajatanAdminList === 'function') { try { renderHajatanAdminList(); } catch(e){ console.error('renderHajatanAdminList gagal', e); } }
      } catch (e) { console.error('[KasirQuh] hajatan render gagal:', e); }
    }, err => this.onSubError('hajatanPackages', err)));
  },

  async saveHajatanPackage(data, id) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    const db = FB.db, ts = FB.serverTimestamp();
    const base = {
      name: String(data.name || ''),
      description: String(data.description || ''),
      items: Array.isArray(data.items) ? data.items : [],
      isActive: true,
      updatedAt: ts,
    };
    if (id) {
      await db.collection('hajatanPackages').doc(id).update(base);
    } else {
      base.createdAt = ts;
      await db.collection('hajatanPackages').add(base);
    }
  },

  async deleteHajatanPackage(id) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    await FB.db.collection('hajatanPackages').doc(id).update({ isActive: false, updatedAt: FB.serverTimestamp() });
  },

  async createPatungan(data) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    await FB.db.collection('patungan').add({
      title: String(data.title || ''),
      productName: String(data.productName || ''),
      pricePerSlot: Math.max(0, Math.round(Number(data.pricePerSlot) || 0)),
      totalSlots: Math.min(100, Math.max(2, Math.round(Number(data.totalSlots) || 0))),
      filledSlots: 0,
      participants: [],
      deadline: String(data.deadline || ''),
      note: String(data.note || ''),
      status: 'aktif',
      createdAt: FB.serverTimestamp(),
      updatedAt: FB.serverTimestamp(),
    });
  },

  async joinPatungan(patunganId, slots, payMethod) {
    if (!this.needOnline()) throw __offlineError();
    if (!S.activeCustomerId) throw new Error('Login dulu untuk ikut patungan');
    const db = FB.db, ref = db.collection('patungan').doc(patunganId);
    await db.runTransaction(async t => {
      const snap = await t.get(ref);
      if (!snap.exists) throw new Error('Patungan tidak ditemukan');
      const d = snap.data() || {};
      if (d.status !== 'aktif') throw new Error('Patungan sudah ' + (d.status || 'ditutup'));
      const want = Math.min(10, Math.max(1, Math.round(Number(slots) || 1)));
      const filled = Number(d.filledSlots) || 0, total = Number(d.totalSlots) || 0;
      if (filled + want > total) throw new Error('Slot tersisa ' + (total - filled));
      const parts = Array.isArray(d.participants) ? d.participants.slice() : [];
      const me = parts.find(p => p.customerId === S.activeCustomerId);
      if (me) throw new Error('Kamu sudah ikut patungan ini');
      parts.push({ customerId: S.activeCustomerId, name: S.sessionName || 'Warga', slots: want, joinedAt: new Date().toISOString(), paymentStatus: 'menunggu bayar', paymentMethod: payMethod === 'transfer' ? 'transfer' : 'tunai' });
      t.update(ref, { participants: parts, filledSlots: filled + want, status: (filled + want >= total) ? 'penuh' : 'aktif', updatedAt: FB.serverTimestamp() });
    });
  },

  /* Konfirmasi pembayaran patungan oleh admin: menunggu bayar → lunas */
  async confirmPatunganPayment(patunganId, customerId, method) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    const db = FB.db, ref = db.collection('patungan').doc(patunganId);
    await db.runTransaction(async t => {
      const snap = await t.get(ref);
      if (!snap.exists) throw new Error('Patungan tidak ditemukan');
      const d = snap.data() || {};
      const parts = Array.isArray(d.participants) ? d.participants.slice() : [];
      const idx = parts.findIndex(p => p.customerId === customerId);
      if (idx < 0) throw new Error('Peserta tidak ditemukan');
      parts[idx] = Object.assign({}, parts[idx], {
        paymentStatus: 'lunas',
        paymentMethod: method || parts[idx].paymentMethod || 'tunai',
        paidAt: new Date().toISOString(),
      });
      t.update(ref, { participants: parts, updatedAt: FB.serverTimestamp() });
    });
  },
  async setPatunganStatus(id, status) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    await FB.db.collection('patungan').doc(id).update({ status: status, updatedAt: FB.serverTimestamp() });
  },

  /* Langganan koleksi `recipes` (baca: publik, sesuai aturan).
   * Satu langganan publik permanen — tidak ikut terputus saat ganti mode. */
  watchRecipes() {
    if (this._recipesWatched) return;
    this._recipesWatched = true;
    const db = FB.db;
    this.onPublic(db.collection('recipes').orderBy('createdAt', 'desc').limit(20).onSnapshot(snap => {
      S.recipes = snap.docs.map(d => this.mapRecipe(d));
      this.render('recipes');
    }, err => this.onSubError('recipes', err)));
  },

  /* Resep warung (Ide Masak): admin tulis ke koleksi `recipes` */
  async saveRecipe(data, id) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    const rec = data || {};
    const nama = String(rec.nama || '').trim();
    if (!nama) throw new Error('Isi nama resep dulu');
    const items = this.cleanRecipeItems(rec.items);
    if (!items.length) throw new Error('Isi bahan resep dulu');
    const payload = {
      nama: nama.slice(0, 54),
      desc: String(rec.desc || '').slice(0, 500),
      foto: String(rec.foto || ''),
      items: items,
      updatedAt: FB.serverTimestamp(),
    };
    if (id) {
      await FB.db.collection('recipes').doc(id).update(payload);
    } else {
      payload.createdAt = FB.serverTimestamp();
      await FB.db.collection('recipes').add(payload);
    }
  },

  async deleteRecipe(id) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    await FB.db.collection('recipes').doc(id).delete();
  },

  /* Resepku: pelanggan tulis ke subkoleksi `customers/{uid}/my_recipes` */
  async saveMyRecipe(data) {
    if (!this.needOnline()) throw __offlineError();
    const uid = S.activeCustomerId;
    if (!uid) throw new Error('Masuk dulu sebagai pelanggan');
    const rec = data || {};
    const nama = String(rec.nama || '').trim();
    if (!nama) throw new Error('Isi nama resep dulu');
    const items = this.cleanRecipeItems(rec.items);
    if (!items.length) throw new Error('Isi bahan resep dulu');
    await FB.db.collection('customers').doc(uid).collection('my_recipes').add({
      nama: nama.slice(0, 54),
      desc: String(rec.desc || '').slice(0, 500),
      foto: String(rec.foto || ''),
      items: items,
      createdAt: FB.serverTimestamp(),
      updatedAt: FB.serverTimestamp(),
    });
  },

  async deleteMyRecipe(id) {
    if (!this.needOnline()) throw __offlineError();
    const uid = S.activeCustomerId;
    if (!uid) throw new Error('Masuk dulu sebagai pelanggan');
    await FB.db.collection('customers').doc(uid).collection('my_recipes').doc(id).delete();
  },
};
