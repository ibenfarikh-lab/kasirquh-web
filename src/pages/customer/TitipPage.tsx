/**
 * KasirQuh React — src/pages/customer/TitipPage.tsx
 * Pengganti TitipSheet (#titipModal) — halaman penuh, bukan modal.
 */
import { useState } from 'react'

import { toast } from '../../components/ui'
import { useSessionLocal } from '../../features/customer/local'
import { useNotesStore } from '../../stores/notes'
import { useAuthStore } from '../../stores/auth'

type TitipMethod = 'Ambil di warung' | 'Diantar ke rumah'

export default function TitipPage() {
  const isGuest = useSessionLocal((s) => s.isGuest)
  const [item, setItem] = useState('')
  const [note, setNote] = useState('')
  const [method, setMethod] = useState<TitipMethod>('Ambil di warung')
  const [sent, setSent] = useState<{ item: string; method: TitipMethod } | null>(null)
  const [busy, setBusy] = useState(false)

  function submit() {
    if (isGuest) {
      useAuthStore.getState().openLoginSheet('titip', 'Masuk dulu untuk titip belanja')
      return
    }
    const value = item.trim()
    if (!value) {
      toast('Tulis barang yang ingin dititipkan')
      return
    }
    setBusy(true)
    useNotesStore
      .getState()
      .submitTitipRequest({ item: value, note: note.trim(), method })
      .then(() => {
        setSent({ item: value, method })
        setItem('')
        setNote('')
        toast('Terkirim · warung akan memberi kabar')
      })
      .catch((err: unknown) => {
        toast(err instanceof Error ? err.message : 'Gagal mengirim titipan')
      })
      .finally(() => setBusy(false))
  }

  return (
    <div id="titipCustomerView" className="customer-view">
      <header className="plain-head top-safe">
        <div>
          <p className="page-kicker">Warung bantu carikan</p>
          <h1>Titip Belanja</h1>
        </div>
      </header>
      <main className="content">
        <p className="service-note">
          Barang yang belum ada di rak akan dicari saat Warunge Mimi kulakan. Pilih ambil sendiri atau minta diantar setelah barang tersedia.
        </p>
        {sent ? (
          <div id="titipStatus">
            <article className="note-card due">
              <header>
                <h3 id="titipItemName">{sent.item}</h3>
                <span className="notice-count">Terkirim</span>
              </header>
              <div className="status-chain">
                <span className="done">Diterima</span>
                <span>Dibelikan</span>
                <span>Siap</span>
              </div>
              <p id="titipMethodText">{sent.method} · warung akan memberi kabar saat barang tersedia.</p>
            </article>
          </div>
        ) : null}
        <div className="form-stack">
          <label htmlFor="titipItem">Barang yang dicari</label>
          <input id="titipItem" placeholder="Contoh: susu bayi ukuran 400 g" value={item} onChange={(e) => setItem(e.target.value)} />
          <label htmlFor="titipNote">Rincian atau merek</label>
          <textarea id="titipNote" placeholder="Tulis ukuran, merek pilihan, dan jumlah" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="segmented" id="titipMethod">
          {(['Ambil di warung', 'Diantar ke rumah'] as const).map((m) => (
            <button key={m} className={method === m ? 'active' : ''} onClick={() => setMethod(m)}>
              {m}
            </button>
          ))}
        </div>
        <button id="titipSubmit" className="primary-wide" disabled={busy} onClick={submit}>
          Kirim titipan
        </button>
      </main>
    </div>
  )
}
