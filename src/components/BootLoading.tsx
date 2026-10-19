/**
 * KasirQuh React — src/components/BootLoading.tsx
 * Layar loading yang menarik: logo animasi + pesan bergantian + progress bar.
 */
import { useEffect, useState } from 'react'
import { Icon } from './ui'

const MESSAGES = [
  'Menyiapkan warung...',
  'Menghitung koin...',
  'Memanaskan etalase...',
  'Menata rak belanja...',
  'Menyapa pelanggan...',
]

export default function BootLoading() {
  const [msgIndex, setMsgIndex] = useState(0)
  const [progress, setProgress] = useState(10)

  useEffect(() => {
    const msgTimer = setInterval(() => {
      setMsgIndex((i) => (i + 1) % MESSAGES.length)
    }, 2000)
    const progTimer = setInterval(() => {
      setProgress((p) => Math.min(95, p + Math.random() * 15))
    }, 800)
    return () => {
      clearInterval(msgTimer)
      clearInterval(progTimer)
    }
  }, [])

  return (
    <div className="app">
      <div className="boot-loading-fancy">
        <div className="boot-logo-wrap">
          <Icon name="warunge-logo" className="boot-logo" label="Warunge Mimi" />
        </div>
        <h2 className="boot-title">Warunge Mimi</h2>
        <p className="boot-message">{MESSAGES[msgIndex]}</p>
        <div className="boot-progress-track">
          <div className="boot-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  )
}
