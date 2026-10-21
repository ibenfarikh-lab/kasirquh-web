import { useEffect, useRef, useState } from 'react'

import { Icon, toast } from '../../components/ui'
import { useChatLocal, useSessionLocal, compressPhoto } from '../../features/customer/local'
import { useAuthStore } from '../../stores/auth'
import type { RumpiMessage } from '../../types'

export default function RumpiPage() {
  const rumpi = useChatLocal((s) => s.rumpi)
  const sendRumpi = useChatLocal((s) => s.sendRumpi)
  const likeRumpi = useChatLocal((s) => s.likeRumpi)
  const markRumpiSeen = useChatLocal((s) => s.markRumpiSeen)
  const sessionName = useSessionLocal((s) => s.name)
  const photoURL = useSessionLocal((s) => s.photoURL)
  const isGuest = useSessionLocal((s) => s.isGuest)
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState('')
  const feedRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    markRumpiSeen()
    requestAnimationFrame(() => {
      if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
    })
  }, [rumpi.length, markRumpiSeen])

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
      toast('Tulis kabar atau tambah foto dulu')
      return
    }
    if (isGuest) {
      useAuthStore.getState().openLoginSheet('rumpi', 'Masuk dulu untuk ikut Rumpi')
      return
    }
    sendRumpi(t, photo, sessionName || 'Pelanggan', photoURL)
      .then(() => {})
      .catch(() => toast('Gagal kirim, coba lagi'))
    setText('')
    setPhoto('')
  }

  return (
    <div id="rumpiView" className="customer-view">
      <header className="plain-head top-safe">
        <div>
          <p className="page-kicker">Komunitas warga</p>
          <h1>Rumpi Warga</h1>
        </div>
      </header>
      <main className="content">
        <div className="rumpi-status">
          <span>
            <Icon name="users" />
            Obrolan lingkungan
          </span>
          <small>Postingan terlihat oleh warga &amp; admin</small>
        </div>
        <div id="customerRumpiFeed" className="admin-rumpi-feed" aria-live="polite" ref={feedRef}>
          {rumpi.length ? (
            [...rumpi].reverse().map((m) => <RumpiRow key={m.id} message={m} onLike={() => likeRumpi(m.id)} />)
          ) : (
            <div className="empty-note">Belum ada obrolan di Rumpi Warga.</div>
          )}
        </div>
        <div className="rumpi-composer">
          <input
            id="customerRumpiPost"
            maxLength={180}
            placeholder="Tulis kabar untuk warga…"
            aria-label="Postingan baru Rumpi Warga"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send()
            }}
          />
          <label className="rumpi-photo-btn" aria-label="Tambah foto">
            <Icon name="image" />
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />
          </label>
          <button id="sendCustomerRumpi" aria-label="Kirim postingan" onClick={send}>
            <Icon name="chat" />
            <span>Kirim</span>
          </button>
        </div>
        {photo ? (
          <div className="rumpi-photo-preview" id="customerRumpiPhotoWrap">
            <img src={photo} alt="Pratinjau foto postingan" />
            <button type="button" aria-label="Batalkan foto" onClick={() => setPhoto('')}>
              ×
            </button>
          </div>
        ) : null}
      </main>
    </div>
  )
}

function RumpiRow({ message, onLike }: { message: RumpiMessage; onLike: () => void }) {
  const sessionName = useSessionLocal((s) => s.name)
  const own = !message.admin && message.name === (sessionName?.trim() || 'Pelanggan')
  return (
    <article className={`rumpi-message${own ? ' customer-rumpi-own' : ''}`}>
      {!own ? (
        <div className={`rumpi-avatar${message.authorPhoto ? ' has-photo' : ''}`}>
          {message.authorPhoto ? <img src={message.authorPhoto} alt={'Foto ' + message.name} /> : message.initial}
        </div>
      ) : null}
      <div className="rumpi-bubble">
        <header>
          <b>{message.name}</b>
          {message.admin ? <span className="rumpi-admin-badge">Admin</span> : null}
        </header>
        {message.photo ? <img className="rumpi-recipe-photo" src={message.photo} alt={message.photoAlt || 'Foto resep yang dibagikan'} /> : null}
        <p>{message.text}</p>
        <span className="rumpi-time">{message.time}</span>
        <button className="rumpi-like" aria-label="Suka postingan" onClick={onLike}>
          <span aria-hidden="true">♥</span> <b>{message.likeCount || 0}</b>
        </button>
      </div>
      {own ? (
        <div className={`rumpi-avatar${message.authorPhoto ? ' has-photo' : ''}`}>
          {message.authorPhoto ? <img src={message.authorPhoto} alt={'Foto ' + message.name} /> : message.initial}
        </div>
      ) : null}
    </article>
  )
}
