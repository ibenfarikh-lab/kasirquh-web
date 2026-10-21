/**
 * KasirQuh React — src/pages/admin/AdminTokoPage.tsx
 * Halaman Chat Toko mode admin: daftar percakapan pelanggan + balasan langsung.
 * Diakses dari hub /admin/chat.
 */
import { useEffect, useRef, useState } from 'react'
import { useAdminBoot } from '../../features/admin/useAdminBoot'
import { useLocalAdminStore } from '../../features/admin/localAdmin'
import { Icon, toast } from '../../components/ui'
import { useSheetRoute } from '../../lib/sheetRoute'
import AdminNav from '../../components/AdminNav'

export default function AdminTokoPage() {
  useAdminBoot()
  const [threadOpen, setThreadOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  // Back browser menutup overlay percakapan (route-based, sama seperti Sheet).
  useSheetRoute('chat-thread', threadOpen, () => setThreadOpen(false))

  const directThreads = useLocalAdminStore((s) => s.directThreads)
  const openThread = useLocalAdminStore((s) => s.openThread)
  const pinnedChatIds = useLocalAdminStore((s) => s.pinnedChatIds)
  const togglePinChat = useLocalAdminStore((s) => s.togglePinChat)

  const openChat = (id: string) => {
    openThread(id)
    setThreadOpen(true)
  }

  // Urutkan: yang di-pin selalu di atas (urutan pin), lalu aktivitas terbaru.
  const pinRank = new Map(pinnedChatIds.map((id, i) => [id, i]))
  const threads = Object.values(directThreads).sort((a, b) => {
    const pa = a.pinned ? (pinRank.get(a.id) ?? 999) : 999
    const pb = b.pinned ? (pinRank.get(b.id) ?? 999) : 999
    if (pa !== pb) return pa - pb
    return (b.updatedAt || 0) - (a.updatedAt || 0)
  })
  const unreadThreads = threads.filter((t) => (t.unread || 0) > 0).length
  const q = query.trim().toLowerCase()
  const visible = threads.filter(
    (t) =>
      (filter === 'all' || (t.unread || 0) > 0) &&
      (!q || t.name.toLowerCase().includes(q)),
  )

  return (
    <div className="admin-screen">
      <div id="chatView" className="subview admin-page active">
        <div className="admin-task-head">
          <span>
            <small>Pesan pelanggan</small>
            <h2>Chat Toko</h2>
          </span>
        </div>
        <div className="search" role="search">
          <Icon name="search" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama pelanggan…"
            aria-label="Cari pelanggan"
          />
        </div>
        <div className="online-tabs" role="tablist" aria-label="Filter percakapan">
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'all'}
            className={'online-tab' + (filter === 'all' ? ' active' : '')}
            onClick={() => setFilter('all')}
          >
            Semua
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'unread'}
            className={'online-tab' + (filter === 'unread' ? ' active' : '')}
            onClick={() => setFilter('unread')}
          >
            Belum dibaca{unreadThreads > 0 ? ` (${unreadThreads})` : ''}
          </button>
        </div>
        <div className="info-card">
          {visible.length ? (
            visible.map((thread) => {
              const latest = thread.messages[thread.messages.length - 1]
              const preview = latest ? latest.text : thread.lastMessage || 'Belum ada percakapan'
              return (
                <button
                  className="order-row chat-row admin-chat-entry"
                  key={thread.id}
                  onClick={() => openChat(thread.id)}
                >
                  {thread.photoURL ? (
                    <img className="avatar" src={thread.photoURL} alt={thread.name} />
                  ) : (
                    <span className="avatar">{thread.initial}</span>
                  )}
                  <span>
                    <b>{thread.name}</b>
                    <br />
                    <small className="chat-preview">{preview}</small>
                  </span>
                  <span className="chat-side">
                    <span
                      role="button"
                      tabIndex={0}
                      className={'chat-pin-btn' + (thread.pinned ? ' active' : '')}
                      aria-label={thread.pinned ? 'Lepas pin ' + thread.name : 'Pin ' + thread.name + ' ke atas'}
                      aria-pressed={thread.pinned}
                      onClick={(e) => {
                        e.stopPropagation()
                        togglePinChat(thread.id)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          togglePinChat(thread.id)
                        }
                      }}
                    >
                      <Icon name="bookmark" />
                    </span>
                    {thread.unread ? (
                      <span className="chat-unread">{thread.unread}</span>
                    ) : latest ? (
                      <small className="chat-time">{latest.time}</small>
                    ) : null}
                  </span>
                </button>
              )
            })
          ) : (
            <div className="empty-note">
              {threads.length
                ? 'Tidak ada hasil yang cocok.'
                : 'Belum ada percakapan'}
            </div>
          )}
        </div>
      </div>
      <AdminNav />
      {threadOpen && (
        <DirectChatInline onClose={() => setThreadOpen(false)} />
      )}
    </div>
  )
}

/* ---------- Percakapan langsung (pengganti #directChatModal) ---------- */

function DirectChatInline({ onClose }: { onClose: () => void }) {
  const directThreads = useLocalAdminStore((s) => s.directThreads)
  const activeDirectThread = useLocalAdminStore((s) => s.activeDirectThread)
  const sendChatMessage = useLocalAdminStore((s) => s.sendChatMessage)

  const thread = activeDirectThread ? directThreads[activeDirectThread] : undefined
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const feedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const feed = feedRef.current
    if (feed) feed.scrollTop = feed.scrollHeight
  }, [thread?.messages.length])

  const send = () => {
    const isi = text.trim()
    if (!isi) {
      toast('Tulis pesan dulu')
      return
    }
    if (!activeDirectThread) {
      toast('Pilih percakapan dulu')
      return
    }
    // optimistic: tampilkan langsung
    setText('')
    setSending(true)
    sendChatMessage(activeDirectThread, isi)
      .then(() => {})
      .catch((error: unknown) => {
        const e = error as { code?: string; message?: string }
        if (!e || e.code !== 'OFFLINE') toast(e && e.message ? e.message : 'Pesan gagal dikirim')
      })
      .finally(() => setSending(false))
  }

  return (
    <div className="admin-thread-overlay">
      <header className="plain-head top-safe">
        <button type="button" className="back-btn" aria-label="Kembali" onClick={onClose}>
          <Icon name="chevron-left" />
        </button>
        <div>
          <p className="page-kicker">Chat pelanggan</p>
          <h1>{thread ? thread.name : 'Percakapan'}</h1>
          <span className="thread-status">{thread ? 'Pelanggan aktif' : ''}</span>
        </div>
      </header>
      <div className="thread-feed" aria-live="polite" ref={feedRef}>
        {!thread || thread.loading ? (
          <div className="empty-note">
            <span className="empty-state-icon">
              <Icon name="chat" />
            </span>
            <b>Memuat pesan…</b>
            <p>Sebentar ya, lagi mengambil riwayat percakapan.</p>
          </div>
        ) : !thread.messages.length ? (
          <div className="empty-note">
            <span className="empty-state-icon">
              <Icon name="chat" />
            </span>
            <b>Belum ada percakapan</b>
            <p>Pesan yang dikirim dalam sesi ini akan tampil di sini.</p>
          </div>
        ) : (
          thread.messages.map((m) => {
            const own = m.side === 'admin'
            return (
              <article className={'thread-message' + (own ? ' own' : '')} key={m.id}>
                <small>
                  {(m.side === 'admin' ? 'Warunge Mimi' : thread.name) + ' · ' + m.time}
                </small>
                <div className="thread-bubble">{m.text}</div>
              </article>
            )
          })
        )}
      </div>
      <div className="thread-composer has-photo">
        <input
          maxLength={240}
          placeholder={thread ? 'Balas ' + thread.name + '…' : 'Tulis pesan…'}
          aria-label="Tulis pesan"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              send()
            }
          }}
        />
        <label className="thread-photo-btn" aria-label="Tambah foto">
          <Icon name="image" />
          <input type="file" accept="image/*" hidden onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) toast('Fitur foto admin segera hadir')
          }} />
        </label>
        <button aria-label="Kirim pesan" disabled={sending} onClick={send}>
          <Icon name="chat" />
          <span>Kirim</span>
        </button>
      </div>
    </div>
  )
}
