import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminBoot, adminRoute } from '../../features/admin/useAdminBoot'
import { useProductsStore } from '../../stores/products'
import { useLocalAdminStore, type InboxItem } from '../../features/admin/localAdmin'
import { Icon, toast } from '../../components/ui'
import AdminNav from '../../components/AdminNav'

const GROUP_META: Record<
  InboxItem['kind'],
  { label: string; icon: string }
> = {
  stock: { label: 'Stok menipis', icon: 'box' },
  order: { label: 'Pesanan', icon: 'bag' },
  titip: { label: 'Titipan', icon: 'bag' },
  chat: { label: 'Chat', icon: 'chat' },
  signup: { label: 'Pendaftaran', icon: 'user' },
  share: { label: 'Lainnya', icon: 'users' },
}
const GROUP_ORDER: InboxItem['kind'][] = ['stock', 'order', 'titip', 'chat', 'signup', 'share']

export default function InboxPage() {
  useAdminBoot()
  const navigate = useNavigate()

  const products = useProductsStore((s) => s.products)
  const inboxItems = useLocalAdminStore((s) => s.inboxItems)
  const rebuildInbox = useLocalAdminStore((s) => s.rebuildInbox)
  const markAllInboxRead = useLocalAdminStore((s) => s.markAllInboxRead)
  const markInboxItemRead = useLocalAdminStore((s) => s.markInboxItemRead)
  const markInboxGroupRead = useLocalAdminStore((s) => s.markInboxGroupRead)
  const setTitipStatus = useLocalAdminStore((s) => s.setTitipStatus)

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  useEffect(() => {
    rebuildInbox(products)
  }, [products, rebuildInbox])

  const groups = useMemo(() => {
    const map = new Map<InboxItem['kind'], InboxItem[]>()
    inboxItems.forEach((x) => {
      const k = x.kind || 'share'
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(x)
    })
    return GROUP_ORDER.filter((k) => (map.get(k) || []).length > 0).map((k) => ({
      kind: k,
      meta: GROUP_META[k] || GROUP_META.share,
      items: map.get(k)!,
    }))
  }, [inboxItems])

  const openItem = (item: InboxItem) => {
    markInboxItemRead(item.id)
    if (item.target === 'approvals') navigate('/admin/data?tab=approvals')
    else navigate(adminRoute(item.target))
  }

  const setTitip = (item: InboxItem, status: string) => {
    const docId = item.id.replace(/^titip-/, '')
    setTitipStatus(docId, status)
      .then(() => {})
      .catch((error: unknown) => {
        const e = error as { code?: string; message?: string }
        if (!e || e.code !== 'OFFLINE') toast(e && e.message ? e.message : 'Gagal update')
      })
  }

  return (
    <div className="admin-screen">
      <div id="pesananView" className="subview admin-page active">
        <div className="admin-task-head">
          <span>
            <small>Pusat notifikasi</small>
            <h2>Inbox</h2>
          </span>
          <button
            className="mark-read-btn"
            onClick={() => {
              markAllInboxRead()
            }}
          >
            Tandai semua dibaca
          </button>
        </div>
        <div className="notification-list" aria-live="polite">
          {inboxItems.length ? (
            groups.map((g) => {
              const unread = g.items.filter((x) => !x.read).length
              const isCollapsed = !!collapsed[g.kind]
              return (
                <div className="inbox-group" key={g.kind}>
                  <div className="inbox-group-head-row">
                    <button
                      className="inbox-group-head"
                      aria-expanded={!isCollapsed}
                      onClick={() =>
                        setCollapsed((c) => ({ ...c, [g.kind]: !c[g.kind] }))
                      }
                    >
                      <span className="notification-icon" aria-hidden="true">
                        <Icon name={g.meta.icon} />
                      </span>
                      <b>{g.meta.label}</b>
                      <span className="inbox-group-count">{g.items.length}</span>
                      {unread ? <span className="new-badge">{unread} baru</span> : null}
                      <span className="inbox-group-chev">{isCollapsed ? '▸' : '▾'}</span>
                    </button>
                    {unread ? (
                      <button
                        className="inbox-group-mark"
                        title="Tandai dibaca"
                        onClick={() => {
                          markInboxGroupRead(g.kind)
                        }}
                      >
                        ✓
                      </button>
                    ) : null}
                  </div>
                  <div className="inbox-group-body" hidden={isCollapsed}>
                    {g.items.map((x) => (
                      <div className="notification-item-wrap" key={x.id}>
                        <button
                          className={'notification-item' + (x.read ? ' read' : '')}
                          onClick={() => openItem(x)}
                        >
                          <span className="notification-icon" aria-hidden="true">
                            <Icon name={x.icon || 'bell'} />
                          </span>
                          <span className="notification-copy">
                            <b>{x.title}</b>
                            <small>{x.time || 'Baru saja'}</small>
                          </span>
                          {x.read ? (
                            <span className="notification-arrow">›</span>
                          ) : (
                            <span className="new-badge">baru</span>
                          )}
                        </button>
                        {x.kind === 'titip' ? (
                          <span className="titip-status-actions">
                            <button title="Tandai diproses" onClick={() => setTitip(x, 'diproses')}>
                              📦
                            </button>
                            <button title="Tandai tersedia" onClick={() => setTitip(x, 'tersedia')}>
                              ✅
                            </button>
                            <button title="Tandai selesai" onClick={() => setTitip(x, 'selesai')}>
                              ✔️
                            </button>
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          ) : (
            <div className="notification-empty">
              <span className="empty-state-icon">
                <Icon name="bell" />
              </span>
              <b>Belum ada notifikasi</b>
              <p>Pendaftaran, pesanan, dan kabar baru akan tampil di sini.</p>
            </div>
          )}
        </div>
      </div>
      <AdminNav />
    </div>
  )
}
