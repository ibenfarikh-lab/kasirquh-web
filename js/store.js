/*
 * KasirQuh Web — js/store.js
 *
 * 1) `const S` — satu-satunya wadah state aplikasi (92 variabel state,
 *    tanpa data dummy; koleksi terisi dari Firestore lewat adapter di bawah).
 *    DIHAPUS TOTAL — diganti Firebase Auth.
 *    Kunci baru: promos, storeSettings, customerNotesList,
 *    adminCustomerNotes, myCustomerDoc (semuanya dari Firestore).
 *
 * 2) `const Store` — lapisan data Firebase: adapter onSnapshot per koleksi,
 *    Auth (pelanggan/admin/tamu), dan semua API tulis sesuai
 *    FIRESTORE_SCHEMA.md. Semua tulis mewajibkan online (gagal → pesan
 *    jujur "Butuh koneksi internet", tanpa antrean siluman).
 *
 * Prinsip data: tidak ada istilah/data siluman — angka hanya dari transaksi
 * nyata; koleksi kosong → empty state jujur di UI ("belum ada transaksi").
 */

// Kunci tanggal sesi (Asia/Jakarta). Dipakai juga sebagai nilai
// awal S.activePurchaseDate — dihitung sekali di sini agar konsisten.
const __todayKey = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

const S = {
  products: [], // koleksi Firestore `products` (publik, live via onSnapshot)
  riwayatBelanjaPelanggan: [], // diturunkan dari `orders` milik pelanggan
  penjualanGlobal: [], // diturunkan dari `orders` (admin) / topProductIds (tamu)
  myRecipes: [],
  editingRecipeId: null,
  pendingAdminRecipePhoto: '',
  pendingMyRecipePhoto: '',
  customerCart: {},
  adminCart: {},
  customerCat: 'Semua',
  adminCat: 'Sembako',
  savedMenu: null,
  currentDetail: null,
  currentBudgetCart: null,
  fulfillment: 'pickup',
  titipMethod: 'Ambil di warung',
  routineChoice: 'dapur',
  hajatanChoice: 'snack',
  priceAlerts: [], // {productId,name,priceAtWatch,watchedAt}
  routines: [], // {name,interval,day,createdAt}
  coinBalance: 0, // dari customers/{uid}.coins (live)
  activeOrder: null,
  promoUnitPrice: {},
  pendingProductDeleteId: null,
  customerTheme: 'light',
  adminTheme: 'dark',
  navMotion: true, // preferensi admin (persist di store_settings/main.adminNavMotion)
  activeRole: null,
  sessionRole: null,
  sessionName: null,
  sessionStartedAt: null,
  activeCustomerId: null,
  isGuest: true,
  pendingGuestAction: null,
  gatewayTimer: null,
  gatewayIndex: 0,
  gatewayTouchX: 0,
  gatewayJustSwiped: false,
  vibrateWhenSilent: true,
  soundSettings: {order:'system',promo:'system',chat:'system'},
  audioContext: null,
  coinProgramEnabled: true,
  coinSpendRule: 100,
  coinSpendReward: 1,
  coinValue: 1, // dari store_settings/main.coinRate (live)
  coinRule: '', // dari store_settings/main.coinRule (live)
  coinRedeemPercent: 50, // dari store_settings/main.coinRedeemLimit (live)
  coinRedeemEnabled: false,
  coinEvents: {checkin:true,mission:true,guess:true,spend:true},
  coinRewards: {checkin:25,mission:250,guess:100},
  coinHistory: [], // koleksi `coin_ledger` milik pelanggan (live)
  flashProductId: null, // dari store_settings/main.flashProductId (live)
  flashRule: '', // dari store_settings/main.flashRule (live)
  flashEndsAt: null, // dari store_settings/main.flashEndsAt (live, Timestamp)
  promoTitle: '', // dari store_settings/main.promoTitle (live)
  promoProductId: null, // dari store_settings/main.promoProductId (live)
  promoCopy: '', // dari store_settings/main.promoCopy (live)
  gatewaySlides: { // dari store_settings/main.gatewayTitle1..Copy3 (live)
    title1: 'Hemat belanja, senang di rumah',
    copy1: 'Promo pilihan Warunge Mimi untuk kebutuhan harian keluarga.',
    title2: 'Sembako lengkap, tinggal pilih',
    copy2: 'Minyak, gula, mi, dan kebutuhan dapur siap untuk stok rumah.',
    title3: 'Jajan dan minuman favoritmu',
    copy3: 'Camilan renyah dan minuman segar untuk teman santai kapan saja.',
  },
  kabarStatus: '', // dari store_settings/main.kabarStatus (live)
  kabarMood: '', // dari store_settings/main.kabarMood (live)
  payMethod: 'cod', // metode bayar checkout terakhir
  homeSections: { // dari store_settings/main.homeSections (live)
    restock: { show: true, order: 1 },
    popular: { show: true, order: 3 },
    recipe: { show: true, order: 2 },
  },
  storeMemos: [], // koleksi `store_memos` (admin, live)
  titipRequests: [], // koleksi `titip_requests` (admin, live)
  recipes: [], // koleksi `recipes` (live) — menggantikan adminRecipes
  dailyCheckedIn: false,
  dailyCheckinPending: false,
  calcExpression: '',
  lowStockThreshold: 5, // dari store_settings/main.lowStockDefault (live)
  pendingRestock: null,
  lastReceipt: null,
  editingProductId: null,
  pendingProductImage: '',
  journalPeriod: 'day',
  openingBalanceMode: false,
  todayKey: __todayKey,
  journalEntries: [], // koleksi `journal` (admin, live)
  dashboardShortcutCatalog: [
{id:'kasir',group:'Pekerjaan utama',label:'Buka Kasir',detail:'Transaksi langsung',icon:'cash',action:{kind:'view',value:'kasir'}},
{id:'inbox',group:'Pekerjaan utama',label:'Cek Inbox',detail:'Notifikasi terpadu',icon:'list',action:{kind:'view',value:'pesanan'}},
{id:'bookkeeping',group:'Pekerjaan utama',label:'Pembukuan',detail:'Kas dan jurnal',icon:'book',action:{kind:'view',value:'bookkeeping'}},
{id:'products',group:'Kelola warung',label:'Data Produk',detail:'Stok dan harga',icon:'box',action:{kind:'view',value:'produk'}},
{id:'store-profile',group:'Kelola warung',label:'Profil Toko',detail:'Identitas dan jam',icon:'store',action:{kind:'sheet',value:'storeProfileModal'}},
{id:'customer-home',group:'Kelola warung',label:'Beranda Pelanggan',detail:'Konten pelanggan',icon:'home',action:{kind:'sheet',value:'homeControlModal'}},
{id:'online',group:'Kelola warung',label:'Kasir Online',detail:'Pesanan pelanggan',icon:'receipt',action:{kind:'view',value:'online'}},
{id:'customers',group:'Kelola warung',label:'Data Pelanggan',detail:'Warga dan riwayat',icon:'users',action:{kind:'tab',value:'customers'}},
{id:'approvals',group:'Kelola warung',label:'Persetujuan',detail:'Pelanggan baru',icon:'clock',action:{kind:'tab',value:'approvals'}},
{id:'reports',group:'Kelola warung',label:'Laporan',detail:'Omzet dan laba',icon:'bars',action:{kind:'tab',value:'reports'}},
{id:'chat',group:'Kelola warung',label:'Chat & Rumpi',detail:'Pelanggan dan warga',icon:'chat',action:{kind:'view',value:'chat'}},
{id:'purchase-notes',group:'Kelola warung',label:'Catatan Belanja',detail:'Arsip kulakan',icon:'note',action:{kind:'view',value:'note'}},
{id:'calculator',group:'Laci alat',label:'Kalkulator',detail:'Hitung cepat',icon:'calculator',action:{kind:'sheet',value:'calculatorModal'}},
{id:'scanner',group:'Laci alat',label:'Pemindai Barcode',detail:'Masuk transaksi',icon:'barcode',action:{kind:'sheet',value:'scannerModal'}},
{id:'store-notes',group:'Laci alat',label:'Catatan Toko',detail:'Pengingat internal',icon:'note',action:{kind:'sheet',value:'storeNotesModal'}},
{id:'stock-shopping',group:'Laci alat',label:'Belanja Stok',detail:'Daftar kulakan',icon:'cart',action:{kind:'sheet',value:'stockShoppingModal'}},
{id:'admin-ai',group:'Laci alat',label:'AI Admin',detail:'Ringkas dan saran',icon:'spark',action:{kind:'sheet',value:'adminAiModal'}},
{id:'transfer',group:'Laci alat',label:'Konfirmasi Transfer',detail:'Verifikasi pembayaran',icon:'bank',action:{kind:'sheet',value:'transferModal'}},
{id:'receipt',group:'Laci alat',label:'Struk 58mm',detail:'Transaksi terakhir',icon:'receipt',action:{kind:'sheet',value:'receiptModal'}},
{id:'settings',group:'Pengaturan',label:'Pengaturan Global',detail:'Tampilan dan akun',icon:'gear',action:{kind:'sheet',value:'adminSettingsModal'}}
],
  dashboardShortcutIds: ['kasir','inbox','bookkeeping'],
  dashboardShortcutEdit: false,
  activePurchaseDate: __todayKey, // dulu: todayKey
  purchaseNotes: {}, // koleksi `stock_notes` (admin, live) — dikelompokkan per tanggal
  editingPurchaseNote: null,
  inboxItems: [], // diturunkan: antrean pelanggan + pesanan aktif + stok menipis + chat
  inboxReadIds: [], // ID notifikasi yg sudah dibaca (persisten Firestore)
  patunganList: [], // koleksi `patungan` (limit 20, hemat kuota)
  customerData: [], // koleksi `customers` (approved) — admin saja
  pendingCustomers: [], // koleksi `customers` (pending/rejected) — admin saja
  onlineOrders: [], // koleksi `orders` (admin: semua; pelanggan: milik sendiri)
  rumpiMessages: [], // koleksi `rumpi_posts` (publik, live)
  directThreads: {}, // koleksi `chat_threads` + sub `messages` (live)
  activeDirectThread: 'toko',
  directChatRole: 'customer',
  adminAiReplies: null, // diisi di js/app.js (merujuk fungsi adminAi* dalam IIFE)
  promoIndex: 0,
  promoTimer: null,
  kabarIndex: 0,
  kabarTimer: null,
  kabarResumeTimer: null,
  kabarTouchX: 0,
  guessDone: false,
  schemeQuery: window.matchMedia('(prefers-color-scheme: dark)'),
  code39: {"0":"nnnwwnwnn","1":"wnnwnnnnw","2":"nnwwnnnnw","3":"wnwwnnnnn","4":"nnnwwnnnw","5":"wnnwwnnnn","6":"nnwwwnnnn","7":"nnnwnnwnw","8":"wnnwnnwnn","9":"nnwwnnwnn","*":"nwnnwnwnn"},
  promos: [], // koleksi `promos` (publik, live) — mentah, untuk pemakaian lanjutan
  promosAdmin: [], // koleksi `promos` — SEMUA (termasuk nonaktif), khusus kelola admin
  storeSettings: {}, // dokumen `store_settings/main` (live)
  customerNotesList: [], // koleksi `customer_notes` milik pelanggan (live) — tampil di Akun
  adminCustomerNotes: [], // koleksi `customer_notes` — admin (moderasi)
  myCustomerDoc: null, // dokumen customers/{uid} milik sesi pelanggan
};

/* =====================================================================
 * Store — lapisan data Firebase untuk KasirQuh Web.
 *
 * - Adapter onSnapshot per koleksi → tulis ke S.* → panggil ulang
 *   render* yang didaftarkan js/app.js lewat Store.renderers.
 * - Auth Firebase penuh (menggantikan total auth lama PIN/akun demo):
 *   pelanggan = Email/Password + persetujuan admin; admin = Email/Password
 *   + custom claim admin:true (TIDAK ADA pendaftaran admin mandiri);
 *   tamu = default (katalog terbuka, checkout & chat dikunci).
 * - Semua tulis: requireOnline() dulu — gagal dengan pesan jujur
 *   "Butuh koneksi internet" (tanpa antrean siluman).
 * - Stok selalu via FieldValue.increment (delta atomik), uang integer Rp,
 *   timestamp server. Field tambahan di luar skema (method/profit/
 *   itemCount di journal, authorRole di rumpi, dsb.) didokumentasikan di
 *   laporan wiring — semuanya dipakai fitur nyata, bukan data siluman.
 * ===================================================================== */

function __offlineError() {
  const error = new Error('Butuh koneksi internet');
  error.code = 'OFFLINE';
  return error;
}

/* Batas waktu operasi tulis: janji yang tak kunjung selesai ditolak dengan
 * pesan jelas (kode TIMEOUT) agar tombol tak mati selamanya tanpa penjelasan. */
function __withTimeout(promise, ms, label) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error((label || 'Operasi') + ' terlalu lama · periksa koneksi lalu coba lagi');
      error.code = 'TIMEOUT';
      reject(error);
    }, ms);
  });
  return Promise.race([
    Promise.resolve(promise).finally(() => { if (timer) clearTimeout(timer); }),
    timeout,
  ]);
}
const WRITE_TIMEOUT_MS = 30000;

const Store = {
  /* Diisi js/app.js saat boot: nama -> fungsi render, dan (msg)=>toast(msg) */
  renderers: {},
  notify: null,

  subsPublic: [],
  subsRole: [],
  localInboxKinds: ['titip', 'share'],
  _msgUnsub: null,
  _sessionSeq: 0,
  _sessionPromise: null,
  _sessionResolve: null,
  _authBootPromise: Promise.resolve(),
  _authBootResolve: null,
  _authBootSettled: false,

  /* ---------------- util ---------------- */

  onPublic(unsub) { this.subsPublic.push(unsub); },
  onRole(unsub) { this.subsRole.push(unsub); },

  clearRoleSubs() {
    this.subsRole.forEach(unsub => { try { unsub(); } catch (e) {} });
    this.subsRole = [];
    if (this._msgUnsub) { try { this._msgUnsub(); } catch (e) {} this._msgUnsub = null; }
  },

  render(...names) {
    names.forEach(name => {
      try {
        const fn = this.renderers[name];
        if (typeof fn === 'function') fn();
      } catch (error) {
        console.error('[KasirQuh] render "' + name + '" gagal:', error);
      }
    });
  },

  refreshAll() {
    this.render('products', 'settings', 'orders', 'customers', 'journal',
      'stockNotes', 'customerNotes', 'chat', 'rumpi', 'coins', 'inbox',
      'session', 'profile');
  },

  notifyUser(msg) {
    try { if (typeof this.notify === 'function') this.notify(msg); } catch (e) {}
  },

  /* true bila online & Firebase siap; bila tidak → pesan jujur + false */
  needOnline() {
    try {
      FB.requireOnline();
      if (!FB.ready()) throw new Error('Layanan data belum tersambung');
      return true;
    } catch (error) {
      this.notifyUser(error.message || 'Butuh koneksi internet');
      return false;
    }
  },

  assertAdmin() {
    if (S.sessionRole !== 'admin') throw new Error('Hanya admin yang boleh melakukan ini');
  },

  onSubError(label, error, quiet) {
    console.error('[KasirQuh] langganan "' + label + '" gagal:', error);
    if (!quiet && error && error.code === 'permission-denied') {
      this.notifyUser('Akses data "' + label + '" ditolak — periksa aturan Firestore');
    }
  },

  pad2(n) { return String(n).padStart(2, '0'); },

  dateKeyOf(ts) {
    const d = ts && ts.toDate ? ts.toDate() : new Date();
    return d.getFullYear() + '-' + this.pad2(d.getMonth() + 1) + '-' + this.pad2(d.getDate());
  },

  timeOf(ts) {
    const d = ts && ts.toDate ? ts.toDate() : new Date();
    try {
      return new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(d).replace('.', ':');
    } catch (e) { return ''; }
  },

  dateTimeOf(ts) {
    const d = ts && ts.toDate ? ts.toDate() : new Date();
    try {
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta',
      }).format(d).replace('.', ':');
    } catch (e) { return 'Baru saja'; }
  },

  /* Kunci tanggal YYYY-MM-DD → 'Senin, 7 Oktober 2026' (id-ID) */
  formatTanggalIndonesia(key) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
    if (!m) return '';
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (isNaN(d.getTime())) return '';
    try {
      return new Intl.DateTimeFormat('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      }).format(d);
    } catch (e) { return String(key); }
  },

  /* Sortir dokumen di klien berdasar timestamp (menghindari composite index manual) */
  sortDocs(docs, field, desc) {
    const ms = ts => (ts && ts.toMillis ? ts.toMillis() : 0);
    return docs.slice().sort((a, b) => {
      const d = ms(b.data()[field]) - ms(a.data()[field]);
      return desc === false ? -d : d;
    });
  },

  customerUnitPrice(product, qty) {
    const base = (S.promoUnitPrice && S.promoUnitPrice[product.id]) || product.price || 0;
    if (product.wholesaleQty && qty >= product.wholesaleQty) {
      return Math.min(base, product.wholesalePrice || base);
    }
    return base;
  },

  /* ---------------- mapper Firestore -> bentuk UI ---------------- */

  mapProduct(doc) {
    const d = doc.data() || {};
    const name = String(d.name || '').trim();
    if (!name) return null;
    return {
      id: doc.id,
      name: name,
      short: name.length > 17 ? name.slice(0, 17) : name,
      cat: d.category || 'Lainnya',
      unit: d.unit || 'pcs',
      price: Math.max(0, Math.round(Number(d.price) || 0)),
      cost: Math.max(0, Math.round(Number(d.costPrice) || 0)),
      stock: Math.max(0, Number(d.stock) || 0),
      img: d.photoUrl || 'assets/img/img-021.png',
      barcode: d.barcode || '',
      promo: !!d.promo,
      isActive: d.isActive !== false,
      lowStockAt: Number(d.lowStockAt) || 5,
      wholesaleQty: Math.max(0, Number(d.wholesaleQty) || 0),
      wholesalePrice: Math.max(0, Math.round(Number(d.wholesalePrice) || 0)),
      wholesaleLabel: String(d.wholesaleLabel || ''),
      oldPrice: Math.max(0, Math.round(Number(d.oldPrice) || 0)),
    };
  },

  mapJournal(doc) {
    const d = doc.data() || {};
    const cat = d.category || 'lainnya';
    let type = 'Lainnya';
    if (cat === 'penjualan') type = 'Penjualan';
    else if (cat === 'kulakan') type = 'Kulakan';
    else if (cat === 'beban_promosi') type = 'Penukaran koin';
    else if (String(d.note || '') === 'Saldo awal kas') type = 'Saldo Awal';
    return {
      id: doc.id,
      date: this.dateKeyOf(d.createdAt),
      time: this.timeOf(d.createdAt),
      direction: d.type === 'pengeluaran' ? 'expense' : 'income',
      type: type,
      description: String(d.note || 'Transaksi'),
      amount: Math.round(Number(d.amount) || 0),
      source: String(d.refId || 'Manual'),
      method: String(d.method || ''),
      profit: Math.round(Number(d.profit) || 0),
      itemCount: Math.round(Number(d.itemCount) || 0),
    };
  },

  mapOrder(doc) {
    const d = doc.data() || {};
    const raw = d.status || 'menunggu';
    if (raw === 'dibatalkan') return null; // 1:1 alur yang dikunci: pesanan batal keluar dari daftar
    const fulfillment = d.fulfillment || 'pickup';
    const items = (d.items || []).map(it => ([
      String(it.name || 'Produk'),
      (Number(it.qty) || 0) + 'x',
      'Rp' + Math.round(Number(it.subtotal) || 0).toLocaleString('id-ID'),
      String(it.productId || ''),
    ]));
    const customer = (S.customerData || []).find(c => c.id === d.customerId);
    return {
      id: String(d.code || doc.id),
      _docId: doc.id,
      _rawStatus: raw,
      _dateKey: this.dateKeyOf(d.createdAt),
      status: (raw === 'menunggu' || raw === 'dikemas' || raw === 'dikirim') ? 'active' : 'done',
      time: d.createdAt ? this.dateTimeOf(d.createdAt) : 'Baru saja',
      name: String(d.customerName || 'Pelanggan'),
      customerId: String(d.customerId || ''),
      wa: customer ? (customer.wa || '') : '',
      address: String(d.note || (fulfillment === 'delivery' ? 'Diantar ke rumah' : 'Ambil di warung')),
      method: d.paymentMethod === 'transfer' ? 'Transfer' : (fulfillment === 'delivery' ? 'COD' : 'Bayar di warung'),
      paid: raw === 'selesai',
      transferStatus: String(d.transferStatus || ''),
      transferReference: String(d.transferReference || ''),
      items: items,
      total: Math.round(Number(d.total) || 0),
      fullTotal: Math.round(Number(d.fullTotal != null ? d.fullTotal : d.total) || 0),
      coinUsed: Math.round(Number(d.coinUsed) || 0),
      coinValue: Math.round(Number(d.coinValue) || 0),
      earnedCoins: Math.round(Number(d.earnedCoins) || 0),
      stockDeducted: true,
      stockLines: (d.items || []).map(it => ({ productId: String(it.productId || ''), qty: Number(it.qty) || 0 })),
      cancelConfirm: false,
    };
  },

  mapCustomer(doc) {
    const d = doc.data() || {};
    return {
      id: doc.id,
      name: String(d.name || 'Pelanggan'),
      email: String(d.email || ''),
      wa: String(d.wa || ''),
      address: 'Alamat belum diisi',
      spend: 0,
      history: [],
    };
  },

  mapPending(doc) {
    const d = doc.data() || {};
    return {
      id: doc.id,
      name: String(d.name || 'Pelanggan'),
      email: String(d.email || ''),
      wa: String(d.wa || 'Tanpa nomor WA'),
      meta: 'Mendaftar ' + (d.createdAt ? this.dateTimeOf(d.createdAt) : 'baru saja'),
      status: d.approvalStatus === 'rejected' ? 'rejected' : 'waiting',
    };
  },

  mapThreadMessage(doc) {
    const d = doc.data() || {};
    return {
      id: doc.id,
      side: d.senderRole === 'admin' ? 'admin' : 'customer',
      time: d.createdAt ? this.timeOf(d.createdAt) : 'Baru saja',
      text: String(d.text || ''),
    };
  },

  mapRumpi(doc) {
    const d = doc.data() || {};
    const name = String(d.authorName || 'Warga');
    return {
      id: doc.id,
      name: name,
      initial: (name.charAt(0) || 'W').toUpperCase(),
      time: d.createdAt ? this.dateTimeOf(d.createdAt) : 'Baru saja',
      text: String(d.text || ''),
      photo: String(d.imageUrl || ''),
      photoAlt: 'Foto yang dibagikan',
      admin: d.authorRole === 'admin',
      seed: !!d.isSeed,
      likeCount: Math.max(0, Math.round(Number(d.likeCount) || 0)),
    };
  },

  mapCoinEntry(doc) {
    const d = doc.data() || {};
    const amount = Math.round(Number(d.amount) || 0);
    const reasonLabels = { harian: 'Koin masuk', belanja: 'Bonus belanja', tukar: 'Penukaran koin', koreksi_admin: 'Koreksi admin', misi: 'Hadiah misi', tebak_harga: 'Hadiah tebak harga' };
    return {
      kind: amount >= 0 ? 'income' : 'expense',
      amount: Math.abs(amount),
      label: String(d.label || reasonLabels[d.reason] || 'Koin'),
      detail: String(d.detail || ''),
    };
  },

  mapCustomerNote(doc) {
    const d = doc.data() || {};
    return {
      id: doc.id,
      customerId: String(d.customerId || ''),
      type: d.type || 'catatan',
      amount: Math.round(Number(d.amount) || 0),
      note: String(d.note || ''),
      /* Tanggal catatan (noteDate) didahulukan; bila tidak ada pakai createdAt */
      time: d.noteDate ? this.formatTanggalIndonesia(d.noteDate) : (d.createdAt ? this.dateTimeOf(d.createdAt) : ''),
    };
  },

  mapRecipe(doc) {
    const d = doc.data() || {};
    return {
      id: doc.id,
      nama: String(d.nama || ''),
      desc: String(d.desc || ''),
      foto: String(d.foto || ''),
      items: this.cleanRecipeItems(d.items),
    };
  },

  /* Baris bahan resep dari form → bentuk Firestore */
  cleanRecipeItems(items) {
    return (items || []).map(it => ({
      productId: String(it.productId || ''),
      qty: Math.max(1, Math.round(Number(it.qty) || 1)),
    })).filter(it => it.productId);
  },

  mapStockNote(doc) {
    const d = doc.data() || {};
    return {
      id: doc.id,
      date: String(d.date || S.todayKey),
      supplier: String(d.supplier || ''),
      items: (d.items || []).map(it => ({ name: String(it.name || 'Barang'), qty: String(it.qty || '1') })),
      total: Math.round(Number(d.total) || 0),
      source: String(d.source || 'manual'),
    };
  },

  orderStatusLabel(raw) {
    return { menunggu: 'Menunggu', dikemas: 'Dikemas', dikirim: 'Dikirim', selesai: 'Selesai', dibatalkan: 'Dibatalkan' }[raw] || raw;
  },
};

/* ---------------- adapter langganan ---------------- */

Object.assign(Store, {

  async init() {
    /* Auth boot adalah satu jalur resmi. UI tidak boleh memutuskan
     * "tamu"/gateway sebelum Firebase selesai memastikan sesi awal. */
    this._authBootSettled = false;
    this._authBootPromise = new Promise(resolve => { this._authBootResolve = resolve; });

    if (!window.FB || !FB.ready()) {
      console.error('[KasirQuh] Firebase belum siap — adapter data tidak dijalankan.',
        window.FB && FB.initError ? FB.initError() : '');
      this._authBootSettled = true;
      this._authBootResolve();
      return;
    }
    try {
      /* Persistence LOCAL harus selesai sebelum listener awal dipasang.
       * Ini bagian dari boot auth, bukan patch setelah login gagal. */
      if (FB.authPersistenceReady) await FB.authPersistenceReady;
    } catch (error) {
      console.error('[KasirQuh] Auth persistence tidak tersedia; listener sesi tidak dijalankan.', error);
      this._authBootSettled = true;
      this._authBootResolve();
      return;
    }
    this.startPublicSubs();
    FB.auth.onAuthStateChanged(async user => {
      try {
        await this.handleAuthState(user);
      } finally {
        /* Hanya callback pertama yang menutup gerbang boot. Perubahan auth
         * berikutnya tetap berjalan normal tanpa menahan UI. */
        if (!this._authBootSettled) {
          this._authBootSettled = true;
          if (this._authBootResolve) this._authBootResolve();
          this._authBootResolve = null;
        }
      }
    });
  },

  whenAuthReady() {
    return this._authBootPromise || Promise.resolve();
  },

  /* Koleksi publik: berlaku untuk tamu, pelanggan, dan admin */
  startPublicSubs() {
    const db = FB.db;

    this.refreshProducts();
    this.watchPatungan();

    this.onPublic(db.collection('promos').where('isActive', '==', true).onSnapshot(snap => {
      S.promos = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
      this.render('promos');
    }, err => this.onSubError('promos', err)));

    this.onPublic(db.collection('store_settings').doc('main').onSnapshot(snap => {
      this.applyStoreSettings(snap.exists ? snap.data() : null);
    }, err => this.onSubError('store_settings', err)));

    this.onPublic(db.collection('rumpi_posts').orderBy('createdAt', 'desc').limit(60).onSnapshot(snap => {
      S.rumpiMessages = snap.docs.map(d => this.mapRumpi(d));
      this.render('rumpi');
    }, err => this.onSubError('rumpi_posts', err)));
  },

  applyStoreSettings(data) {
    S.storeSettings = data || {};
    const d = S.storeSettings;
    if (Array.isArray(d.dashboardShortcutIds) && d.dashboardShortcutIds.length) S.dashboardShortcutIds = d.dashboardShortcutIds.filter(id => typeof id === 'string').slice(0, 6);
    if (Array.isArray(d.inboxReadIds)) S.inboxReadIds = d.inboxReadIds.filter(id => typeof id === 'string').slice(0, 200);
    if (typeof d.coinRate === 'number') S.coinValue = Math.max(1, Math.round(d.coinRate));
    if (typeof d.coinRedeemLimit === 'number') S.coinRedeemPercent = Math.min(100, Math.max(0, Math.round(d.coinRedeemLimit)));
    if (typeof d.lowStockDefault === 'number') S.lowStockThreshold = Math.min(99, Math.max(1, Math.round(d.lowStockDefault)));
    /* Program koin: nyala/mati + event + hadiah (live) */
    if (typeof d.coinProgramEnabled === 'boolean') S.coinProgramEnabled = d.coinProgramEnabled;
    if (d.coinEvents && typeof d.coinEvents === 'object') {
      ['checkin', 'mission', 'guess', 'spend'].forEach(k => {
        if (typeof d.coinEvents[k] === 'boolean') S.coinEvents[k] = d.coinEvents[k];
      });
    }
    if (d.coinRewards && typeof d.coinRewards === 'object') {
      ['checkin', 'mission', 'guess'].forEach(k => {
        if (typeof d.coinRewards[k] === 'number') S.coinRewards[k] = Math.max(0, Math.round(d.coinRewards[k]));
      });
    }
    if (typeof d.coinSpendReward === 'number') S.coinSpendReward = Math.max(0, Math.round(d.coinSpendReward));
    if (typeof d.coinSpendRule === 'number') S.coinSpendRule = Math.max(1, Math.round(d.coinSpendRule));
    if (typeof d.coinRule === 'string') S.coinRule = d.coinRule;
    /* Promo kilat: produk + harga → peta harga promo (live) */
    const flashId = (typeof d.flashProductId === 'string' && d.flashProductId.trim()) ? d.flashProductId.trim() : null;
    S.flashProductId = flashId;
    const flashPrice = Number(d.flashPrice) > 0 ? Math.round(Number(d.flashPrice)) : 0;
    S.promoUnitPrice = (flashId && flashPrice > 0) ? { [flashId]: flashPrice } : {};
    if (typeof d.flashRule === 'string') S.flashRule = d.flashRule;
    S.flashEndsAt = (d.flashEndsAt && typeof d.flashEndsAt.toDate === 'function') ? d.flashEndsAt : null;
    /* Promo utama + slide gateway + kabar (live) */
    if (typeof d.promoTitle === 'string') S.promoTitle = d.promoTitle;
    if (typeof d.promoProductId === 'string') S.promoProductId = d.promoProductId || null;
    if (typeof d.promoCopy === 'string') S.promoCopy = d.promoCopy;
    const gs = S.gatewaySlides || {};
    const gsText = (v, fb) => (typeof v === 'string' && v.trim()) ? v : fb;
    S.gatewaySlides = {
      title1: gsText(d.gatewayTitle1, gs.title1),
      copy1: gsText(d.gatewayCopy1, gs.copy1),
      title2: gsText(d.gatewayTitle2, gs.title2),
      copy2: gsText(d.gatewayCopy2, gs.copy2),
      title3: gsText(d.gatewayTitle3, gs.title3),
      copy3: gsText(d.gatewayCopy3, gs.copy3),
    };
    if (typeof d.kabarStatus === 'string') S.kabarStatus = d.kabarStatus;
    if (typeof d.kabarMood === 'string') S.kabarMood = d.kabarMood;
    /* Bagian Beranda (live) */
    ['restock', 'popular', 'recipe'].forEach(k => {
      const sec = d.homeSections && d.homeSections[k];
      if (sec && typeof sec === 'object') {
        if (typeof sec.show === 'boolean') S.homeSections[k].show = sec.show;
        const ord = Number(sec.order);
        if (ord >= 1 && ord <= 3) S.homeSections[k].order = ord;
      }
    });
    /* Jam operasional (live, format HH:MM) */
    const hhmm = v => (typeof v === 'string' && /^\d{2}:\d{2}$/.test(v.trim())) ? v.trim() : '';
    d.openTime = hhmm(d.openTime);
    d.closeTime = hhmm(d.closeTime);
    /* Preferensi admin (persist): tema, dering, animasi navigasi.
     * Hanya ke state di sini; efek tampilan lewat renderer 'settings'. */
    const adminTheme = String(d.adminTheme || '').trim();
    if (['light', 'dark', 'system'].indexOf(adminTheme) >= 0) S.adminTheme = adminTheme;
    if (d.adminSoundSettings && typeof d.adminSoundSettings === 'object') {
      ['order', 'promo', 'chat'].forEach(k => { if (typeof d.adminSoundSettings[k] === 'string') S.soundSettings[k] = d.adminSoundSettings[k]; });
      if (typeof d.adminSoundSettings.vibrate === 'boolean') S.vibrateWhenSilent = d.adminSoundSettings.vibrate;
    }
    if (typeof d.adminNavMotion === 'boolean') S.navMotion = d.adminNavMotion;
    /* Terapkan yang tampil: nama warung (satu sumber) + running text.
     * Input form TIDAK disentuh di sini — pakai syncSettingsForms() saat sheet dibuka. */
    try {
      const name = (String(d.storeName || 'Warunge Mimi')).trim() || 'Warunge Mimi';
      const adminTitle = document.querySelector('.admin-home-link h2');
      if (adminTitle) adminTitle.textContent = name;
      const gatewayName = document.getElementById('gatewayStoreName');
      if (gatewayName) gatewayName.textContent = name;
      const homeTitle = document.querySelector('.home-head h1');
      if (homeTitle) homeTitle.textContent = name;
      if (typeof d.runningText === 'string' && d.runningText.trim()) {
        const rt = document.getElementById('runningText');
        if (rt) rt.textContent = d.runningText;
      }
    } catch (e) { /* DOM belum siap — render berikutnya memperbaiki */ }
    this.rebuildPopular();
    this.render('settings');
    /* Tampilan promo & tata letak Beranda dipegang app.js (guard: boleh belum ada) */
    if (typeof renderFlashCard === 'function') renderFlashCard();
    if (typeof renderPromoCarousel === 'function') renderPromoCarousel();
    if (typeof syncHomeSectionLayout === 'function') syncHomeSectionLayout();
    if (window.KasirQuhUI&&typeof window.KasirQuhUI.syncGatewayPromo==='function')window.KasirQuhUI.syncGatewayPromo();
  },

  /* Isi semua input form admin dari state — dipanggil app.js saat sheet
   * pengaturan dibuka. Hanya input form; tampilan display ditangani
   * applyStoreSettings/render. Tiap elemen di-guard (boleh tidak ada). */
  syncSettingsForms() {
    const d = S.storeSettings || {};
    const setVal = (id, v) => {
      try {
        const el = document.getElementById(id);
        if (el && v !== undefined && v !== null) el.value = String(v);
      } catch (e) {}
    };
    /* Profil toko */
    setVal('adminStoreNameInput', String(d.storeName || 'Warunge Mimi'));
    setVal('adminOpenTime', d.openTime || '');
    setVal('adminCloseTime', d.closeTime || '');
    setVal('adminStoreAddress', String(d.storeAddress || ''));
    setVal('adminStorePhone', String(d.storePhone || ''));
    /* Koin Warga */
    setVal('coinValueInput', S.coinValue);
    setVal('coinRedeemPercentInput', S.coinRedeemPercent);
    setVal('coinCheckinInput', S.coinRewards.checkin);
    setVal('coinMissionInput', S.coinRewards.mission);
    setVal('coinGuessInput', S.coinRewards.guess);
    setVal('coinSpendRewardInput', S.coinSpendReward);
    setVal('coinSpendInput', S.coinSpendRule);
    setVal('coinRuleInput', String(d.coinRule || ''));
    /* Beranda pelanggan */
    setVal('homeInfoInput', String(d.runningText || ''));
    const slides = S.gatewaySlides || {};
    setVal('gatewayTitle1Input', slides.title1 || '');
    setVal('gatewayCopy1Input', slides.copy1 || '');
    setVal('gatewayTitle2Input', slides.title2 || '');
    setVal('gatewayCopy2Input', slides.copy2 || '');
    setVal('gatewayTitle3Input', slides.title3 || '');
    setVal('gatewayCopy3Input', slides.copy3 || '');
    setVal('promoTitleInput', S.promoTitle || '');
    setVal('flashPriceInput', (S.flashProductId && S.promoUnitPrice[S.flashProductId]) || '');
    setVal('flashRuleInput', S.flashRule || '');
    setVal('kabarStatusInput', S.kabarStatus || '');
    setVal('kabarMoodInput', S.kabarMood || '');
    /* Tema admin (persist) → tandai pilihan aktif di Pengaturan */
    try {
      document.querySelectorAll('[data-admin-theme]').forEach(b => b.classList.toggle('active', b.getAttribute('data-admin-theme') === (S.adminTheme || 'dark')));
    } catch (e) {}
    /* Toggle tampil/sembunyi + urutan bagian Beranda */
    try {
      document.querySelectorAll('.home-section-toggle[data-section]').forEach(btn => {
        const sec = (S.homeSections || {})[btn.getAttribute('data-section')];
        if (!sec) return;
        btn.setAttribute('aria-pressed', String(!!sec.show));
        btn.textContent = sec.show ? 'TAMPIL' : 'SEMBUNYI';
      });
      document.querySelectorAll('[data-section-order]').forEach(sel => {
        const sec = (S.homeSections || {})[sel.getAttribute('data-section-order')];
        if (sec && sec.order) sel.value = String(sec.order);
      });
    } catch (e) {}
  },

  /* Simpan pengaturan toko (admin). Snapshot store_settings/main otomatis
   * menerapkan balik lewat applyStoreSettings. */
  /* Produk: tarik manual (hemat kuota) — bukan real-time.
   * Dipanggil saat boot, saat admin simpan produk, dan via tombol refresh. */
  async refreshProducts() {
    try {
      const snap = await FB.db.collection('products').get();
      S.products = snap.docs.map(d => this.mapProduct(d)).filter(p => p);
      this.rebuildPopular();
      this.render('products');
    } catch (err) { this.onSubError('products', err); }
  },

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

  async joinPatungan(patunganId, slots) {
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
      parts.push({ customerId: S.activeCustomerId, name: S.sessionName || 'Warga', slots: want, joinedAt: new Date().toISOString() });
      t.update(ref, { participants: parts, filledSlots: filled + want, status: (filled + want >= total) ? 'penuh' : 'aktif', updatedAt: FB.serverTimestamp() });
    });
  },

  async setPatunganStatus(id, status) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    await FB.db.collection('patungan').doc(id).update({ status: status, updatedAt: FB.serverTimestamp() });
  },

  async saveStoreSettings(patch) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    await FB.db.collection('store_settings').doc('main').set(
      Object.assign({ updatedAt: FB.serverTimestamp() }, patch || {}),
      { merge: true }
    );
  },

  /* Langganan koleksi `recipes` (baca: yang login saja, sesuai aturan).
   * Dipasang di langganan pelanggan DAN admin. */
  watchRecipes() {
    const db = FB.db;
    this.onRole(db.collection('recipes').orderBy('createdAt', 'desc').limit(20).onSnapshot(snap => {
      S.recipes = snap.docs.map(d => this.mapRecipe(d));
      this.render('recipes');
    }, err => this.onSubError('recipes', err)));
  },

  /* ---------------- langganan pelanggan ---------------- */

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
        FB.auth.signOut();
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
    this.onRole(threadRef.collection('messages').orderBy('createdAt', 'asc').limit(100).onSnapshot(snap => {
      const thread = this.ensureCustomerThread(uid);
      thread.messages = snap.docs.map(d => this.mapThreadMessage(d));
      this.render('chat');
    }, err => this.onSubError('chat messages', err)));
  },

  ensureCustomerThread(uid) {
    let thread = S.directThreads.toko;
    if (!thread) {
      thread = { name: 'Warunge Mimi', initial: 'W', messages: [], unread: 0, customerUnread: 0 };
      S.directThreads.toko = thread;
    }
    return thread;
  },

  /* ---------------- langganan admin ---------------- */

  startAdminSubs() {
    const db = FB.db;

    /* Promo carousel: admin melihat SEMUA (termasuk nonaktif) agar bisa mengaktifkan ulang.
     * Tanpa ini, promo yang dinonaktifkan hilang dari daftar kelola selamanya. */
    this.onRole(db.collection('promos').orderBy('createdAt', 'desc').limit(30).onSnapshot(snap => {
      S.promosAdmin = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
      this.render('promos');
    }, err => this.onSubError('promos_admin', err)));

    this.onRole(db.collection('orders').orderBy('createdAt', 'desc').limit(100).onSnapshot(snap => {
      S.onlineOrders = snap.docs.map(d => this.mapOrder(d)).filter(o => o);
      this.rebuildPopular();
      this.refreshCustomerSpend();
      this.rebuildInbox();
      this.render('orders', 'inbox');
    }, err => this.onSubError('orders', err)));

    this.onRole(db.collection('customers').where('approvalStatus', '==', 'approved').onSnapshot(snap => {
      S.customerData = snap.docs.map(d => this.mapCustomer(d));
      this.refreshCustomerSpend();
      this.rebuildInbox();
      this.render('customers');
    }, err => this.onSubError('customers', err)));

    this.onRole(db.collection('customers').where('approvalStatus', 'in', ['pending', 'rejected']).onSnapshot(snap => {
      S.pendingCustomers = snap.docs.map(d => this.mapPending(d));
      this.rebuildInbox();
      this.render('customers', 'inbox');
    }, err => this.onSubError('customers pending', err)));

    this.onRole(db.collection('journal').orderBy('createdAt', 'desc').limit(200).onSnapshot(snap => {
      S.journalEntries = snap.docs.map(d => this.mapJournal(d));
      this.render('journal');
    }, err => this.onSubError('journal', err)));

    this.onRole(db.collection('stock_notes').orderBy('date', 'desc').onSnapshot(snap => {
      const grouped = {};
      snap.docs.forEach(d => {
        const note = this.mapStockNote(d);
        (grouped[note.date] = grouped[note.date] || []).push(note);
      });
      S.purchaseNotes = grouped;
      this.render('stockNotes');
    }, err => this.onSubError('stock_notes', err)));

    this.onRole(db.collection('customer_notes').orderBy('createdAt', 'desc').limit(100).onSnapshot(snap => {
      S.adminCustomerNotes = snap.docs.map(d => this.mapCustomerNote(d));
      this.render('kasbon');
    }, err => this.onSubError('customer_notes', err)));

    /* Catatan Toko (pengingat internal admin) */
    this.onRole(db.collection('store_memos').orderBy('createdAt', 'desc').limit(100).onSnapshot(snap => {
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
      this.rebuildInbox();
      this.render('inbox');
    }, err => this.onSubError('titip_requests', err)));

    this.onRole(db.collection('chat_threads').where('type', '==', 'toko')
      .limit(50).onSnapshot(snap => {
        this.sortDocs(snap.docs, 'updatedAt').forEach(d => this.upsertAdminThread(d));
        this.rebuildInbox();
        this.render('chat', 'inbox');
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
    const ref = FB.db.collection('chat_threads').doc(threadId)
      .collection('messages').orderBy('createdAt', 'asc').limit(100);
    this._msgUnsub = ref.onSnapshot(snap => {
      const thread = S.directThreads[threadId] || this.upsertAdminThread({ id: threadId, data: () => ({}) });
      thread.messages = snap.docs.map(d => this.mapThreadMessage(d));
      this.render('chat');
    }, err => this.onSubError('chat messages', err, true));
  },

  resolveThreadId(threadId) {
    if (threadId === 'toko' && S.sessionRole !== 'admin' && S.activeCustomerId) {
      return S.activeCustomerId;
    }
    return threadId;
  },

  /* ---------------- data turunan (jujur: dihitung, bukan siluman) ---------------- */

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
  },

  /* Item inbox lokal sesi (titip/share) — tidak ditimpa rebuild turunan */
  pushLocalInbox(item) {
    S.inboxItems = [item, ...(S.inboxItems || [])];
    this.render('inbox');
  },
});

/* ---------------- autentikasi Firebase (implementasi penuh) ---------------- */

Object.assign(Store, {

  beginSession() {
    this._sessionSeq += 1;
    const seq = this._sessionSeq;
    this._sessionPromise = new Promise(resolve => { this._sessionResolve = resolve; });
    this._sessionToken = seq;
  },

  endSession() {
    if (this._sessionResolve && this._sessionToken === this._sessionSeq) {
      const resolve = this._sessionResolve;
      this._sessionResolve = null;
      resolve();
    }
  },

  whenSessionReady() {
    return this._sessionPromise || Promise.resolve();
  },

  setGuestSession() {
    S.isGuest = true;
    S.sessionRole = null;
    S.sessionName = null;
    S.sessionStartedAt = null;
    S.activeCustomerId = null;
    S.activeOrder = null;
    S.pendingGuestAction = null;
    S.myCustomerDoc = null;
    S.coinBalance = 0;
    S.coinHistory = [];
    S.onlineOrders = [];
    S.customerNotesList = [];
    S.customerData = [];
    S.pendingCustomers = [];
    S.journalEntries = [];
    S.purchaseNotes = {};
    S.directThreads = {};
    S.adminCustomerNotes = [];
    S.inboxItems = [];
    S.dailyCheckedIn = false;
    S.dailyCheckinPending = false;
  },

  async handleAuthState(user) {
    // Catat status SEBELUM reset: bila sesi pulih setelah timer gateway
    // kadung memasukkan aplikasi ke mode tamu (balapan timer), layar
    // harus dikembalikan ke layar peran yang benar.
    const sessionWasGuest = S.isGuest;
    this.beginSession();
    try {
      this.clearRoleSubs();
      this.setGuestSession();

      if (!user) {
        this.render('session', 'profile', 'orders', 'coins', 'customerNotes', 'customers',
          'journal', 'stockNotes', 'chat', 'inbox');
        return;
      }

      const uid = user.uid;

      /* Admin: custom claim admin:true (TIDAK ADA pendaftaran admin mandiri) */
      let isAdmin = false;
      try {
        const token = await user.getIdTokenResult();
        isAdmin = !!(token && token.claims && token.claims.admin === true);
      } catch (e) {
        // Gagal transient (jaringan belum siap saat tab baru dibuka):
        // coba sekali lagi sebelum menyerah. Kegagalan di sini tidak
        // boleh menghancurkan sesi (lihat bawah: tanpa signOut).
        try {
          await new Promise(resolve => setTimeout(resolve, 1500));
          const retryToken = await user.getIdTokenResult();
          isAdmin = !!(retryToken && retryToken.claims && retryToken.claims.admin === true);
        } catch (e2) { isAdmin = false; }
      }

      if (isAdmin) {
        S.isGuest = false;
        S.sessionRole = 'admin';
        S.sessionName = 'Admin Warunge Mimi';
        S.sessionStartedAt = new Date().toISOString();
        S.activeCustomerId = null;
        this.startAdminSubs();
        this.render('session', 'profile');
        // Sesi pulih/login: yang sudah login langsung lewati gateway
        // (keputusan terkunci) + pastikan timer gateway mati.
        // Juga kembalikan layar bila sesi pulih setelah aplikasi kadung
        // masuk mode tamu (balapan timer di tab baru).
        const gatewayUI=window.KasirQuhUI||{};
        if (typeof gatewayUI.stopGatewayTimer==='function')gatewayUI.stopGatewayTimer();
        if (typeof gatewayUI.go==='function') {
          const gw = document.getElementById('gateway');
          if ((gw && gw.classList.contains('active')) || sessionWasGuest) gatewayUI.go('admin');
        }
        return;
      }

      /* Pelanggan: dokumen customers/{uid} wajib approved */
      let snap = null;
      try {
        snap = await FB.db.collection('customers').doc(uid).get();
      } catch (e) { snap = null; }
      const data = snap && snap.exists ? snap.data() : null;
      if (!data || data.approvalStatus !== 'approved') {
        // JALUR RESTORE: jangan hancurkan sesi Firebase di sini — cukup
        // tampilkan mode tamu. signOut hanya untuk penolakan login
        // eksplisit (sudah diurus form login masing-masing).
        this.render('session', 'profile');
        return;
      }

      S.isGuest = false;
      S.sessionRole = 'customer';
      S.activeCustomerId = uid;
      S.sessionName = data.name || 'Pelanggan';
      S.sessionStartedAt = new Date().toISOString();
      S.myCustomerDoc = Object.assign({ id: uid }, data);
      if (Array.isArray(data.priceAlerts)) S.priceAlerts = data.priceAlerts;
      if (Array.isArray(data.routines)) S.routines = data.routines;
      S.coinBalance = Math.max(0, Math.round(Number(data.coins) || 0));
      this.startCustomerSubs(uid);
      this.render('session', 'profile');
      // Sesi pulih: yang sudah login langsung lewati gateway (keputusan terkunci).
      // Juga kembalikan layar bila sesi pulih setelah aplikasi kadung
      // masuk mode tamu (balapan timer di tab baru).
      const gatewayUI=window.KasirQuhUI||{};
      if (typeof gatewayUI.stopGatewayTimer==='function')gatewayUI.stopGatewayTimer();
      if (typeof gatewayUI.go==='function') {
        const gw = document.getElementById('gateway');
        if ((gw && gw.classList.contains('active')) || sessionWasGuest) gatewayUI.go('customer');
      }
    } finally {
      this.endSession();
    }
  },

  authErrorMessage(error) {
    const code = (error && error.code) || '';
    if (code === 'auth/email-already-in-use') return 'Email sudah dipakai';
    if (code === 'auth/invalid-email') return 'Format email belum benar';
    if (code === 'auth/weak-password') return 'Kata sandi minimal 6 karakter';
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') return 'Email atau kata sandi salah';
    if (code === 'auth/user-not-found') return 'Belum terdaftar, silakan daftar dulu';
    if (code === 'auth/too-many-requests') return 'Terlalu banyak percobaan, coba lagi nanti';
    if (code === 'auth/network-request-failed' || code === 'OFFLINE') return 'Butuh koneksi internet';
    if (code === 'permission-denied') return 'Akses ditolak — hubungi admin warung';
    return (error && error.message) || 'Terjadi kesalahan, coba lagi';
  },

  /* Daftar pelanggan: Auth + customers/{uid} {approvalStatus:'pending'}.
   * Setelah daftar langsung signOut → kembali mode tamu dengan pesan
   * "menunggu persetujuan" (1:1 alur yang dikunci). */
  async registerCustomer({ name, email, password, wa }) {
    if (!this.needOnline()) throw __offlineError();
    let cred;
    try {
      cred = await __withTimeout(FB.auth.createUserWithEmailAndPassword(email, password), WRITE_TIMEOUT_MS, 'Pendaftaran');
    } catch (error) {
      throw new Error(this.authErrorMessage(error));
    }
    const uid = cred.user.uid;
    try {
      await __withTimeout(FB.db.collection('customers').doc(uid).set({
        name: name,
        email: email,
        wa: wa || '',
        approvalStatus: 'pending',
        coins: 0,
        createdAt: FB.serverTimestamp(),
      }), WRITE_TIMEOUT_MS, 'Pendaftaran');
    } catch (error) {
      try { await cred.user.delete(); } catch (e) {}
      throw new Error(this.authErrorMessage(error));
    }
    try { await FB.auth.signOut(); } catch (e) {}
  },

  /* Masuk pelanggan: approved → sesi penuh; pending/rejected → pesan jujur */
  async loginCustomer(email, password) {
    if (!this.needOnline()) throw __offlineError();
    let cred;
    try {
      cred = await FB.auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
      throw new Error(this.authErrorMessage(error));
    }
    const uid = cred.user.uid;
    let snap = null;
    try {
      snap = await FB.db.collection('customers').doc(uid).get();
    } catch (error) {
      try { await FB.auth.signOut(); } catch (e) {}
      throw new Error(this.authErrorMessage(error));
    }
    const data = snap && snap.exists ? snap.data() : null;
    const reject = async msg => { try { await FB.auth.signOut(); } catch (e) {} throw new Error(msg); };
    if (!data) await reject('Akun tidak ditemukan, silakan daftar dulu');
    if (data.approvalStatus === 'pending') await reject('Pendaftaran masih menunggu persetujuan warung');
    if (data.approvalStatus === 'rejected') await reject('Pendaftaran ditolak');
    await this.whenSessionReady();
    return { id: uid, name: data.name || 'Pelanggan' };
  },

  /* Masuk admin: email+password + custom claim admin:true.
   * Bukan admin → pesan error + signOut. TIDAK ADA pendaftaran mandiri. */
  async loginAdmin(email, password) {
    if (!this.needOnline()) throw __offlineError();
    let cred;
    try {
      cred = await FB.auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
      throw new Error(this.authErrorMessage(error));
    }
    let claims = null;
    try {
      const token = await cred.user.getIdTokenResult(true);
      claims = (token && token.claims) || {};
    } catch (error) { claims = null; }
    if (!claims || claims.admin !== true) {
      try { await FB.auth.signOut(); } catch (e) {}
      throw new Error('Akun ini bukan admin');
    }
    await this.whenSessionReady();
    if (S.sessionRole !== 'admin') {
      // Sesi auth tidak berubah (pengguna sudah masuk) sehingga handleAuthState
      // tidak jalan ulang — pasang status admin eksplisit (klaim sudah terverifikasi).
      this.clearRoleSubs();
      S.isGuest = false;
      S.sessionRole = 'admin';
      S.sessionName = 'Admin Warunge Mimi';
      S.sessionStartedAt = new Date().toISOString();
      S.activeCustomerId = null;
      this.startAdminSubs();
      this.render('session', 'profile');
    }
    return { email: email };
  },

  async logout() {
    this.clearRoleSubs();
    this.setGuestSession();
    try { await FB.auth.signOut(); } catch (e) {}
    this.render('session', 'profile', 'orders', 'coins', 'customerNotes', 'customers',
      'journal', 'stockNotes', 'chat', 'inbox');
  },
});

/* ---------------- API tulis (semua: requireOnline dulu) ---------------- */

Object.assign(Store, {

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
  async completeCashSale({ lines, total, profit, itemCount }) {
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
    batch.set(db.collection('journal').doc(), {
      type: 'pemasukan', category: 'penjualan',
      amount: Math.round(total),
      note: 'Penjualan · Kasir', refId: '', method: 'Tunai',
      profit: Math.round(profit || 0), itemCount: itemCount || 0,
      createdAt: ts,
    });
    await batch.commit();
  },

  /* Produk: tambah (stok awal langsung) / ubah (stok via DELTA, bukan absolut) */
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
        await batch.commit();
        done += slice.length;
        if (onProgress) onProgress(done, ops.length);
      }
    } catch (e) {
      e.importedSoFar = done;
      throw e;
    }
    return { created, updated, total: ops.length };
  },

  /* Jurnal manual / dari alur lain (bentuk UI -> skema) */
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
    await batch.commit();
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

  /* Selesaikan pesanan online: status → selesai + jurnal penjualan
   * (+ beban promosi bila ada koin ditukar). Stok sudah dikurangi saat checkout. */
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

  /* Persetujuan pendaftar */
  async approveCustomer(uid) {
    if (!this.needOnline()) throw __offlineError();
    this.assertAdmin();
    await FB.db.collection('customers').doc(uid).update({ approvalStatus: 'approved' });
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
    await batch.commit();
  },

  /* Chat: kirim pesan (thread dibuat dulu agar lolos rules get()) */
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
    const threadRef = db.collection('chat_threads').doc(threadId);
    const unreadField = side === 'admin' ? 'unreadCustomer' : 'unreadAdmin';
    const header = { type: 'toko', customerId: customerId, lastMessage: text, updatedAt: ts };
    header[unreadField] = FB.FieldValue.increment(1);
    await __withTimeout(threadRef.set(header, { merge: true }), WRITE_TIMEOUT_MS, 'Kirim pesan');
    await __withTimeout(threadRef.collection('messages').add({
      senderId: side === 'admin' ? 'admin' : customerId,
      senderRole: side,
      text: text,
      createdAt: ts,
    }), WRITE_TIMEOUT_MS, 'Kirim pesan');
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

  /* Catatan toko / kasbon digital: admin tulis, pelanggan baca di Akun.
   * `date` opsional (string YYYY-MM-DD) — disimpan sebagai noteDate. */
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

  /* ---------------- Catatan Toko, resep, titip, profil (API tulis baru) ---------------- */

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

  /* Promo carousel: admin kelola koleksi `promos` (rantai C8).
   * Field: title, copy, badge, isActive. Carousel publik membaca yang isActive==true. */
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

  /* Titip barang: pelanggan tulis ke `titip_requests` (status awal 'baru') */
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
});

/* Boot lapisan data — sebelum js/app.js (render dipicu ulang setelah
 * app.js mendaftarkan Store.renderers + memanggil Store.refreshAll()). */
Store.init().catch(function (error) {
  console.error('[KasirQuh] Store.init gagal:', error);
});
