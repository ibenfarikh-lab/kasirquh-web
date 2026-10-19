/**
 * KasirQuh React — src/pages/customer/TokoChatPage.tsx
 * Pengganti ThreadSheet (#directChatModal) — halaman penuh, bukan modal.
 * Konten mengalir natural tanpa ruang kosong menggantung seperti di sheet.
 */
import { useEffect, useRef, useState } from 'react'

import { Icon, EmptyNote, toast } from '../../components/ui'
import { useChatLocal, compressPhoto } from '../../features/customer/local'

export default function TokoChatPage() {
  const thread = useChatLocal((s) => s.thread)
  const sendThreadMessage = useChatLocal((s) => s.sendThreadMessage)
  const markThreadSeen = useChatLocal((s) => s.markThreadSeen)
  const threadName = useChatLocal((s) => s.threadName)
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState('')
  const feedRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    markThreadSeen()
    requestAnimationFrame(() => {
      if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
    })
  }, [thread.length, markThreadSeen])

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setPhoto(await compressPhoto(file, 300, 'image/png'))
    } catch {
      toast('Gambar tidak bisa dibaca')
    }
  }

  function send() {
    const t = text.trim()
    if (!t && !photo) {
      toast('Tulis pesan atau tambah foto dulu')
      return
    }
    setText('')
    setPhoto('')
    sendThreadMessage(t, 'customer', photo)
      .then(() => toast('Pesan terkirim ke warung'))
      .catch(() => toast('Gagal kirim, coba lagi'))
  }

  return (
    <div id="tokoChatView" className="customer-view">
      <header className="plain-head top-safe">
        <div>
          <p className="page-kicker">Percakapan toko</p>
          <h1>{threadName}</h1>
          <span id="directChatStatus" className="thread-status">
            Aktif sekarang
          </span>
        </div>
      </header>
      <main className="content">
        <div id="directChatFeed" className="thread-feed" aria-live="polite" ref={feedRef}>
          {thread.length ? (
            thread.map((m) => (
              <article key={m.id} className={`thread-message${m.side === 'customer' ? ' own' : ''}`}>
                <small>
                  {(m.side === 'admin' ? 'Warunge Mimi' : threadName) + ' · ' + m.time}
                </small>
                <div className="thread-bubble">{m.text}</div>
              </article>
            ))
          ) : (
            <EmptyNote>
              <span className="empty-state-icon">
                <Icon name="chat" />
              </span>
              <b>Belum ada percakapan</b>
              <p>Pesan yang dikirim dalam sesi ini akan tampil di sini.</p>
            </EmptyNote>
          )}
        </div>
        <div className="thread-composer has-photo">
          <input
            id="directChatInput"
            maxLength={240}
            placeholder="Tulis pesan…"
            aria-label="Tulis pesan"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send()
            }}
          />
          <label className="thread-photo-btn" aria-label="Tambah foto">
            <Icon name="image" />
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />
          </label>
          <button id="sendDirectChat" aria-label="Kirim pesan" onClick={send}>
            <Icon name="chat" />
            <span>Kirim</span>
          </button>
        </div>
        {photo ? (
          <div className="thread-photo-preview">
            <img src={photo} alt="Foto yang akan dikirim" />
            <button type="button" aria-label="Hapus foto" onClick={() => setPhoto('')}>
              <Icon name="x" />
            </button>
          </div>
        ) : null}
      </main>
    </div>
  )
}
