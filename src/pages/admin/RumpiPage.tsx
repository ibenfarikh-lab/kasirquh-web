/**
 * KasirQuh React — src/pages/admin/AdminRumpiPage.tsx
 * Halaman Rumpi Warga mode admin (moderasi): posting sebagai Mimi,
 * hapus postingan pelanggan, suka. Diakses dari hub /admin/chat.
 */
import { useEffect, useRef, useState } from 'react'
import { useAdminBoot } from '../../features/admin/useAdminBoot'
import { useLocalAdminStore } from '../../features/admin/localAdmin'
import { Icon, toast } from '../../components/ui'
import AdminNav from '../../components/AdminNav'
import type { RumpiMessage } from '../../types'

function resizeRumpiPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Pilih file gambar dari HP'))
      return
    }
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)
    image.onload = () => {
      const maxSide = 400
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      const url = canvas.toDataURL('image/jpeg', 0.82)
      URL.revokeObjectURL(objectUrl)
      resolve(url)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Foto tidak dapat dibaca'))
    }
    image.src = objectUrl
  })
}

export default function AdminRumpiPage() {
  useAdminBoot()
  const rumpiMessages = useLocalAdminStore((s) => s.rumpiMessages)

  return (
    <div className="admin-screen admin-chat-screen">
      <div id="chatView" className="subview admin-page active">
        <div className="admin-task-head">
          <span>
            <small>Komunitas warga</small>
            <h2>Rumpi Warga</h2>
          </span>
        </div>
        <main className="content">
          <div className="rumpi-status">
            <span>
              <Icon name="users" />
              Mode moderasi aktif
            </span>
            <small>Posting sebagai Mimi · Warung — bisa hapus postingan pelanggan</small>
          </div>
          <RumpiFeed messages={rumpiMessages} />
          <RumpiComposer />
        </main>
      </div>
      <AdminNav />
    </div>
  )
}

/* ---------- Feed Rumpi mode admin (moderasi) ---------- */

function RumpiFeed({ messages }: { messages: RumpiMessage[] }) {
  const deleteRumpi = useLocalAdminStore((s) => s.deleteRumpi)
  const likeRumpi = useLocalAdminStore((s) => s.likeRumpi)
  const feedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    requestAnimationFrame(() => {
      if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
    })
  }, [messages.length])

  if (!messages.length) {
    return <div className="empty-note">Belum ada obrolan di Rumpi Warga.</div>
  }
  return (
    <div className="admin-rumpi-feed" aria-live="polite" ref={feedRef}>
      {[...messages].reverse().map((message) => {
        const own = message.admin
        return (
          <article className={'rumpi-message' + (own ? ' admin-message' : '')} key={message.id}>
            {own ? null : (
              <div className={'rumpi-avatar' + (message.authorPhoto ? ' has-photo' : '')}>
                {message.authorPhoto ? (
                  <img src={message.authorPhoto} alt={'Foto ' + message.name} />
                ) : (
                  message.initial
                )}
              </div>
            )}
            <div className="rumpi-bubble">
              <header>
                <b>{message.name}</b>
                {message.admin ? <span className="rumpi-admin-badge">Admin</span> : null}
              </header>
              {message.photo ? (
                <img
                  className="rumpi-recipe-photo"
                  src={message.photo}
                  alt={message.photoAlt || 'Foto yang dibagikan'}
                />
              ) : null}
              <p>{message.text}</p>
              <span className="rumpi-time">{message.time}</span>
              <button
                className="rumpi-like"
                aria-label="Suka postingan"
                onClick={() => likeRumpi(message.id).catch((e: unknown) => toast((e as Error).message || 'Gagal'))}
              >
                <span aria-hidden="true">♥</span> <b>{message.likeCount || 0}</b>
              </button>
            </div>
            {own ? (
              <div className={'rumpi-avatar' + (message.authorPhoto ? ' has-photo' : '')}>
                {message.authorPhoto ? (
                  <img src={message.authorPhoto} alt={'Foto ' + message.name} />
                ) : (
                  message.initial
                )}
              </div>
            ) : (
              <button
                className="moderate-delete"
                aria-label={'Hapus pesan dari ' + message.name}
                onClick={() =>
                  deleteRumpi(message.id)
                    .then(() => toast('Pesan dihapus dari Rumpi Warga'))
                    .catch((error: unknown) => {
                      const e = error as { code?: string; message?: string }
                      if (!e || e.code !== 'OFFLINE') toast(e && e.message ? e.message : 'Hapus gagal')
                    })
                }
              >
                Hapus
              </button>
            )}
          </article>
        )
      })}
    </div>
  )
}

function RumpiComposer() {
  const sendRumpi = useLocalAdminStore((s) => s.sendRumpi)
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState('')
  const [sending, setSending] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const send = () => {
    const isi = text.trim()
    if (!isi && !photo) {
      toast('Tulis balasan atau tambah foto dulu')
      return
    }
    setSending(true)
    sendRumpi(isi, photo)
      .then(() => {
        setText('')
        setPhoto('')
        if (fileRef.current) fileRef.current.value = ''
        toast('Postingan tampil di Rumpi pelanggan')
      })
      .catch((error: unknown) => {
        const e = error as { code?: string; message?: string }
        if (!e || e.code !== 'OFFLINE') toast(e && e.message ? e.message : 'Gagal mengirim')
      })
      .finally(() => setSending(false))
  }

  return (
    <>
      <div className="rumpi-composer">
        <input
          maxLength={180}
          placeholder="Balas sebagai Mimi…"
          aria-label="Balasan Mimi ke Rumpi Warga"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              send()
            }
          }}
        />
        <label className="rumpi-photo-btn" htmlFor="adminRumpiPhotoInput" aria-label="Tambah foto">
          <Icon name="image" />
          <input
            id="adminRumpiPhotoInput"
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f)
                resizeRumpiPhoto(f)
                  .then(setPhoto)
                  .catch((err: unknown) =>
                    toast(err instanceof Error ? err.message : 'Foto tidak dapat dibaca'),
                  )
            }}
          />
        </label>
        <button aria-label="Kirim balasan" disabled={sending} onClick={send}>
          <Icon name="chat" />
          <span>Kirim</span>
        </button>
      </div>
      {photo ? (
        <div className="rumpi-photo-preview">
          <img src={photo} alt="Pratinjau foto postingan" />
          <button
            type="button"
            aria-label="Batalkan foto"
            onClick={() => {
              setPhoto('')
              if (fileRef.current) fileRef.current.value = ''
            }}
          >
            ×
          </button>
        </div>
      ) : null}
    </>
  )
}
