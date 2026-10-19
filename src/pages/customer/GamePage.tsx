/**
 * KasirQuh React — src/pages/customer/GamePage.tsx
 * Halaman penuh untuk game Tangkap Diskon & Buru Diskon.
 * (Sebelumnya GameSheet di dalam MissionsSheet.)
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCoinLocal, useSessionLocal } from '../../features/customer/local'

const GAME_POINTS_PER_COIN = 1000
const GAME_MAX_COINS_DAY = 500
const GAME_SESSION_MAX_POINTS = 60000
const GAME_MIN_DURATION_MS = 20000

export default function GamePage() {
  const { kind } = useParams<{ kind: string }>()
  const navigate = useNavigate()
  const grant = useCoinLocal((s) => s.grant)
  const isGuest = useSessionLocal((s) => s.isGuest)
  const [pending, setPending] = useState<{ points: number; coins: number } | null>(null)
  const [scoreText, setScoreText] = useState('0 poin')
  const [coinText, setCoinText] = useState('= 0 koin')
  const [note, setNote] = useState('')
  const [frameKey, setFrameKey] = useState(0)

  const isBuru = kind === 'buru-diskon'
  const expectedType = isBuru ? 'buruDiskonScore' : 'tangkapDiskonScore'
  const frameSrc = isBuru ? '/games/buru-diskon.html?v=20261020av' : '/games/tangkap-diskon.html?v=20261020av'
  const title = isBuru ? 'Buru Diskon' : 'Tangkap Diskon'

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return
      const d = e.data
      if (!d || d.type !== expectedType) return
      const points = Math.max(0, Math.floor(Number(d.points) || 0))
      const durationMs = Math.max(0, Number(d.durationMs) || 0)
      const coins = Math.floor(points / GAME_POINTS_PER_COIN)
      const sane = points > 0 && points <= GAME_SESSION_MAX_POINTS && durationMs >= GAME_MIN_DURATION_MS
      setPending(sane ? { points, coins } : null)
      setScoreText(points.toLocaleString('id-ID') + ' poin')
      if (!sane) {
        setCoinText('Skor tidak wajar.')
        setNote('Mainkan gamenya sampai selesai ya.')
      } else if (isGuest) {
        setCoinText('= ' + coins + ' koin')
        setNote('Login/daftar dulu untuk klaim koinmu.')
      } else if (coins <= 0) {
        setCoinText('Belum cukup untuk 1 koin (butuh 1000 poin).')
        setNote(isBuru ? 'Coba lagi — tangkap yang berlabel diskon.' : 'Coba lagi — makin banyak diskon tertangkap, makin banyak poin.')
      } else {
        setCoinText('= ' + coins + ' koin')
        setNote('Maksimal 500 koin/hari dari game.')
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [expectedType, isGuest, isBuru])

  function claim() {
    if (!pending || !pending.coins) return
    grant(Math.min(pending.coins, GAME_MAX_COINS_DAY), {
      label: isBuru ? 'Buru Diskon' : 'Tangkap Diskon',
      detail: pending.points.toLocaleString('id-ID') + ' poin',
      reason: isBuru ? 'game_buru_diskon' : 'game_tangkap_diskon',
      dateField: isBuru ? 'buruGameCoinsDate' : 'gameCoinsDate',
      todayField: isBuru ? 'buruGameCoinsToday' : 'gameCoinsToday',
    })
    setPending(null)
    // Jangan navigate langsung — biarkan toast hasil klaim terlihat dulu
    setTimeout(() => navigate(-1), 1500)
  }

  const canClaim = !!pending && pending.coins > 0 && !isGuest

  return (
    <div id="gameView" className="customer-view">
      <header className="plain-head top-safe">
        <div>
          <small className="kicker">Misi Koin · Game</small>
          <h1>{title}</h1>
        </div>
      </header>
      <main className="content game-page-content">
        <div className="game-wrap game-fullpage">
          <iframe
            key={frameKey}
            className="game-frame"
            title={'Game ' + title}
            src={frameSrc}
            sandbox="allow-scripts allow-same-origin"
          />
          <div className="game-claim" hidden={!pending}>
            <b>{scoreText}</b>
            <p>{coinText}</p>
            <p className="game-note">{note}</p>
            <div className="game-claim-actions">
              <button
                className="ghost"
                onClick={() => {
                  setPending(null)
                  setScoreText('0 poin')
                  setCoinText('= 0 koin')
                  setNote('')
                  setFrameKey((k) => k + 1)
                }}
              >
                Main lagi
              </button>
              {canClaim ? (
                <button className="primary" onClick={claim}>
                  Klaim +{pending!.coins} koin
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
