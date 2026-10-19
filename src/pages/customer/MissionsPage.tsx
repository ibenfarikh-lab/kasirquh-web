/**
 * KasirQuh React — src/pages/customer/MissionsPage.tsx
 * Pengganti MissionsSheet (#missionsModal + #gameModal + #buruDiskonModal;
 * js/features/customer/coins.js) — halaman penuh, bukan modal.
 *
 * TODO(koordinator): klaim koin misi/game masih lokal — gantikan dengan
 * Store.grantCoins / grantGameCoins (transaksi Firestore) saat worker koin selesai.
 */
import { useNavigate } from 'react-router-dom'
import { toast } from '../../components/ui'
import { useCoinLocal, useOrdersLocal, useSessionLocal, useSettingsLocal, weekKeyOf } from '../../features/customer/local'
import { useAuthStore } from '../../stores/auth'
import { todayKeyJakarta } from '../../lib/firestore'

const GAME_MAX_COINS_DAY = 500

export default function MissionsPage() {
  const navigate = useNavigate()
  const balance = useCoinLocal((s) => s.balance)
  const grant = useCoinLocal((s) => s.grant)
  const missionClaims = useCoinLocal((s) => s.missionClaims)
  const history = useOrdersLocal((s) => s.history)
  const isGuest = useSessionLocal((s) => s.isGuest)
  const customerId = useSessionLocal((s) => s.customerId)
  const settings = useSettingsLocal((s) => s.settings)
  const myCustomerDoc = useAuthStore((s) => s.myCustomerDoc)

  // Progres koin game hari ini (live dari Firestore, per-game terpisah).
  const todayKey = todayKeyJakarta()
  const tangkapToday =
    myCustomerDoc && (myCustomerDoc as Record<string, unknown>).gameCoinsDate === todayKey
      ? Math.max(0, Math.floor(Number((myCustomerDoc as Record<string, unknown>).gameCoinsToday) || 0))
      : 0
  const buruToday =
    myCustomerDoc && (myCustomerDoc as Record<string, unknown>).buruGameCoinsDate === todayKey
      ? Math.max(0, Math.floor(Number((myCustomerDoc as Record<string, unknown>).buruGameCoinsToday) || 0))
      : 0

  const balanceText = balance > 0 ? balance.toLocaleString('id-ID') + ' koin' : 'Belum ada koin'

  // --- Misi Belanja 3x (port renderMissions) ---
  const today = new Date(todayKeyJakarta() + 'T12:00:00+07:00')
  const wk = weekKeyOf(today)
  const shopCount = Math.min(
    3,
    history.filter((o) => {
      const d = new Date((o.dateKey || todayKeyJakarta()) + 'T12:00:00+07:00')
      const days = (today.getTime() - d.getTime()) / 86400000
      return days >= 0 && days < 7
    }).length,
  )
  const shopDetail = 'Misi Belanja 3 kali · ' + wk
  const shopKey = 'misi_belanja3_' + wk
  const shopClaimed = !!missionClaims[shopKey]

  function claimMission(detailLabel: string, claimKey: string) {
    if (!settings.coinProgramEnabled || !settings.coinEvents.mission) {
      toast('Event misi sedang dimatikan admin')
      return
    }
    if (isGuest || !customerId) {
      toast('Masuk dulu untuk klaim koin')
      return
    }
    // Hadiah misi via klaim resmi (transaksi Firestore, idempoten per claimKey).
    grant(settings.coinRewards.mission, { label: 'Hadiah misi', detail: detailLabel, claimKey })
  }

  // --- Misi Coba produk baru (port renderMissions) ---
  const mine = [...history].sort((a, b) => String(b.dateKey || '').localeCompare(String(a.dateKey || '')))
  const priorIds = new Set<string>()
  mine.slice(1).forEach((o) => (o.stockLines || []).forEach((l) => l.productId && priorIds.add(l.productId)))
  const latestIds = ((mine[0] || {}).stockLines || []).map((l) => l.productId).filter(Boolean)
  const newThisOrder = latestIds.some((id) => !priorIds.has(id))
  const newKey = 'misi_coba_produk_baru'
  const newClaimed = !!missionClaims[newKey]

  return (
    <div id="missionsCustomerView" className="customer-view">
      <header className="plain-head top-safe">
        <div>
          <p className="page-kicker">Misi 7 hari terakhir</p>
          <h1>Misi koin</h1>
        </div>
      </header>
      <main className="content">
        <p className="coin-tagline">Koinnya bisa dicari sambil main, belanjanya jadi makin murah!</p>
        <div className="coin-balance-inline">
          Saldo <span id="missionCoinBalance">{balanceText}</span>
        </div>

        <article className="mission-card">
          <header>
            <h3>Belanja 3 kali</h3>
            <span className="notice-count" id="missionShopCount">
              {shopCount}/3
            </span>
          </header>
          <p>Belanja dari 3 transaksi berbeda dalam 7 hari terakhir.</p>
          <div className="progress-track">
            <span id="missionShopBar" style={{ width: Math.round((shopCount / 3) * 100) + '%' }} />
          </div>
          <button
            id="missionShopBtn"
            disabled={!(shopCount >= 3 && !shopClaimed)}
            onClick={() => claimMission(shopDetail, shopKey)}
          >
            {shopClaimed ? 'Sudah diambil' : '+' + settings.coinRewards.mission + ' koin'}
          </button>
        </article>

        <article className="mission-card" id="newProductMission">
          <header>
            <h3>Coba produk baru</h3>
            <span className="stock-pill" id="missionNewState">
              {newThisOrder ? 'Selesai' : 'Belum ada'}
            </span>
          </header>
          <p>Sudah mencoba barang yang belum pernah dibeli.</p>
          <div className="progress-track">
            <span className="mission-full" />
          </div>
          <button
            id="claimMissionBtn"
            disabled={!(newThisOrder && !newClaimed && settings.coinProgramEnabled && settings.coinEvents.mission)}
            onClick={() => claimMission('Misi Coba produk baru', newKey)}
          >
            {newClaimed ? 'Sudah diambil' : !newThisOrder ? 'Belum tersedia' : 'Ambil +' + settings.coinRewards.mission + ' koin'}
          </button>
        </article>

        <p className="coin-section-title">Game Berhadiah</p>

        <article className="mission-card" id="gameMission">
          <header>
            <h3>Tangkap Diskon</h3>
            <span className="stock-pill" id="gameDayProgress">
              Hari ini: {tangkapToday}/{GAME_MAX_COINS_DAY} koin
            </span>
          </header>
          <p>Tangkap diskon 60 detik! 1000 poin = 1 koin, bebas main.</p>
          <div className="progress-track">
            <span className="mission-full" />
          </div>
          <button
            id="playGameBtn"
            onClick={() => {
              if (!settings.coinProgramEnabled) {
                toast('Program koin sedang dimatikan admin')
                return
              }
              if (!settings.coinEvents.tangkapDiskon) {
                toast('Game Tangkap Diskon sedang dimatikan admin')
                return
              }
              navigate('/beranda/game/tangkap-diskon')
            }}
          >
            Main Tangkap Diskon
          </button>
        </article>

        <article className="mission-card" id="buruDiskonMission">
          <header>
            <h3>Buru Diskon</h3>
            <span className="stock-pill" id="buruDayProgress">
              Hari ini: {buruToday}/{GAME_MAX_COINS_DAY} koin
            </span>
          </header>
          <p>Tangkap barang diskon pakai keranjang! 1000 poin = 1 koin, bebas main.</p>
          <div className="progress-track">
            <span className="mission-full" />
          </div>
          <button
            id="playBuruBtn"
            onClick={() => {
              if (!settings.coinProgramEnabled) {
                toast('Program koin sedang dimatikan admin')
                return
              }
              if (!settings.coinEvents.buruDiskon) {
                toast('Game Buru Diskon sedang dimatikan admin')
                return
              }
              navigate('/beranda/game/buru-diskon')
            }}
          >
            Main Buru Diskon
          </button>
        </article>

        <article className="mission-card" id="guessMission">
          <header>
            <h3>Tebak Harga</h3>
            <span className="stock-pill">1x/hari</span>
          </header>
          <p>Tebak harga produk dari foto aslinya, dapat koin.</p>
          <div className="progress-track">
            <span className="mission-full" />
          </div>
          <button onClick={() => navigate('/beranda/kuis')}>Main Tebak Harga</button>
        </article>

        <p className="service-note">Koin yang diambil langsung masuk ke dompet Koin Warga.</p>
      </main>
    </div>
  )
}
