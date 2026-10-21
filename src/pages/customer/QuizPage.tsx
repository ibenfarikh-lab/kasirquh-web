import { useEffect, useState } from 'react'
import { useProductsStore } from '../../stores/products'
import { money } from '../../lib/format'
import { toast } from '../../components/ui'
import { useCoinLocal, useSettingsLocal } from '../../features/customer/local'
import { useAuthStore } from '../../stores/auth'
import { todayKeyJakarta } from '../../lib/firestore'
import type { Product } from '../../types'

const IMG_EMPTY =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5Erg=='

interface Question {
  product: Product
  options: number[]
}

function makeQuestion(products: Product[]): Question | null {
  const eligible = products.filter((p) => p.price > 0 && p.hasPhoto && p.isActive !== false)
  if (!eligible.length) return null
  const product = eligible[Math.floor(Math.random() * eligible.length)]
  const round500 = (n: number) => Math.max(500, Math.round(n / 500) * 500)
  const options = [product.price]
  let guard = 0
  while (options.length < 3 && guard < 50) {
    guard++
    const f = 0.7 + Math.random() * 0.6
    const v = round500(product.price * f)
    if (v === product.price || options.includes(v)) continue
    options.push(v)
  }
  while (options.length < 3) {
    const v = options[options.length - 1] + 500
    if (!options.includes(v)) options.push(v)
  }
  options.sort(() => Math.random() - 0.5)
  return { product, options }
}

export default function QuizPage() {
  const products = useProductsStore((s) => s.products)
  const grant = useCoinLocal((s) => s.grant)
  const settings = useSettingsLocal((s) => s.settings)
  const myCustomerDoc = useAuthStore((s) => s.myCustomerDoc)
  const lastGuessDate = (myCustomerDoc as Record<string, unknown> | null)?.lastGuessDate

  const [question, setQuestion] = useState<Question | null>(null)
  const [done, setDone] = useState(false)
  const [picked, setPicked] = useState<number | null>(null)
  const [result, setResult] = useState('Pilih satu jawaban.')

  const alreadyPlayed = lastGuessDate === todayKeyJakarta()

  useEffect(() => {
    setQuestion(makeQuestion(products))
    setDone(false)
    setPicked(null)
    setResult(products.length ? 'Pilih satu jawaban.' : 'Belum ada produk untuk permainan tebak harga.')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function answer(price: number) {
    if (done || !question) return
    setDone(true)
    setPicked(price)
    const correct = price === question.product.price
    const reward = settings.coinRewards.guess
    if (correct && !alreadyPlayed && settings.coinProgramEnabled && settings.coinEvents.guess && reward > 0) {
      grant(reward, {
        label: 'Hadiah tebak harga',
        detail: 'Jawaban benar ' + todayKeyJakarta(),
        claimKey: 'tebak_harga_' + todayKeyJakarta(),
        reason: 'tebak_harga',
      })
      setResult('Benar! +' + reward + ' Koin Warga masuk ke dompetmu.')
      toast('+' + reward + ' Koin Warga')
    } else if (correct && alreadyPlayed) {
      setResult('Benar! Harga aslinya ' + money(question.product.price) + '. (Sudah dapat koin hari ini)')
    } else if (correct) {
      setResult('Benar! Tetapi event tebak harga sedang dimatikan admin.')
    } else {
      setResult('Kurang tepat. Harga aslinya ' + money(question.product.price) + '.')
    }
  }

  const rewardLabel = settings.coinEvents.guess && !alreadyPlayed
    ? 'Hadiah +' + settings.coinRewards.guess + ' koin'
    : alreadyPlayed
      ? 'Sudah dapat hari ini'
      : 'Event dimatikan'
  const kicker = alreadyPlayed ? 'Mode latihan · tanpa hadiah' : 'Tebak harga produk ini'

  return (
    <div id="quizCustomerView" className="customer-view">
      <header className="plain-head top-safe">
        <div>
          <p className="page-kicker">{kicker}</p>
          <h1>Tebak Harga</h1>
        </div>
      </header>
      <main className="content">
        {question ? (
          <>
            <div className="guess-product">
              <img id="guessProductImg" src={question.product.img || IMG_EMPTY} alt={'Tebak harga ' + question.product.name} />
              <div>
                <h3 id="guessProductName">{question.product.name}</h3>
                <small id="guessProductUnit">{question.product.unit || 'pcs'}</small>
                <span className="coin-balance-inline" id="guessRewardLabel">
                  {rewardLabel}
                </span>
              </div>
            </div>
            <div id="guessOptions" className="guess-options">
              {question.options.map((price) => {
                const isRight = price === question.product.price
                const cls = 'guess-option' + (done && isRight ? ' correct' : '') + (done && picked === price && !isRight ? ' wrong' : '')
                return (
                  <button key={price} type="button" className={cls} disabled={done} onClick={() => answer(price)}>
                    <span>{money(price)}</span>
                    <span className="guess-mark">{done && isRight ? '✓' : done && picked === price ? '✗' : ''}</span>
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <div className="empty-note">Belum ada produk untuk permainan tebak harga.</div>
        )}
        <p id="guessResult" className="service-note">
          {result}
        </p>
        <button
          id="guessNewBtn"
          className="secondary-wide"
          hidden={!done}
          onClick={() => {
            setQuestion(makeQuestion(products))
            setDone(false)
            setPicked(null)
            setResult('Pilih satu jawaban.')
          }}
        >
          Soal baru
        </button>
      </main>
    </div>
  )
}
