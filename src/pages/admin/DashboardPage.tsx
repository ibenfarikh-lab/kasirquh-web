import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminBoot, adminRoute } from '../../features/admin/useAdminBoot'
import { useProductsStore } from '../../stores/products'
import {
  useLocalAdminStore,
  DASHBOARD_SHORTCUT_CATALOG,
  type DashboardShortcutAction,
} from '../../features/admin/localAdmin'
import { money } from '../../lib/format'
import { Icon, Sheet, SheetHeader, toast } from '../../components/ui'
import AdminNav from '../../components/AdminNav'

export default function DashboardPage() {
  useAdminBoot()
  const navigate = useNavigate()

  const products = useProductsStore((s) => s.products)
  const journalEntries = useLocalAdminStore((s) => s.journalEntries)
  const onlineOrders = useLocalAdminStore((s) => s.onlineOrders)
  const todayKey = useLocalAdminStore((s) => s.todayKey)
  const lowStockThreshold = useLocalAdminStore((s) => s.lowStockThreshold)
  const shortcutIds = useLocalAdminStore((s) => s.shortcutIds)
  const shortcutEdit = useLocalAdminStore((s) => s.shortcutEdit)
  const toggleShortcutEdit = useLocalAdminStore((s) => s.toggleShortcutEdit)
  const addShortcut = useLocalAdminStore((s) => s.addShortcut)
  const removeShortcut = useLocalAdminStore((s) => s.removeShortcut)

  const [pickerOpen, setPickerOpen] = useState(false)

  const todaySales = useMemo(
    () => journalEntries.filter((x) => x.type === 'Penjualan' && x.date === todayKey),
    [journalEntries, todayKey],
  )
  const todayRevenue = todaySales.reduce((s, x) => s + x.amount, 0)
  const todayProfit = todaySales.reduce((s, x) => s + (x.profit || 0), 0)
  const pending = onlineOrders.filter((o) => o.status === 'active').length
  const critical = products.filter((p) => p.stock <= lowStockThreshold).length

  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Jakarta',
      }).format(new Date()),
    [],
  )

  const runShortcut = (id: string) => {
    const item = DASHBOARD_SHORTCUT_CATALOG.find((x) => x.id === id)
    if (!item) return
    if (shortcutEdit) {
      removeShortcut(id)
      toast('Shortcut dihapus · tersimpan di akun')
      return
    }
    const action: DashboardShortcutAction = item.action
    if (action.kind === 'view') navigate(adminRoute(action.value))
    else if (action.kind === 'tab') navigate('/admin/data?tab=' + action.value)
    else if (action.kind === 'route') navigate(action.value)
    else navigate(action.value)
  }

  return (
    <div className="admin-screen">
      <header className="admin-top" aria-label="Warunge Mimi" style={{margin:'0',borderRadius:'0',padding:'16px 18px'}}>
        <Icon name="warunge-logo" className="store-mini icon" label="Logo Warunge Mimi" />
        <h2 style={{color:'#24170f'}}>Warunge Mimi</h2>
      </header>
      <div id="dashboardView" className="subview dashboard-view active">
        <div className="dashboard-lead">
          <span>
            <small>Ringkasan operasional</small>
            <h2>Hari ini</h2>
          </span>
          <span className="dashboard-date">{dateLabel}</span>
        </div>
        <section className="dashboard-metrics" aria-label="Ringkasan hari ini">
          <button className="metric-card primary" onClick={() => navigate('/admin/pembukuan')}>
            <small>OMZET HARI INI</small>
            <b className={todaySales.length ? undefined : 'empty-value'}>
              {todaySales.length ? money(todayRevenue) : 'Belum ada data'}
            </b>
            <span>
              {todaySales.length
                ? todaySales.length + ' transaksi · laba ' + money(todayProfit)
                : 'Transaksi & laba · belum ada data'}
            </span>
          </button>
          <button className="metric-card" onClick={() => navigate('/admin/online')}>
            <small>PESANAN MENUNGGU</small>
            <b>{pending}</b>
            <span>Buka Kasir Online</span>
          </button>
          <button className="metric-card" onClick={() => navigate('/admin/produk')}>
            <small>STOK KRITIS</small>
            <b>{critical}</b>
            <span>Buka Produk</span>
          </button>
        </section>
        <div className="dashboard-section-head">
          <h3 className="dashboard-section-title">Buka pekerjaan utama</h3>
          <button
            className="shortcut-edit-toggle"
            aria-pressed={shortcutEdit}
            onClick={toggleShortcutEdit}
          >
            {shortcutEdit ? 'Selesai' : 'Ubah'}
          </button>
        </div>
        <div className="dashboard-shortcuts" aria-live="polite">
          {shortcutIds.map((id) => {
            const item = DASHBOARD_SHORTCUT_CATALOG.find((x) => x.id === id)
            if (!item) return null
            return (
              <button
                key={id}
                className={'dashboard-shortcut' + (shortcutEdit ? ' is-editing' : '')}
                aria-label={(shortcutEdit ? 'Hapus ' : 'Buka ') + item.label}
                onClick={() => runShortcut(id)}
              >
                <Icon name={item.icon} />
                <b>{item.label}</b>
                {shortcutEdit ? (
                  <span className="dashboard-shortcut-remove" aria-hidden="true">
                    ×
                  </span>
                ) : null}
              </button>
            )
          })}
          {shortcutEdit && shortcutIds.length < 6 ? (
            <button
              className="dashboard-shortcut add-shortcut"
              aria-label="Tambah shortcut"
              onClick={() => {
                if (shortcutIds.length >= 6) {
                  toast('Maksimal 6 shortcut. Hapus satu terlebih dahulu.')
                  return
                }
                setPickerOpen(true)
              }}
            >
              <Icon name="grid" />
              <b>＋ Tambah</b>
            </button>
          ) : null}
        </div>
        <div className="shortcut-edit-note" hidden={!shortcutEdit}>
          <Icon name="clock" />
          <span>
            {shortcutEdit && shortcutIds.length >= 6 ? (
              <>
                <span className="shortcut-limit">Batas 6 shortcut tercapai.</span> Hapus satu untuk
                memilih tujuan lain. Susunan tersimpan di akun.
              </>
            ) : (
              'Susunan tersimpan di akun. Hapus lalu tambah lagi untuk mengubah urutan.'
            )}
          </span>
        </div>
        <div className="dashboard-alert">
          <Icon name="bell" />
          <span>
            {pending} pesanan menunggu dan {critical} stok kritis perlu perhatian.
          </span>
        </div>
      </div>
      <AdminNav />

      <ShortcutPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(id) => {
          addShortcut(id)
          setPickerOpen(false)
          const item = DASHBOARD_SHORTCUT_CATALOG.find((x) => x.id === id)
          toast('Shortcut ' + (item ? item.label : id) + ' ditambahkan')
        }}
      />
    </div>
  )
}


function ShortcutPickerSheet({
  open,
  onClose,
  onPick,
}: {
  open: boolean
  onClose: () => void
  onPick: (id: string) => void
}) {
  const shortcutIds = useLocalAdminStore((s) => s.shortcutIds)
  const groups = [...new Set(DASHBOARD_SHORTCUT_CATALOG.map((item) => item.group))]
  const full = shortcutIds.length >= 6

  return (
    <Sheet open={open} onClose={onClose} sheetClassName="sheet feature-sheet">
      <SheetHeader kicker="Pilih alat kerja" title="Tambah Shortcut" onClose={onClose} />
      <p className="shortcut-picker-intro">
        Pilih tujuan yang paling sering dibuka. Maksimal 6 shortcut; urutannya mengikuti waktu
        ditambahkan.
      </p>
      <div className="shortcut-picker-list">
        {groups.map((group) => (
          <section className="shortcut-picker-group" key={group}>
            <h3>{group.toUpperCase()}</h3>
            <div className="shortcut-picker-grid">
              {DASHBOARD_SHORTCUT_CATALOG.filter((item) => item.group === group).map((item) => {
                const added = shortcutIds.includes(item.id)
                return (
                  <button
                    key={item.id}
                    className="shortcut-pick"
                    disabled={added || full}
                    onClick={() => onPick(item.id)}
                  >
                    <Icon name={item.icon} />
                    <span>
                      <b>{item.label}</b>
                      <small>{item.detail}</small>
                    </span>
                    <span className="shortcut-pick-state">
                      {added ? 'Terpasang' : full ? 'Penuh' : '＋'}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
      <p className="shortcut-picker-status">
        {full
          ? '6 dari 6 terpasang · hapus satu shortcut untuk menambah tujuan lain.'
          : shortcutIds.length +
            ' dari 6 terpasang · pilihan tersimpan di akun.'}
      </p>
    </Sheet>
  )
}
