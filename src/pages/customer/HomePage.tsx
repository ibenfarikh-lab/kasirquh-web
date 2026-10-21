/**
 * KasirQuh React — src/pages/customer/HomePage.tsx
 * Pengganti #homeCustomerView + js/features/customer/home.js:
 * promo carousel, resep, kabar, layanan warga, populer, restock,
 * flash sale, active order card, AI FAB/panel.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth'
import { useProductsStore } from '../../stores/products'
import { useCartStore } from '../../stores/cart'
import { useAlertsStore } from '../../stores/alerts'
import { money } from '../../lib/format'
import { todayKeyJakarta } from '../../lib/firestore'
import { Icon, Sheet, SheetHeader, toast } from '../../components/ui'
import type { Product, Recipe } from '../../types'
import {
  useSessionLocal,
  useSettingsLocal,
  useCoinLocal,
  useOrdersLocal,
  useChatLocal,
  useRecipesLocal,
  greetingForHour,
  isOpenNow,
  purchaseAgeLabel,
  aiReply,
} from '../../features/customer/local'

type SheetKey = 'priceAlert' | null

const CAROUSEL_SLOTS = [
  { key: 'flash', action: 'scroll-flash', defTitle: 'Promo Kilat', defCopy: 'Diskon spesial tiap hari, stok terbatas!', defBadge: 'KILAT' },
  { key: 'coin', action: 'coinModal', defTitle: 'Koin Warga', defCopy: 'Kumpulkan koin tiap belanja, tukarkan dengan potongan harga!', defBadge: 'KOIN' },
  { key: 'recipe', action: 'scroll-recipe', defTitle: 'Ide Masak Warga', defCopy: 'Inspirasi masak dari warga, langsung masukkan bahan ke keranjang!', defBadge: 'RESEP' },
  { key: 'budget', action: 'budgetModal', defTitle: 'Mode Anggaran', defCopy: 'Belanja hemat sesuai budget harianmu!', defBadge: 'HEMAT' },
  { key: 'hajatan', action: 'hajatanModal', defTitle: 'Paket Hajatan', defCopy: 'Paket lengkap untuk acara dan hajatan!', defBadge: 'PAKET' },
]

function recipeTotal(recipe: Recipe, products: Product[]): number {
  return recipe.items.reduce((sum, item) => {
    const p = products.find((x) => x.id === item.productId)
    return sum + (p ? p.price * item.qty : 0)
  }, 0)
}

function recipeIngredientsText(recipe: Recipe, products: Product[]): string {
  return recipe.items
    .map((item) => {
      const p = products.find((x) => x.id === item.productId)
      return p ? p.name + ' ×' + item.qty : ''
    })
    .filter(Boolean)
    .join(', ')
}

function ProductMini({
  p,
  kind,
  meta,
  qty = 1,
}: {
  p: Product
  kind: 'quick' | 'popular'
  meta?: string
  qty?: number
}) {
  const navigate = useNavigate()
  const addCustomerItem = useCartStore((s) => s.addCustomerItem)
  const out = (p.stock || 0) <= 0
  return (
    <article
      className={`${kind}-card${out ? ' out' : ''}`}
      tabIndex={0}
      role="button"
      aria-label={`Lihat detail ${p.name}`}
      onClick={() => navigate('/beranda/produk')}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate('/beranda/produk')
        }
      }}
    >
      {p.promo ? <span className="promo-flag">PROMO</span> : null}
      {out ? (
        <span className="out-ribbon" aria-hidden="true">
          HABIS
        </span>
      ) : null}
      <img src={p.img} alt={p.name} loading="lazy" />
      <h3>{p.short}</h3>
      <div className="price">{money(p.price * qty)}</div>
      {meta ? <small className="home-data-note">{meta}</small> : null}
      <button
        className="tiny-add"
        aria-label={`Tambah ${p.name}`}
        disabled={out}
        style={out ? { opacity: 0.4 } : undefined}
        onClick={(e) => {
          e.stopPropagation()
          addCustomerItem(p.id, qty)
        }}
      >
        +
      </button>
    </article>
  )
}

export default function HomePage() {
  const openAdminSheet = useAuthStore((s) => s.openAdminSheet)
  const navigate = useNavigate()
  const products = useProductsStore((s) => s.products)
  const settings = useSettingsLocal((s) => s.settings)
  const isGuest = useSessionLocal((s) => s.isGuest)
  const sessionName = useSessionLocal((s) => s.name)
  const balance = useCoinLocal((s) => s.balance)
  const activeOrder = useOrdersLocal((s) => s.activeOrder)
  const sendRumpi = useChatLocal((s) => s.sendRumpi)
  const recipes = useRecipesLocal((s) => s.recipes)
  const addCustomerItem = useCartStore((s) => s.addCustomerItem)

  const [sheet, setSheet] = useState<SheetKey>(null)
  const [aiOpen, setAiOpen] = useState(false)

  const flashRef = useRef<HTMLElement>(null)
  const recipeRef = useRef<HTMLDivElement>(null)
  const popularRef = useRef<HTMLDivElement>(null)

  // Jam saat halaman dibuka (port updatePremiumHeader); sekali per mount.
  // initializer useState hanya dipanggil sekali per mount — non-pure disengaja sebagai snapshot jam buka halaman
  // eslint-disable-next-line react-hooks/purity
  const [hour] = useState(() => new Date().getHours())
  const greeting = isGuest ? 'Mode tamu · harga & stok terbuka' : sessionName ? greetingForHour(hour) : 'Selamat datang kembali'
  const open = isOpenNow(String(settings.openTime || '06:00'), String(settings.closeTime || '21:00'))

  const coinText = balance > 0 ? balance.toLocaleString('id-ID') : '0'

  // promo carousel slides (port getCarouselSlots)
  const slides = useMemo(() => {
    const saved = settings.carouselSlots || {}
    return CAROUSEL_SLOTS.map((s) => ({
      ...s,
      title: saved[s.key + 'Title'] || s.defTitle,
      copy: saved[s.key + 'Copy'] || s.defCopy,
      badge: saved[s.key + 'Badge'] || s.defBadge,
    }))
  }, [settings.carouselSlots])

  // populer: 8 teratas dari totalTerjual (port renderHome, agregat lokal)
  const popular = useMemo(
    () =>
      products
        .filter((p) => p.isActive !== false && (p.totalTerjual || 0) > 0)
        .sort((a, b) => (b.totalTerjual || 0) - (a.totalTerjual || 0))
        .slice(0, 8),
    [products],
  )
  const history = useOrdersLocal((s) => s.history)
  const restock = useMemo(() => {
    const seen = new Map<string, string>()
    for (const o of history) {
      for (const line of o.stockLines || []) {
        if (line.productId && !seen.has(line.productId)) seen.set(line.productId, o.dateKey || todayKeyJakarta())
      }
    }
    return [...seen.entries()]
      .map(([productId, dateKey]) => ({ product: products.find((p) => p.id === productId), dateKey }))
      .filter((r) => r.product)
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey)) as { product: Product; dateKey: string }[]
  }, [history, products])

  const allRecipes = recipes

  function promoGo(action: string) {
    if (action === 'scroll-flash') {
      if (flashRef.current) flashRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      else toast('Promo kilat belum tersedia')
    } else if (action === 'scroll-recipe') {
      recipeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } else if (action === 'scroll-popular') {
      popularRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } else if (action === 'coinModal') navigate('/beranda/koin')
    else if (action === 'budgetModal') navigate('/beranda/anggaran')
    else if (action === 'hajatanModal') navigate('/beranda/hajatan')
    else if (action === 'patunganModal') navigate('/beranda/patungan')
    else if (action === 'grosirModal') navigate('/beranda/grosir')
    else if (action === 'rutinModal') navigate('/beranda/rutin')
    else if (action === 'titipModal') navigate('/beranda/titip')
    else if (action === 'missionsModal') navigate('/beranda/misi')
    else if (action === 'priceAlertModal') setSheet('priceAlert')
    else if (action === 'go-produk') navigate('/beranda/produk')
    else if (action === 'go-produk-ongkir') navigate('/beranda/produk')
    else navigate('/beranda/koin')
  }

  function addRecipeToCart(recipe: Recipe) {
    recipe.items.forEach((item) => addCustomerItem(item.productId, item.qty))
  }

  function shareRecipe(recipe: Recipe) {
    if (isGuest) {
      toast('Masuk dulu untuk berbagi ke Rumpi')
      return
    }
    const name = sessionName || 'Pelanggan'
    const text =
      'Menu Racikan dari ' + name + '\nNama Menu: ' + recipe.nama + '\nBahan-bahan: ' + recipeIngredientsText(recipe, products) + '\nPerkiraan Total: ' + money(recipeTotal(recipe, products))
    sendRumpi(text, recipe.foto || '', name, '')
    toast('Ide masak dibagikan ke Rumpi')
  }

  // Urutan seksi home ditetapkan (permintaan user 2026-10-19):
  // resep → kabar warung → layanan warga → promo kilat → populer → restock.
  // homeSections hanya dipakai untuk show/hide per seksi.
  const homeSections = settings.homeSections || { restock: { show: true, order: 1 }, popular: { show: true, order: 3 }, recipe: { show: true, order: 2 } }
  const showRecipe = homeSections.recipe?.show !== false
  const showPopular = homeSections.popular?.show !== false
  const showRestock = homeSections.restock?.show !== false

  const recipeSection = showRecipe ? (
    <section id="homeRecipeSection" className="home-section recipe-section" data-home-section="recipe">
      <div className="section-heading">
        <div>
          <p>Dari dapur tetangga</p>
          <h2>Ide masak warga</h2>
        </div>
        <span id="recipeCountHint" className="scroll-hint">
          {allRecipes.length} ide · geser →
        </span>
      </div>
      <div id="recipeGrid" className="recipe-grid" ref={recipeRef}>
        {allRecipes.length ? (
          allRecipes.map((r) => (
            <article key={r.id} className={`recipe-card${r.foto ? '' : ' no-photo'}`}>
              {r.foto ? (
                <div className="recipe-photo">
                  <img src={r.foto} alt={`Foto resep ${r.nama}`} loading="lazy" />
                </div>
              ) : null}
              <div className="recipe-copy">
                <span className="recipe-label">Warga</span>
                <h3>{r.nama}</h3>
                <p>{r.desc}</p>
                <div className="recipe-actions">
                  <button onClick={() => addRecipeToCart(r)}>+ Bahan</button>
                  <button className="recipe-share" aria-label={`Bagikan ${r.nama} ke Rumpi`} onClick={() => shareRecipe(r)}>
                    <Icon name="speaker" />
                  </button>
                </div>
                <small className="recipe-source">
                  {recipeIngredientsText(r, products)} · {money(recipeTotal(r, products))}
                </small>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-note">Belum ada ide masak.</div>
        )}
      </div>
      <button id="createMyRecipeBtn" className="create-recipe-btn" onClick={() => navigate('/beranda/resep-baru')}>
        + Buat Ide Masakku
      </button>
    </section>
  ) : null

  const popularSection = showPopular ? (
    <section id="homePopularSection" className="home-section" data-home-section="popular">
      <div className="section-heading">
        <div>
          <p>Dari transaksi seluruh pelanggan</p>
          <h2>Sedang laris</h2>
        </div>
        <span id="popularCountHint" className="scroll-hint">
          {popular.length ? `${popular.length} teratas · geser →` : 'Belum ada data'}
        </span>
      </div>
      <div id="popularGrid" className="popular-grid" ref={popularRef}>
        {popular.length ? (
          popular.map((p) => <ProductMini key={p.id} p={p} kind="popular" meta={`${p.totalTerjual} terjual`} />)
        ) : (
          <div className="empty-note">Belum ada data penjualan.</div>
        )}
      </div>
    </section>
  ) : null

  const restockSection = showRestock ? (
    <section id="homeRestockSection" className="home-section" data-home-section="restock">
      <div className="section-heading">
        <div>
          <p>Dari riwayat belanjamu</p>
          <h2>Stok rumah habis?</h2>
        </div>
        <span id="restockCountHint" className="scroll-hint">
          {restock.length ? `${restock.length} riwayat · geser →` : 'Belum ada riwayat'}
        </span>
      </div>
      <div id="restockGrid" className="quick-grid">
        {restock.length ? (
          restock.map((r) => <ProductMini key={r.product.id} p={r.product} kind="quick" meta={purchaseAgeLabel(r.dateKey)} />)
        ) : (
          <div className="empty-note">Belum ada riwayat belanja.</div>
        )}
      </div>
    </section>
  ) : null

  return (
    <div id="homeCustomerView" className="customer-view">
      <header className="home-head top-safe">
        <div className="home-brand">
          <button
            type="button"
            className="logo-admin-btn"
            aria-label="Akses admin"
            onClick={(e) => {
              e.stopPropagation()
              openAdminSheet()
            }}
          >
            <Icon name="warunge-logo" className="customer-logo icon" label="Logo Warunge Mimi" />
          </button>
          <div>
            <p className="greeting" id="timeGreeting">
              {greeting}
            </p>
            <h1>Warunge Mimi</h1>
          </div>
        </div>
        <span id="storeStatusBadge" className={`store-status${open ? '' : ' closed'}`}>
          {open ? '● BUKA' : '● TUTUP'}
        </span>
        <button className="coin-chip head-coin" onClick={() => navigate('/beranda/koin')} aria-label="Koin Warga">
          <Icon name="coin" />
          <span id="headCoinText">{coinText}</span>
        </button>
      </header>
      <main className="home-content">
        <div className="running-info">
          <Icon name="speaker" />
          <div className="running-copy">
            <span id="runningText">Buka 06.00–21.00 · Gratis antar radius 1 km untuk belanja minimal Rp25.000</span>
          </div>
        </div>

        <PromoCarousel slides={slides} onAction={promoGo} />

        {recipeSection}

        <KabarCarousel />

        {activeOrder ? (
          <button id="activeOrderCard" className="status-strip" onClick={() => navigate('/beranda/pesanan/' + activeOrder.id)}>
            <Icon name="truck" />
            <div>
              <b>Pesanan {activeOrder.id}</b>
              <small>
                {activeOrder.status} · {activeOrder.detail}
              </small>
            </div>
            <span>→</span>
          </button>
        ) : null}

        <section className="home-section">
          <div className="section-heading">
            <div>
              <p>Cara belanja baru</p>
              <h2>Layanan warga</h2>
            </div>
            <span className="scroll-hint">Geser untuk lainnya →</span>
          </div>
          <div className="service-grid">
            <button className="service-card featured" onClick={() => navigate('/beranda/titip')}>
              <Icon name="box" />
              <span>
                <b>Titip belanja</b>
                <small>Dicari saat kulakan</small>
              </span>
            </button>
            <button className="service-card" onClick={() => navigate('/beranda/anggaran')}>
              <Icon name="cash" />
              <span>
                <b>Mode anggaran</b>
                <small>Belanja sesuai uangmu</small>
              </span>
            </button>
            <button className="service-card" onClick={() => navigate('/beranda/patungan')}>
              <Icon name="users" />
              <span>
                <b>Patungan</b>
                <small>Grosir bareng warga</small>
              </span>
            </button>
            <button className="service-card" onClick={() => navigate('/beranda/grosir')}>
              <Icon name="barcode" />
              <span>
                <b>Harga grosir</b>
                <small>Otomatis per dus</small>
              </span>
            </button>
            <button className="service-card" onClick={() => navigate('/beranda/rutin')}>
              <Icon name="refresh" />
              <span>
                <b>Belanja rutin</b>
                <small>Paket mingguan</small>
              </span>
            </button>
            <button className="service-card" onClick={() => navigate('/beranda/hajatan')}>
              <Icon name="gift" />
              <span>
                <b>Paket hajatan</b>
                <small>Siap untuk acara</small>
              </span>
            </button>
            <button id="deliveryServiceBtn" className="service-card" onClick={() => navigate('/beranda/checkout')}>
              <Icon name="truck" />
              <span>
                <b>Diantar</b>
                <small>Pilih jam kirim</small>
              </span>
            </button>
            <button className="service-card" onClick={() => setSheet('priceAlert')}>
              <Icon name="bell" />
              <span>
                <b>Pantau harga</b>
                <small>Naik-turun harga tercatat</small>
              </span>
            </button>
          </div>
        </section>

        <FlashCard sectionRef={flashRef} />

        {popularSection}

        {restockSection}

      </main>

      <button id="aiFab" className="ai-fab" aria-label="Buka Teman Belanja" onClick={() => setAiOpen(true)}>
        <Icon name="spark" />
      </button>
      <AiPanel open={aiOpen} onClose={() => setAiOpen(false)} />

      <PriceAlertSheet open={sheet === 'priceAlert'} onClose={() => setSheet(null)} />
    </div>
  )
}

/* ---------- Promo carousel (port renderPromoCarousel/showPromo/startPromo) ---------- */
function PromoCarousel({
  slides,
  onAction,
}: {
  slides: { key: string; action: string; title: string; copy: string; badge: string }[]
  onAction: (action: string) => void
}) {
  const [index, setIndex] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (slides.length < 2) return
    timer.current = setInterval(() => setIndex((i) => (i + 1) % slides.length), 5000)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [slides.length])

  return (
    <section id="promoCarousel" className="promo-carousel" aria-label="Promo pilihan">
      <div
        id="promoTrack"
        className="promo-track"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((s, i) => (
          <article key={s.key} className={`promo-slide${i === index ? ' active' : ''}`}>
            {s.badge ? <span className="promo-flag">{s.badge}</span> : null}
            <div className="promo-row">
              <h3>{s.title}</h3>
              <button className="promo-cta" onClick={() => onAction(s.action)}>
                Lihat →
              </button>
            </div>
            <p>{s.copy}</p>
          </article>
        ))}
      </div>
      <div className="promo-dots" id="promoDots">
        {slides.map((s, i) => (
          <button
            key={s.key}
            className={`promo-dot${i === index ? ' active' : ''}`}
            data-promo-slide={i}
            aria-label={`Tampilkan promo ${i + 1}`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </section>
  )
}

/* ---------- Kabar Warung (port renderKabar + initKabarCarousel) ---------- */
function KabarCarousel() {
  const settings = useSettingsLocal((s) => s.settings)
  const [index, setIndex] = useState(0)

  const mood = useMemo(() => {
    const now = new Date()
    const hour = now.getHours()
    const day = now.getDay()
    const isWeekend = day === 0 || day === 6
    const msgs: Record<string, [string, string][]> = {
      dawn: [
        ['Selamat dini hari', 'Lapar tengah malam? Mi instan dan kopi selalu siap menemani begadangmu.'],
        ['Waktunya istirahat', 'Besok pagi jangan lupa sarapan — roti dan susu sudah tersedia di warung.'],
      ],
      morning: [
        ['Selamat pagi', 'Kopi hangat dan mi praktis buat mulai hari dengan semangat!'],
        ['Pagi yang cerah', 'Sarapan dulu yuk — ada roti, susu, dan kopi untuk awali harimu.'],
        ['Semangat pagi', 'Stok dapur aman? Cek kebutuhan harianmu sebelum beraktivitas.'],
      ],
      noon: [
        ['Selamat siang', 'Istirahat siang enaknya ngemil — ada banyak snack dan minuman dingin.'],
        ['Waktunya makan siang', 'Jangan lupa minum yang cukup, air mineral dingin tersedia.'],
        ['Siang yang terik', 'Dingin-dingin dulu yuk, es teh dan minuman segar menanti.'],
      ],
      afternoon: [
        ['Selamat sore', 'Teh hangat dan camilan cocok untuk waktu santai soremu.'],
        ['Sore yang syahdu', 'Persiapan makan malam? Minyak, bumbu, dan mi tersedia lengkap.'],
        ['Menjelang malam', 'Cek stok rumah — jangan sampai kehabisan gas atau beras besok pagi.'],
      ],
      evening: [
        ['Selamat malam', 'Mi hangat dan kopi cocok untuk teman lembur malammu.'],
        ['Malam yang tenang', 'Butuh camilan nonton? Snack dan minuman dingin siap.'],
        ['Istirahat malam', 'Besok butuh bekal? Siapkan dari sekarang, warung masih buka.'],
      ],
      latenight: [
        ['Sudah larut', 'Warung segera tutup — pastikan kebutuhan besok pagi sudah aman.'],
        ['Jangan begadang terus', 'Tidur cukup ya, besok bisa belanja lagi di warung.'],
      ],
    }
    let slot = 'afternoon'
    if (hour < 4) slot = 'latenight'
    else if (hour < 6) slot = 'dawn'
    else if (hour < 10) slot = 'morning'
    else if (hour < 15) slot = 'noon'
    else if (hour < 18) slot = 'afternoon'
    else if (hour < 22) slot = 'evening'
    else slot = 'latenight'
    const pool = msgs[slot]
    const pick = pool[Math.floor(Math.random() * pool.length)]
    let title = pick[0]
    let copy = pick[1]
    if (isWeekend && (slot === 'morning' || slot === 'noon')) {
      title += ' · Akhir pekan'
      copy += ' Nikmati weekend dengan stok camilan lengkap!'
    }
    return { title, copy }
    // mood sengaja dihitung sekali per mount dari snapshot jam buka — tidak perlu dihitung ulang tiap render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % 2), 5000)
    return () => clearInterval(t)
  }, [])

  const open = isOpenNow(String(settings.openTime || '06:00'), String(settings.closeTime || '21:00'))
  const closeT = String(settings.closeTime || '21:00')
  const openT = String(settings.openTime || '06:00')
  const statusOverride = String(settings.kabarStatus || '').trim()
  const moodOverride = String(settings.kabarMood || '').trim()
  const activeCount = useOrdersLocal((s) => (s.activeOrder ? 1 : 0))

  return (
    <section id="kabarCarousel" className="kabar-carousel" aria-label="Kabar Warung" aria-roledescription="carousel">
      <span className="kabar-label">KABAR WARUNG</span>
      <div id="kabarTrack" className="kabar-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        <article className="kabar-slide">
          <span id="liveDot" className="live-dot" style={{ background: open ? '#4d9b65' : '#9b8f89' }} />
          <div>
            <b id="liveStatus">{statusOverride || (open ? 'Buka sekarang' : 'Warung sedang tutup')}</b>
            <small id="liveDetail">
              {open
                ? activeCount
                  ? `Tutup ${closeT} · ${activeCount} pesanan sedang disiapkan`
                  : `Tutup ${closeT} · Belum ada pesanan disiapkan`
                : `Buka lagi pukul ${openT} · pesanan bisa disiapkan nanti`}
            </small>
          </div>
        </article>
        <article className="kabar-slide">
          <Icon name="spark" />
          <div>
            <b id="moodTitle">{mood.title}</b>
            <small id="moodCopy">{moodOverride || mood.copy + ' Kalau hujan, pilih diantar.'}</small>
          </div>
        </article>
      </div>
      <div className="kabar-dots" aria-label="Pilih kabar">
        {[0, 1].map((i) => (
          <button
            key={i}
            className={`kabar-dot${i === index ? ' active' : ''}`}
            aria-label={i === 0 ? 'Status warung' : 'Saran suasana'}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </section>
  )
}

/* ---------- Flash sale (port renderFlashCard) ---------- */
function FlashCard({ sectionRef }: { sectionRef: React.Ref<HTMLElement> }) {
  const products = useProductsStore((s) => s.products)
  const settings = useSettingsLocal((s) => s.settings)
  const addCustomerItem = useCartStore((s) => s.addCustomerItem)

  /* Countdown BERJALAN (interval 1 detik) menuju flashEndsAt; promo mati
   * otomatis begitu flashEndsAt lewat (seperti Native home_tab.dart).
   * Tanpa flashEndsAt, target fallback = akhir hari (perilaku lama). */
  const endsAtMs =
    settings.flashEndsAt && typeof settings.flashEndsAt.toMillis === 'function'
      ? settings.flashEndsAt.toMillis()
      : null
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const end = endsAtMs ?? new Date().setHours(24, 0, 0, 0)
  const left = Math.max(0, Math.floor((end - nowMs) / 1000))
  const countdown = `${String(Math.floor(left / 3600)).padStart(2, '0')}:${String(
    Math.floor((left % 3600) / 60),
  ).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`

  const product = settings.flashProductId ? products.find((p) => p.id === settings.flashProductId) : undefined

  if (!product) return null
  if (endsAtMs !== null && left <= 0) return null
  const price = settings.promoUnitPrice[product.id] || product.price

  return (
    <section id="flashCard" className="flash-card" ref={sectionRef}>
      <div>
        <small>
          PROMO KILAT · BERAKHIR DALAM <span id="flashCountdown" className="countdown">{countdown}</span>
        </small>
        <b id="flashTitle">
          {product.name} cuma {money(price)}
        </b>
        <small id="flashRule">{String(settings.flashRule || 'Selama persediaan masih ada.')}</small>
      </div>
      <button id="flashAdd" onClick={() => addCustomerItem(product.id)}>
        + Ambil
      </button>
    </section>
  )
}

/* ---------- AI Teman Belanja (port aiReply) ---------- */
function AiPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const products = useProductsStore((s) => s.products)
  const settings = useSettingsLocal((s) => s.settings)
  const [message, setMessage] = useState('Halo! Mau cari barang apa hari ini?')
  const [input, setInput] = useState('')

  function ask(text: string) {
    const q = text.trim()
    if (!q) return
    setMessage(
      aiReply(q, products, {
        coinProgramEnabled: settings.coinProgramEnabled,
        open: isOpenNow(String(settings.openTime || '06:00'), String(settings.closeTime || '21:00')),
      }),
    )
    setInput('')
  }

  if (!open) return null
  return (
    <aside id="aiPanel" className="ai-panel open" aria-label="Asisten Belanja">
      <div className="ai-head">
        <div>
          <b>Teman Belanja</b>
          <small>Tanya stok dan harga cepat</small>
        </div>
        <button id="aiClose" aria-label="Tutup" onClick={onClose}>
          ×
        </button>
      </div>
      <div id="aiMessage" className="ai-message">
        {message}
      </div>
      <div className="ai-chips">
        <button onClick={() => ask('minyak')}>Stok minyak?</button>
        <button onClick={() => ask('murah')}>Camilan termurah</button>
        <button onClick={() => ask('promo')}>Ada promo?</button>
      </div>
      <div className="ai-input-row">
        <input
          id="aiInput"
          placeholder="Ketik pertanyaan..."
          maxLength={100}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') ask(input)
          }}
        />
        <button id="aiSend" aria-label="Kirim" onClick={() => ask(input)}>
          ➤
        </button>
      </div>
    </aside>
  )
}

/* ---------- Pantau Harga (sheet kecil lokal; daftar dari alerts store) ---------- */
function PriceAlertSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const alerts = useAlertsStore((s) => s.alerts)
  const toggle = useAlertsStore((s) => s.toggle)
  const products = useProductsStore((s) => s.products)

  const rows = alerts
    .map((w) => ({ watch: w, product: products.find((p) => p.id === w.productId) }))
    .filter((r) => r.product) as { watch: (typeof alerts)[number]; product: Product }[]

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader kicker="Harga yang kamu pantau" title="Pantau Harga" onClose={onClose} />
      <div id="priceAlertList" className="service-list">
        {rows.length ? (
          rows.map((row) => {
            const diff = row.product.price - row.watch.priceAtWatch
            const state = diff < 0 ? 'Turun' : diff > 0 ? 'Naik' : 'Tetap'
            return (
              <article key={row.watch.productId} className="service-row">
                <img src={row.product.img} alt={row.product.name} style={{ width: 36, height: 36, objectFit: 'contain' }} />
                <div>
                  <h3>{row.product.name}</h3>
                  <p>
                    Saat ditandai {money(row.watch.priceAtWatch)} · kini {money(row.product.price)} · <b>{state}</b>
                  </p>
                </div>
                <button
                  onClick={() => {
                    toggle(row.watch)
                    toast('Pantauan harga dilepas')
                  }}
                >
                  Hapus
                </button>
              </article>
            )
          })
        ) : (
          <div className="empty-note">
            Belum ada barang dipantau.
            <br />
            <small>Buka detail produk lalu pilih “Pantau harga”.</small>
          </div>
        )}
      </div>
      <button className="secondary-wide" onClick={onClose}>
        Lihat produk
      </button>
    </Sheet>
  )
}
