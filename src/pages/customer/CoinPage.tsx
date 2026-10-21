import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCoinLocal, useSettingsLocal } from '../../features/customer/local'

export default function CoinPage() {
  const navigate = useNavigate()
  const balance = useCoinLocal((s) => s.balance)
  const history = useCoinLocal((s) => s.history)
  const settings = useSettingsLocal((s) => s.settings)
  const [bannerIdx, setBannerIdx] = useState(0)

  const balanceText = balance > 0 ? balance.toLocaleString('id-ID') + ' koin' : 'Belum ada koin'
  const rupiahText = balance > 0 ? 'Rp' + (balance * settings.coinValue).toLocaleString('id-ID') : 'Belum ada koin'

  const bannerMsgs: string[] = []
  if (settings.coinProgramEnabled) {
    if (settings.coinEvents.tangkapDiskon) bannerMsgs.push('Sudah main Tangkap Diskon hari ini? 500 koin menanti!')
    if (settings.coinEvents.buruDiskon) bannerMsgs.push('Sudah main Buru Diskon hari ini? 500 koin menanti!')
    if (settings.coinEvents.guess)
      bannerMsgs.push('Sudah tebak harga hari ini? +' + settings.coinRewards.guess.toLocaleString('id-ID') + ' koin menanti!')
  }
  useEffect(() => {
    if (bannerMsgs.length < 2) return
    const t = setInterval(() => setBannerIdx((i) => (i + 1) % bannerMsgs.length), 4000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rules = [
    'Bonus harian: +' + settings.coinRewards.checkin.toLocaleString('id-ID') + ' koin (1x sehari)',
    'Belanja: +' + settings.coinRewards.spend.toLocaleString('id-ID') + ' koin tiap Rp' + settings.coinSpendRule.toLocaleString('id-ID') + ' (otomatis)',
    'Misi koin: +' + settings.coinRewards.mission.toLocaleString('id-ID') + ' koin per misi',
    'Tebak harga: +' + settings.coinRewards.guess.toLocaleString('id-ID') + ' koin (1x sehari)',
    'Tukar: maks ' + settings.coinRedeemPercent.toLocaleString('id-ID') + '% dari total belanja',
  ]

  return (
    <div id="coinCustomerView" className="customer-view">
      <header className="plain-head top-safe">
        <div>
          <p className="page-kicker">Dompet loyalti</p>
          <h1>Koin Warga</h1>
        </div>
      </header>
      <main className="content">
        <p className="coin-tagline">Belanja dapat koin, main game dapat koin — semua jadi diskon!</p>
        <div className="order-hero">
          <small>Saldo tersedia</small>
          <h3 id="coinBalance" style={{ fontSize: 30 }}>
            {balanceText}
          </h3>
          <div className="coin-value-line">
            <span>Nilai rupiah</span>
            <b id="coinRupiahValue">{rupiahText}</b>
          </div>
        </div>
        {bannerMsgs.length ? (
          <div id="coinPromoBanner" className="coin-promo-banner">
            {bannerMsgs[bannerIdx]}
          </div>
        ) : null}
        <p className="coin-section-title">Jalan pintas</p>
        <div className="coin-shortcuts" style={{ gridTemplateColumns: '1fr' }}>
          <button className="coin-shortcut-btn" onClick={() => navigate('/beranda/misi')}>
            <span>Misi koin</span>
          </button>
        </div>
        <p className="coin-section-title">Aturan program</p>
        <ul id="coinRuleList" className="coin-rule-list">
          {rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <small id="coinRuleText" style={{ color: 'var(--muted)' }}>
          {String(settings.coinRule || '')}
        </small>
        <p className="coin-section-title">Riwayat Koin</p>
        <div id="coinHistory" className="coin-history">
          {history.length ? (
            history.map((x, i) => {
              const plus = x.kind === 'income'
              return (
                <article key={i} className="coin-history-row">
                  <span className={`coin-history-icon ${plus ? 'in' : 'out'}`}>{plus ? '+' : '−'}</span>
                  <span className="coin-history-main">
                    <b>{x.label}</b>
                    <small>{x.sub || ''}</small>
                  </span>
                  <span className={`coin-history-amount ${plus ? 'in' : 'out'}`}>
                    {plus ? '+' : '−'}
                    {Number(x.amount || 0).toLocaleString('id-ID')}
                  </span>
                </article>
              )
            })
          ) : (
            <div className="notification-empty">Belum ada riwayat koin.</div>
          )}
        </div>
      </main>
    </div>
  )
}
