/* KasirQuh — Store Module: Chat
 * FASE 8 refactor store.js (2026-10-16)
 * Berisi: startCustomerSubs, ensureCustomerThread, startAdminSubs, upsertAdminThread,
 *   refreshThreadNames, watchThreadMessages, stopWatchingThread, resolveThreadId,
 *   sendChatMessage, markThreadRead, sendRumpi, deleteRumpi, likeRumpi
 * Dependensi: this.*, onPublic/onRole, __offlineError(), __withTimeout(), FB, S, dll.
 * CATATAN: fungsi dipindah apa adanya, tidak di-refactor.
 */
const StoreChat = {
  async startCustomerSubs(uid) {
    const db = FB.db;

    /* Dokumen sendiri: koin + nama + status persetujuan (live) */
    this.onRole(db.collection('customers').doc(uid).onSnapshot(snap => {
      if (!snap.exists) return;
      const data = snap.data();
      S.myCustomerDoc = Object.assign({ id: uid }, data);
      if (Array.isArray(data.priceAlerts)) S.priceAlerts = data.priceAlerts;
      if (Array.isArray(data.routines)) S.routines = data.routines;
      if (data.approvalStatus === 'rejected') {
        this.notifyUser('Pendaftaran ditolak warung');
        FB.auth.signOut();
        return;
      }
      if (data.approvalStatus !== 'approved') {
        /* JANGAN signOut di sini — status non-approved pada subscription live
         * sering kali transient (cache basi / race saat login ulang).
         * SignOut agresif menyebabkan sesi terputus berulang (temuan R4).
         * Penolakan eksplisit sudah ditangani di atas ('rejected').
         * Cukup tampilkan mode terbatas; sesi Firebase dipertahankan. */
        this.render('session', 'profile');
        return;
      }
      S.coinBalance = Math.max(0, Math.round(Number(data.coins) || 0));
      if (data.name) S.sessionName = data.name;
      this.render('coins', 'profile', 'session', 'checkin');
    }, err => this.onSubError('customers/' + uid, err)));

    /* Pesanan milik sendiri */
    this.onRole(db.collection('orders').where('customerId', '==', uid)
      .limit(50).onSnapshot(snap => {
        S.onlineOrders = this.sortDocs(snap.docs, 'createdAt').map(d => this.mapOrder(d)).filter(o => o);
        /* Pulihkan banner pesanan aktif — hanya bila slot masih kosong */
        if (S.activeOrder == null) {
          const first = (S.onlineOrders || []).find(o => o.status === 'active');
          if (first) {
            const step = { menunggu: 0, dikemas: 1, dikirim: 2 }[first._rawStatus] || 0;
            S.activeOrder = {
              id: first.id,
              customerId: uid,
              status: ['Menunggu konfirmasi', 'Sedang dikemas', 'Sedang dikirim'][step],
              detail: (first.address || '') + (first.method ? ' · ' + first.method : ''),
              method: first.method,
              step: step,
            };
          }
        } else {
          /* Pesanan yang dilacak sudah selesai → kosongkan banner */
          const tracked = (S.onlineOrders || []).find(o => o.id === S.activeOrder.id);
          if (tracked && tracked.status !== 'active') S.activeOrder = null;
        }
        this.rebuildRiwayat();
        this.rebuildPopular();
        this.render('orders');
      }, err => this.onSubError('orders', err)));

    /* Riwayat koin sendiri */
    this.onRole(db.collection('coin_ledger').where('customerId', '==', uid)
      .limit(60).onSnapshot(snap => {
        S.coinHistory = this.sortDocs(snap.docs, 'createdAt').map(d => this.mapCoinEntry(d));
        this.render('coins');
      }, err => this.onSubError('coin_ledger', err)));

    /* Catatan & tagihan dari toko (kasbon digital) */
    this.onRole(db.collection('customer_notes').where('customerId', '==', uid)
      .limit(60).onSnapshot(snap => {
        S.customerNotesList = this.sortDocs(snap.docs, 'createdAt').map(d => this.mapCustomerNote(d));
        this.render('customerNotes');
      }, err => this.onSubError('customer_notes', err)));

    /* Ide Masak / resep warung (koleksi `recipes`) */
    this.watchRecipes();

    /* Resepku pelanggan (subkoleksi sendiri) — diam bila aturan belum dipublish */
    this.onRole(db.collection('customers').doc(uid).collection('my_recipes')
      .orderBy('createdAt', 'desc').limit(20).onSnapshot(snap => {
        S.myRecipes = snap.docs.map(d => this.mapRecipe(d));
        this.render('recipes');
      }, err => this.onSubError('my_recipes', err, true)));

    /* Chat toko: thread deterministik `chat_threads/{uid}` (skema
     * disatukan Tahap 1 Harmonisasi — tanpa prefix). Pastikan dokumen
     * thread ADA sebelum langganan dipasang. Rules `messages` memakai
     * get() ke dokumen thread untuk cek kepemilikan; tanpa dokumen →
     * permission-denied untuk pelanggan yang belum pernah chat. */
    const threadId = uid;
    const threadRef = db.collection('chat_threads').doc(threadId);
    try {
      await threadRef.set({ type: 'toko', customerId: uid, createdAt: FB.serverTimestamp() }, { merge: true });
    } catch (e) { /* langganan tetap dipasang; kegagalan tampil jujur via onSubError */ }
    /* MIGRASI SKEMA (Tahap 1 Harmonisasi): salin riwayat thread lama
     * `toko_<uid>` → `{uid}` (termasuk messages). Idempoten via flag
     * `migratedTo`; dokumen lama TIDAK dihapus (Tim Utama verifikasi
     * dulu). Best-effort: kegagalan tidak mengganggu sesi. */
    try {
      const legacyRef = db.collection('chat_threads').doc('toko_' + uid);
      const legacySnap = await legacyRef.get();
      const legacyData = legacySnap.exists ? (legacySnap.data() || {}) : null;
      if (legacyData && !legacyData.migratedTo) {
        const tsMillis = v => (v && typeof v.toMillis === 'function') ? v.toMillis() : String(v == null ? '' : v);
        const msgKey = m => String(m.senderId || '') + '|' + String(m.text || '') + '|' + tsMillis(m.createdAt);
        const [legacyMsgs, existingMsgs] = await Promise.all([
          legacyRef.collection('messages').orderBy('createdAt', 'asc').get(),
          threadRef.collection('messages').orderBy('createdAt', 'asc').get(),
        ]);
        const seen = new Set(existingMsgs.docs.map(d => msgKey(d.data() || {})));
        const batch = db.batch();
        legacyMsgs.docs.forEach(md => {
          const m = md.data() || {};
          if (seen.has(msgKey(m))) return;
          batch.set(threadRef.collection('messages').doc(), {
            senderId: m.senderId || uid,
            senderRole: m.senderRole || 'customer',
            text: String(m.text || ''),
            createdAt: m.createdAt || FB.serverTimestamp(),
          });
        });
        if (legacyData.lastMessage && !((await threadRef.get()).data() || {}).lastMessage) {
          batch.set(threadRef, {
            lastMessage: legacyData.lastMessage,
            updatedAt: legacyData.updatedAt || FB.serverTimestamp(),
            unreadCustomer: Number(legacyData.unreadCustomer) || 0,
            unreadAdmin: Number(legacyData.unreadAdmin) || 0,
          }, { merge: true });
        }
        batch.set(legacyRef, { migratedTo: uid, migratedAt: FB.serverTimestamp() }, { merge: true });
        await batch.commit();
      }
    } catch (e) { /* migrasi best-effort */ }
    /* PEMBERSIHAN OTOMATIS (Tahap 1 Harmonisasi, disetujui user):
     * hapus dokumen lama `toko_<uid>` beserta messages-nya.
     * ATURAN KERAS: hanya bila flag `migratedTo` ADA dan milik pelanggan
     * ini — tanpa flag = riwayat belum pindah = JANGAN disentuh.
     * Lazy per pelanggan, best-effort, tidak mengganggu sesi. */
    try {
      const legacyRef = db.collection('chat_threads').doc('toko_' + uid);
      const legacySnap = await legacyRef.get();
      const legacyData = legacySnap.exists ? (legacySnap.data() || {}) : null;
      if (legacyData && legacyData.migratedTo === uid) {
        const legacyMsgs = await legacyRef.collection('messages').get();
        const targets = legacyMsgs.docs.map(d => d.ref);
        targets.push(legacyRef); // induk dihapus PALING AKHIR
        for (let i = 0; i < targets.length; i += 400) {
          const batch = db.batch();
          targets.slice(i, i + 400).forEach(ref => batch.delete(ref));
          await batch.commit();
        }
      }
    } catch (e) { /* pembersihan best-effort */ }
    this.onRole(threadRef.onSnapshot(snap => {
      const thread = this.ensureCustomerThread(uid);
      if (snap.exists) {
        const d = snap.data() || {};
        thread.customerUnread = Number(d.unreadCustomer) || 0;
      }
      this.render('chat');
    }, err => this.onSubError('chat_threads', err)));
    let isFirstChatLoad = true;
    /* Samakan ketahanan dengan sisi admin: flag memuat + get() fast-path +
     * timeout, karena listener realtime terbukti bisa macet tanpa callback
     * di sebagian perangkat. */
    const custThread0 = this.ensureCustomerThread(uid);
    custThread0._loadingMessages = true;
    const custMsgRef = threadRef.collection('messages').orderBy('createdAt', 'desc').limit(30);
    custMsgRef.get().then(snap => {
      const thread = S.directThreads.toko;
      if (!thread) return;
      thread._loadingMessages = false;
      thread.messages = snap.docs.map(d => this.mapThreadMessage(d)).reverse();
      isFirstChatLoad = false;
      this.render('chat');
    }).catch(() => { /* listener yang menangani error */ });
    setTimeout(() => {
      const thread = S.directThreads.toko;
      if (thread && thread._loadingMessages) {
        thread._loadingMessages = false;
        this.render('chat');
      }
    }, 15000);
    this.onRole(custMsgRef.onSnapshot(snap => {
      const thread = this.ensureCustomerThread(uid);
      thread._loadingMessages = false;
      thread.messages = snap.docs.map(d => this.mapThreadMessage(d)).reverse();
      if (!isFirstChatLoad && typeof playNotification === 'function') {
        snap.docChanges().forEach(function(change){
          if (change.type !== 'added') return;
          var md = change.doc.data() || {};
          var senderRole = md.senderRole || '';
          if (senderRole === 'admin') {
            try { playNotification('chat', (window.S && S.soundSettings && S.soundSettings.chat) || 'system', false); } catch(e) {}
          }
        });
      }
      isFirstChatLoad = false;
      this.render('chat');
    }, err => {
      const thread = S.directThreads.toko;
      if (thread) thread._loadingMessages = false;
      this.onSubError('chat messages', err);
      this.render('chat');
    }));
  },

  ensureCustomerThread(uid) {
    let thread = S.directThreads.toko;
    if (!thread) {
      thread = { name: 'Warunge Mimi', initial: 'W', messages: [], unread: 0, customerUnread: 0 };
      S.directThreads.toko = thread;
    }
    return thread;
  },

  startAdminSubs() {
    const db = FB.db;

    /* Promo carousel: admin melihat SEMUA (termasuk nonaktif) agar bisa mengaktifkan ulang.
     * Tanpa ini, promo yang dinonaktifkan hilang dari daftar kelola selamanya. */
    this.onRole(db.collection('promos').limit(30).onSnapshot(snap => {
      S.promosAdmin = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
      this.render('promos');
    }, err => this.onSubError('promos_admin', err)));

    this.onRole(db.collection('orders').orderBy('createdAt', 'desc').limit(30).onSnapshot(snap => {
      S.onlineOrders = snap.docs.map(d => this.mapOrder(d)).filter(o => o);
      this.rebuildPopular();
      this.refreshCustomerSpend();
      this.rebuildInboxDebounced();
      this.render('orders', 'inbox');
    }, err => this.onSubError('orders', err)));

    this.onRole(db.collection('customers').where('approvalStatus', '==', 'approved').onSnapshot(snap => {
      S.customerData = snap.docs.map(d => this.mapCustomer(d));
      this.refreshCustomerSpend();
      this.rebuildInboxDebounced();
      this.render('customers');
    }, err => this.onSubError('customers', err)));

    this.onRole(db.collection('customers').where('approvalStatus', 'in', ['pending', 'rejected']).onSnapshot(snap => {
      S.pendingCustomers = snap.docs.map(d => this.mapPending(d));
      this.rebuildInboxDebounced();
      this.render('customers', 'inbox');
    }, err => this.onSubError('customers pending', err)));

    this.onRole(db.collection('journal').orderBy('createdAt', 'desc').limit(200).onSnapshot(snap => {
      S.journalEntries = snap.docs.map(d => this.mapJournal(d));
      this.render('journal');
    }, err => this.onSubError('journal', err)));

    /* stock_notes TIDAK auto-load (keputusan user): admin tekan refresh manual */

    this.onRole(db.collection('customer_notes').orderBy('createdAt', 'desc').limit(30).onSnapshot(snap => {
      S.adminCustomerNotes = snap.docs.map(d => this.mapCustomerNote(d));
      this.render('kasbon');
    }, err => this.onSubError('customer_notes', err)));

    /* Catatan Toko (pengingat internal admin) */
    this.onRole(db.collection('store_memos').orderBy('createdAt', 'desc').limit(30).onSnapshot(snap => {
      S.storeMemos = snap.docs.map(d => {
        const dd = d.data() || {};
        return {
          id: d.id,
          title: String(dd.title || ''),
          body: String(dd.body || dd.text || ''),
          time: dd.createdAt ? this.dateTimeOf(dd.createdAt) : 'Baru saja',
        };
      });
      this.render('memos');
    }, err => this.onSubError('store_memos', err)));

    /* Ide Masak / resep warung (koleksi `recipes`) */
    this.watchRecipes();

    /* Titipan barang pelanggan */
    this.onRole(db.collection('titip_requests').orderBy('createdAt', 'desc').limit(50).onSnapshot(snap => {
      S.titipRequests = snap.docs.map(d => {
        const dd = d.data() || {};
        return {
          id: d.id,
          customerId: String(dd.customerId || ''),
          customerName: String(dd.customerName || 'Pelanggan'),
          item: String(dd.item || ''),
          note: String(dd.note || ''),
          method: String(dd.method || ''),
          status: String(dd.status || 'baru'),
          time: dd.createdAt ? this.dateTimeOf(dd.createdAt) : 'Baru saja',
        };
      });
      this.rebuildInboxDebounced();
      this.render('inbox');
    }, err => this.onSubError('titip_requests', err)));

    var isFirstAdminChatLoad = true;
    var adminChatPrevUnread = {};
    var self = this;
    /* Handler dipisah agar bisa dipakai get() fast-path + onSnapshot.
     * Listener realtime terbukti bisa macet tanpa callback di sebagian
     * perangkat — fast-path memastikan daftar tetap tampil. */
    function handleAdminChatSnap(snap) {
        if (!isFirstAdminChatLoad && typeof playNotification === 'function') {
          snap.docChanges().forEach(function(change){
            var d = change.doc.data() || {};
            var unread = Number(d.unreadAdmin) || 0;
            var prevUnread = adminChatPrevUnread[change.doc.id] || 0;
            if ((change.type === 'added' && unread > 0) || (change.type === 'modified' && unread > prevUnread)) {
              try { playNotification('chat', (window.S && S.soundSettings && S.soundSettings.chat) || 'system', false); } catch(e) {}
            }
            adminChatPrevUnread[change.doc.id] = unread;
          });
        }
        isFirstAdminChatLoad = false;
        snap.docChanges().forEach(function(change){ var dd = change.doc.data() || {}; adminChatPrevUnread[change.doc.id] = Number(dd.unreadAdmin) || 0; });
        self.sortDocs(snap.docs.filter(d => (d.data()||{}).type === 'toko'), 'updatedAt').forEach(d => self.upsertAdminThread(d));
        self.rebuildInboxDebounced();
        self.render('chat', 'inbox');
    }
    var adminChatRef = db.collection('chat_threads').orderBy('updatedAt', 'desc').limit(50);
    /* Fast-path: ambil sekali via get() agar daftar tidak tergantung penuh
     * pada listener realtime. */
    adminChatRef.get().then(function(snap){
      handleAdminChatSnap(snap);
    }).catch(function(){ /* listener yang menangani error */ });
    this.onRole(adminChatRef.onSnapshot(function(snap){
        // Filter type toko di klien (seperti orders yang bekerja pakai orderBy)
        handleAdminChatSnap(snap);
      }, err => this.onSubError('chat_threads', err)));
  },

  upsertAdminThread(doc) {
    const d = doc.data() || {};
    const customerId = String(d.customerId || doc.id.replace(/^toko_/, ''));
    const customer = (S.customerData || []).find(c => c.id === customerId);
    const name = customer ? customer.name : 'Pelanggan';
    let thread = S.directThreads[doc.id];
    if (!thread) {
      thread = { name: name, initial: (name.charAt(0) || '?').toUpperCase(), messages: [], unread: 0, customerUnread: 0 };
      S.directThreads[doc.id] = thread;
    }
    thread.name = name;
    thread.initial = (name.charAt(0) || '?').toUpperCase();
    thread.photoURL = customer ? String(customer.photoURL || '') : '';
    thread.unread = Number(d.unreadAdmin) || 0;
    thread.lastMessage = String(d.lastMessage || '');
    return thread;
  },

  refreshThreadNames() {
    Object.entries(S.directThreads || {}).forEach(([id, thread]) => {
      if (!thread || id === 'toko') return;
      const customerId = id.replace(/^toko_/, '');
      const customer = (S.customerData || []).find(c => c.id === customerId);
      if (customer && customer.name) {
        thread.name = customer.name;
        thread.initial = (customer.name.charAt(0) || '?').toUpperCase();
      }
    });
  },

  /* Pesan thread aktif (dipakai admin saat membuka percakapan) */
  watchThreadMessages(threadId) {
    if (this._msgUnsub) { try { this._msgUnsub(); } catch (e) {} this._msgUnsub = null; }
    if (!threadId || !FB.ready()) return;
    /* Tandai sedang memuat: UI tampil "Memuat pesan…" (jujur) bukan
     * "Belum ada percakapan" (bohong) selama data belum kembali. */
    const th0 = S.directThreads[threadId];
    if (th0) { th0._loadingMessages = true; this.render('chat'); }
    const ref = FB.db.collection('chat_threads').doc(threadId)
      .collection('messages').orderBy('createdAt', 'desc').limit(30);
    const clearLoading = () => {
      const th = S.directThreads[threadId];
      if (th) th._loadingMessages = false;
    };
    /* Fast-path: ambil sekali via get() — tidak tergantung penuh pada
     * listener realtime (yang terbukti bisa macet tanpa callback di
     * sebagian perangkat). Yang datang duluan yang dipakai. */
    ref.get().then(snap => {
      const thread = S.directThreads[threadId];
      if (!thread || S.activeDirectThread !== threadId) return;
      clearLoading();
      thread.messages = snap.docs.map(d => this.mapThreadMessage(d)).reverse();
      this.render('chat');
    }).catch(() => { /* listener yang menangani error */ });
    /* Batas aman: jangan biarkan "Memuat…" macet selamanya. */
    setTimeout(() => {
      const th = S.directThreads[threadId];
      if (th && th._loadingMessages && S.activeDirectThread === threadId) {
        th._loadingMessages = false;
        this.render('chat');
        this.notifyUser('Gagal memuat pesan · periksa koneksi lalu buka ulang');
      }
    }, 15000);
    this._msgUnsub = ref.onSnapshot(snap => {
      const thread = S.directThreads[threadId] || this.upsertAdminThread({ id: threadId, data: () => ({}) });
      clearLoading();
      thread.messages = snap.docs.map(d => this.mapThreadMessage(d)).reverse();
      this.render('chat');
    }, err => {
      clearLoading();
      this.onSubError('chat messages', err, true);
      this.render('chat');
    });
  },

  stopWatchingThread() {
    if (this._msgUnsub) { try { this._msgUnsub(); } catch (e) {} this._msgUnsub = null; }
  },
  resolveThreadId(threadId) {
    if (threadId === 'toko' && S.sessionRole !== 'admin' && S.activeCustomerId) {
      return S.activeCustomerId;
    }
    return threadId;
  },

  async sendChatMessage(text) {
    text = String(text || '').trim();
    if (!text) throw new Error('Tulis pesan dulu');
    if (!this.needOnline()) throw __offlineError();
    const db = FB.db;
    const ts = FB.serverTimestamp();
    let threadId, side, customerId;
    if (S.sessionRole === 'admin') {
      threadId = S.activeDirectThread;
      if (!threadId || threadId === 'toko') throw new Error('Pilih percakapan dulu');
      side = 'admin';
      customerId = threadId.replace(/^toko_/, '');
    } else {
      if (!S.activeCustomerId) throw new Error('Masuk dulu sebagai pelanggan');
      customerId = S.activeCustomerId;
      threadId = customerId;
      side = 'customer';
    }
    if (!threadId || threadId === 'null' || threadId === 'undefined') throw new Error('ID percakapan tidak valid');
    const threadRef = db.collection('chat_threads').doc(threadId);
    const unreadField = side === 'admin' ? 'unreadCustomer' : 'unreadAdmin';
    const header = { type: 'toko', customerId: customerId, lastMessage: text, updatedAt: ts };
    header[unreadField] = FB.FieldValue.increment(1);
    await __withTimeout(threadRef.set(header, { merge: true }), WRITE_TIMEOUT_MS, 'Kirim pesan');
    const msgRef = await __withTimeout(threadRef.collection('messages').add({
      senderId: side === 'admin' ? 'admin' : customerId,
      senderRole: side,
      text: text,
      createdAt: ts,
    }), WRITE_TIMEOUT_MS, 'Kirim pesan');
    /* Optimistic UI sudah ditangani pemanggil (sendDirectMessage di
     * js/shared/chat.js) — JANGAN push duplikat di sini. Dulu blok ini
     * push kedua kali sehingga pesan tampil ganda. Cukup render ulang;
     * sinkronisasi ID asli biar lewat subscription / buka ulang. */
    this.render('chat');
  },

  async markThreadRead(threadId) {
    try {
      if (!FB.ready() || !threadId) return;
      const realId = this.resolveThreadId(threadId);
      const field = S.sessionRole === 'admin' ? 'unreadAdmin' : 'unreadCustomer';
      const update = {};
      update[field] = 0;
      await FB.db.collection('chat_threads').doc(realId).set(update, { merge: true });
    } catch (e) { /* jangan ganggu UI karena penanda baca */ }
  },

  /* Rumpi Warga */
  async sendRumpi(text, photo) {
    text = String(text || '').trim();
    if (!text) throw new Error('Tulis dulu');
    if (!this.needOnline()) throw __offlineError();
    const isAdmin = S.sessionRole === 'admin';
    await __withTimeout(FB.db.collection('rumpi_posts').add({
      authorId: isAdmin ? 'admin' : (S.activeCustomerId || 'tamu'),
      authorName: isAdmin ? 'Mimi · Warung' : (S.sessionName || 'Warga'),
      authorRole: isAdmin ? 'admin' : 'customer',
      authorPhoto: isAdmin ? '' : String((S.myCustomerDoc && S.myCustomerDoc.photoURL) || ''),
      text: text,
      imageUrl: photo || '',
      likeCount: 0,
      isSeed: false,
      createdAt: FB.serverTimestamp(),
    }), WRITE_TIMEOUT_MS, 'Kirim postingan');
  },

  async deleteRumpi(postId) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    await FB.db.collection('rumpi_posts').doc(postId).delete();
  },

  async likeRumpi(postId) {
    if (!this.needOnline()) throw __offlineError();
    /* uid WAJIB uid Auth asli (bukan 'admin') agar lolos aturan Firestore */
    const user = FB.auth ? FB.auth.currentUser : null;
    const uid = user ? user.uid : null;
    if (!uid) throw new Error('Masuk dulu sebagai pelanggan');
    const db = FB.db;
    await db.runTransaction(async t => {
      const postRef = db.collection('rumpi_posts').doc(postId);
      const likeRef = postRef.collection('likes').doc(uid);
      const likeSnap = await t.get(likeRef);
      if (likeSnap.exists) {
        t.delete(likeRef);
        t.update(postRef, { likeCount: FB.FieldValue.increment(-1) });
      } else {
        t.set(likeRef, { uid: uid, createdAt: FB.serverTimestamp() });
        t.update(postRef, { likeCount: FB.FieldValue.increment(1) });
      }
    });
  },

};
