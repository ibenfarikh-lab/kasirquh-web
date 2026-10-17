/* KasirQuh — Store Module: Core
 * FASE 11 refactor store.js (2026-10-16)
 * Berisi: __todayKey, S (state global), __offlineError, __withTimeout,
 *   WRITE_TIMEOUT_MS, StoreCore (properti + util + mapper)
 * CATATAN: fondasi semua modul. Dimuat PERTAMA sebelum modul lain.
 */
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
  flashProductName: '',
  pendingProductDeleteId: null,
  customerTheme: 'light',
  adminTheme: 'dark',
  navMotion: true, // preferensi admin (persist di store_settings/main.adminNavMotion)
  activeRole: null,
  sessionRole: null,
  _loginDoor: null, // 'customer' saat login via pintu pelanggan (untuk cegah admin salah pintu)
  sessionName: null,
  sessionStartedAt: null,
  activeCustomerId: null,
  kasirMember: null, /* Opsi A: member teridentifikasi di kasir */
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
  coinEvents: {checkin:true,mission:true,guess:true,spend:true,tangkapDiskon:true},
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
  carouselSlots: {},
  dashboardShortcutEdit: false,
  activePurchaseDate: __todayKey, // dulu: todayKey
  purchaseNotes: {}, // koleksi `stock_notes` (admin, live) — dikelompokkan per tanggal
  editingPurchaseNote: null,
  inboxItems: [], // diturunkan: antrean pelanggan + pesanan aktif + stok menipis + chat
  inboxReadIds: [], // ID notifikasi yg sudah dibaca (persisten Firestore)
  patunganList: [], // koleksi `patungan` (limit 20, hemat kuota)
  rutinPackages: [], // koleksi `rutinPackages`
  hajatanPackages: [], // koleksi `hajatanPackages`
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
  code39: {"0":"nnnwwnwnn","1":"wnnwnnnnw","2":"nnwwnnnnw","3":"wnwwnnnnn","4":"nnnwwnnnw","5":"wnnwwnnnn","6":"nnwwwnnnn","7":"nnnwnnwnw","8":"wnnwnnwnn","9":"nnwwnnwnn","A":"wnnnnwnnw","B":"nnwnnwnnw","C":"wnwnnwnnn","D":"nnnnwwnnw","E":"wnnnwwnnn","F":"nnwnwwnnn","G":"nnnnnwwnw","H":"wnnnnwwnn","I":"nnwnnwwnn","J":"nnnnwwwnn","K":"wnnnnnnww","L":"nnwnnnnww","M":"wnwnnnnwn","N":"nnnnwnnww","O":"wnnnwnnwn","P":"nnwnwnnwn","Q":"nnnnnnwww","R":"wnnnnnwwn","S":"nnwnnnwwn","T":"nnnnwnwwn","U":"wwnnnnnnw","V":"nwwnnnnnw","W":"wwwnnnnnn","X":"nwnnwnnnw","Y":"wwnnwnnnn","Z":"nwwnwnnnn","-":"nwnnnnwnw","*":"nwnnwnwnn"," ":"nwwnnwnnn"},
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

const StoreCore = {  /* Diisi js/app.js saat boot: nama -> fungsi render, dan (msg)=>toast(msg) */
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
    /* Catat ke log error terlihat (2026-10-16) */
    try {
      if (typeof window.KasirQuhLogError === 'function') {
        window.KasirQuhLogError('firestore:' + label, error);
      }
    } catch (e) {}
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
      active: d.active !== false,
      name: name,
      short: name.length > 17 ? name.slice(0, 16) + '…' : name,
      cat: d.category || 'Lainnya',
      unit: d.unit || 'pcs',
      price: Math.max(0, Math.round(Number(d.price) || 0)),
      cost: Math.max(0, Math.round(Number(d.costPrice) || 0)),
      stock: Math.max(0, Number(d.stock) || 0),
      img: d.photoUrl || IMG_EMPTY,
      hasPhoto: !!d.photoUrl,
      barcode: d.barcode || '',
      promo: !!d.promo,
      isActive: d.isActive !== false,
      lowStockAt: Number(d.lowStockAt) || 5,
      wholesaleQty: Math.max(0, Number(d.wholesaleQty) || 0),
      totalTerjual: Math.max(0, Math.round(Number(d.totalTerjual) || 0)),
      wholesalePrice: Math.max(0, Math.round(Number(d.wholesalePrice) || 0)),
      wholesaleLabel: String(d.wholesaleLabel || ''),
      oldPrice: Math.max(0, Math.round(Number(d.oldPrice) || 0)),
      budgetEligible: d.budgetEligible,
      budgetMaxQty: Math.min(20, Math.max(1, Math.round(Number(d.budgetMaxQty) || 4))),
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
