/**
 * KasirQuh React — src/pages/admin/CoinSettingsPage.tsx
 * Halaman (dulu CoinSettingsSheet): Kendali Koin Warga.
 * Pengganti #coinSettingsModal + #adjustCoinModal + #bonusEventModal.
 * Kendali Koin Warga: program on/off, nilai, batas tukar, event & hadiah,
 * aturan belanja, bonus massal, dan koreksi saldo per pelanggan.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminBoot } from '../../features/admin/useAdminBoot'
import AdminNav from '../../components/AdminNav'
import { Sheet, SheetHeader, toast } from '../../components/ui'
import { useLocalAdminStore, type CoinEvents } from '../../features/admin/localAdmin'
import { useSettingsStore } from '../../stores/settings'

type CoinField =
  | 'enabled'
  | 'rate'
  | 'redeemPercent'
  | 'events'
  | 'rewards'
  | 'spendRule'
  | 'spendReward'
  | 'rule'
import { money, numericValue } from '../../lib/format'
import type { Customer } from '../../types'

const EVENT_ROWS: {
  key: keyof CoinEvents
  title: string
  desc: string
  rewardKey?: 'checkin' | 'mission' | 'guess'
  fixed?: string
}[] = [
  { key: 'checkin', title: 'Check-in harian', desc: 'Koin saat pelanggan membuka aplikasi', rewardKey: 'checkin' },
  { key: 'mission', title: 'Misi koin', desc: 'Hadiah saat misi selesai', rewardKey: 'mission' },
  { key: 'guess', title: 'Tebak harga', desc: 'Hadiah jawaban benar', rewardKey: 'guess' },
  { key: 'spend', title: 'Belanja', desc: 'Dapat sejumlah koin tiap nominal' },
  { key: 'tangkapDiskon', title: 'Tangkap Diskon', desc: 'Game 60 detik · 1000 poin = 1 koin', fixed: '500/hari' },
  { key: 'buruDiskon', title: 'Buru Diskon', desc: 'Game keranjang 60 detik · 1000 poin = 1 koin', fixed: '500/hari' },
]

export default function CoinSettingsPage() {
  useAdminBoot()
  const navigate = useNavigate()
  const coin = useLocalAdminStore((s) => s.coin)
  const saveStoreSettings = useLocalAdminStore((s) => s.saveStoreSettings)
  const customerData = useLocalAdminStore((s) => s.customerData)
  const settingsLoaded = useSettingsStore((s) => s.settingsLoaded)

  const [enabled, setEnabled] = useState(coin.enabled)
  const [rate, setRate] = useState(String(coin.value || 1))
  const [redeemPercent, setRedeemPercent] = useState(String(coin.redeemPercent))
  const [events, setEvents] = useState<CoinEvents>({ ...coin.events })
  const [rewards, setRewards] = useState({ ...coin.rewards })
  const [spendRule, setSpendRule] = useState(String(coin.spendRule))
  const [spendReward, setSpendReward] = useState(String(coin.spendReward))
  const [rule, setRule] = useState(coin.rule)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [adjustTarget, setAdjustTarget] = useState<Customer | null>(null)
  const [bonusOpen, setBonusOpen] = useState(false)

  /* Pengaman form settings (pola yang sama di semua form pengaturan):
   * field yang belum disentuh user mengikuti snapshot settings terbaru;
   * sebelum settingsLoaded form berisi nilai bawaan — simpan dalam keadaan
   * itu menimpa nilai koin live, jadi simpan digerbang sampai termuat. */
  const dirtyRef = useRef<Set<CoinField>>(new Set())
  useEffect(() => {
    if (!settingsLoaded) return
    const d = dirtyRef.current
    if (!d.has('enabled')) setEnabled((v) => (v === coin.enabled ? v : coin.enabled))
    if (!d.has('rate')) {
      const next = String(coin.value || 1)
      setRate((v) => (v === next ? v : next))
    }
    if (!d.has('redeemPercent')) {
      const next = String(coin.redeemPercent)
      setRedeemPercent((v) => (v === next ? v : next))
    }
    if (!d.has('events'))
      setEvents((v) =>
        JSON.stringify(v) === JSON.stringify(coin.events) ? v : { ...coin.events },
      )
    if (!d.has('rewards'))
      setRewards((v) =>
        JSON.stringify(v) === JSON.stringify(coin.rewards) ? v : { ...coin.rewards },
      )
    if (!d.has('spendRule')) {
      const next = String(coin.spendRule)
      setSpendRule((v) => (v === next ? v : next))
    }
    if (!d.has('spendReward')) {
      const next = String(coin.spendReward)
      setSpendReward((v) => (v === next ? v : next))
    }
    if (!d.has('rule')) setRule((v) => (v === coin.rule ? v : coin.rule))
  }, [coin, settingsLoaded])

  const toggleEvent = (key: keyof CoinEvents) => {
    dirtyRef.current.add('events')
    setEvents((e) => ({ ...e, [key]: !e[key] }))
  }

  const save = () => {
    if (!settingsLoaded) {
      toast('Pengaturan masih dimuat — tunggu sebentar, lalu coba lagi')
      return
    }
    if (dirtyRef.current.size === 0) {
      /* Simpan tanpa perubahan: tidak menulis apa pun ke Firestore. */
      toast('Tidak ada perubahan')
      navigate('/admin/menu')
      return
    }
    const rateVal = numericValue(rate)
    if (!(rateVal > 0)) {
      toast('Nilai tukar koin harus angka positif')
      return
    }
    setSaving(true)
    saveStoreSettings({
      coinRate: rateVal,
      coinRedeemLimit: Math.min(100, Math.max(0, numericValue(redeemPercent))),
      coinProgramEnabled: enabled,
      coinEvents: { ...events },
      coinRewards: {
        checkin: Math.max(0, numericValue(String(rewards.checkin))),
        mission: Math.max(0, numericValue(String(rewards.mission))),
        guess: Math.max(0, numericValue(String(rewards.guess))),
      },
      coinSpendReward: Math.max(0, numericValue(spendReward)),
      coinSpendRule: Math.max(1, numericValue(spendRule) || 100),
      coinRule: rule.trim(),
    })
      .then(() => {
        toast('Pengaturan Koin Warga disimpan')
        navigate('/admin/menu')
      })
      .catch((error: unknown) => {
        const e = error as { code?: string; message?: string }
        if (!e || e.code !== 'OFFLINE') toast(e && e.message ? e.message : 'Gagal menyimpan')
      })
      .finally(() => setSaving(false))
  }

  const q = search.trim().toLocaleLowerCase('id-ID')
  const shownCustomers = useMemo(
    () =>
      customerData
        .filter((c) => !q || c.name.toLocaleLowerCase('id-ID').includes(q))
        .sort((a, b) => a.name.localeCompare(b.name, 'id')),
    [customerData, q],
  )

  return (
    <div className="admin-screen">
      <div className="subview admin-page active">
        <div className="admin-page-head">
          <span>
            <small>Kendali Admin</small>
            <h2>Koin Warga</h2>
          </span>
          <button className="ghost" onClick={() => navigate('/admin/menu')} aria-label="Kembali ke Menu">
            {'‹ Kembali'}
          </button>
        </div>
      <div className="coin-setting-note">
        <span>
          Nilai dan event berlaku langsung. Penjualan dicatat penuh; koin yang ditukar menjadi
          beban promosi terpisah di Pembukuan.
        </span>
      </div>
      <div className="switch-row">
        <span>
          <b>Program Koin Warga</b>
          <small>Dompet, perolehan, dan penukaran</small>
        </span>
        <button
          className="toggle-btn"
          aria-pressed={enabled}
          onClick={() => {
            dirtyRef.current.add('enabled')
            setEnabled((v) => !v)
          }}
        >
          {enabled ? 'NYALA' : 'MATI'}
        </button>
      </div>
      <div className="control-grid" style={{ marginTop: 10 }}>
        <label className="control-field">
          Nilai 1 koin (Rp)
          <input
            inputMode="numeric"
            value={rate}
            onChange={(e) => {
              dirtyRef.current.add('rate')
              setRate(e.target.value.replace(/[^\d]/g, ''))
            }}
          />
          <small style={{ color: 'var(--muted)' }}>Nilai tukar 1 koin dalam rupiah (berlaku di semua pintu)</small>
        </label>
        <label className="control-field">
          Maks. penukaran (%)
          <input
            inputMode="numeric"
            value={redeemPercent}
            onChange={(e) => {
              dirtyRef.current.add('redeemPercent')
              setRedeemPercent(e.target.value.replace(/[^\d]/g, ''))
            }}
          />
        </label>
      </div>
      <h3 style={{ fontSize: 12, margin: '16px 0 4px' }}>Event perolehan koin</h3>
      <div className="coin-event-list">
        {EVENT_ROWS.map((row) => (
          <div className="coin-event-row" key={row.key}>
            <span>
              <b>{row.title}</b>
              <small>{row.desc}</small>
            </span>
            {row.fixed ? (
              <input value={row.fixed} readOnly disabled style={{ opacity: 0.6 }} aria-label={'Batas harian ' + row.title} />
            ) : row.key === 'spend' ? (
              <input
                inputMode="numeric"
                value={spendReward}
                aria-label="Koin hadiah belanja"
                onChange={(e) => {
                  dirtyRef.current.add('spendReward')
                  setSpendReward(e.target.value.replace(/[^\d]/g, ''))
                }}
              />
            ) : (
              <input
                inputMode="numeric"
                value={String(rewards[row.rewardKey!])}
                aria-label={'Koin ' + row.title.toLowerCase()}
                onChange={(e) => {
                  dirtyRef.current.add('rewards')
                  setRewards((r) => ({
                    ...r,
                    [row.rewardKey!]: Math.max(0, numericValue(e.target.value.replace(/[^\d]/g, ''))),
                  }))
                }}
              />
            )}
            <button
              className="toggle-btn coin-event-toggle"
              aria-pressed={events[row.key]}
              onClick={() => toggleEvent(row.key)}
            >
              {events[row.key] ? 'NYALA' : 'MATI'}
            </button>
          </div>
        ))}
      </div>
      <div className="control-grid">
        <label className="control-field full">
          Nominal belanja per hadiah (Rp)
          <input
            inputMode="numeric"
            value={spendRule}
            onChange={(e) => {
              dirtyRef.current.add('spendRule')
              setSpendRule(e.target.value.replace(/[^\d]/g, ''))
            }}
          />
        </label>
        <label className="control-field full">
          Aturan program
          <textarea
            value={rule}
            onChange={(e) => {
              dirtyRef.current.add('rule')
              setRule(e.target.value)
            }}
          />
        </label>
      </div>
      <button className="primary-wide" style={{ marginTop: 12 }} disabled={saving || !settingsLoaded} onClick={save}>
        {saving ? 'Menyimpan…' : 'Simpan Pengaturan Koin'}
      </button>
      <button
        className="customer-row"
        style={{ marginTop: 10 }}
        onClick={() => setBonusOpen(true)}
      >
        <span className="avatar">🎉</span>
        <span>
          <b>Event bonus</b>
          <small>Bagi koin ke semua pelanggan sekaligus</small>
        </span>
        <span className="customer-total">›</span>
      </button>
      <h3 style={{ fontSize: 12, margin: '16px 0 4px' }}>Saldo koin pelanggan</h3>
      <p className="service-note">Ketuk pelanggan untuk ubah saldonya. Tercatat di riwayat.</p>
      <div className="control-field" style={{ marginBottom: 8 }}>
        <input
          placeholder="Cari nama..."
          aria-label="Cari pelanggan"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="customer-list">
        {shownCustomers.length ? (
          shownCustomers.map((c) => (
            <button className="customer-row" key={c.id} onClick={() => setAdjustTarget(c)}>
              <span className="avatar">{c.name.charAt(0).toUpperCase()}</span>
              <span>
                <b>{c.name}</b>
                <small>{c.email || c.wa || 'Akun pelanggan'}</small>
              </span>
              <span className="customer-total">{c.coins.toLocaleString('id-ID')} koin</span>
            </button>
          ))
        ) : (
          <div className="empty-note">Belum ada data pelanggan.</div>
        )}
      </div>
        <AdjustCoinSheet target={adjustTarget} onClose={() => setAdjustTarget(null)} />
        <BonusEventSheet open={bonusOpen} onClose={() => setBonusOpen(false)} />
      </div>
      <AdminNav />
    </div>
  )
}

/* ---------- Ubah saldo koin (pengganti #adjustCoinModal) ---------- */

function AdjustCoinSheet({
  target,
  onClose,
}: {
  target: Customer | null
  onClose: () => void
}) {
  const adjustCoins = useLocalAdminStore((s) => s.adjustCoins)
  const [amount, setAmount] = useState('')
  const [dir, setDir] = useState('1')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (target) {
      setAmount('')
      setDir('1')
      setNote('')
      setSaving(false)
    }
  }, [target])

  const save = () => {
    if (!target) return
    const n = Math.max(0, Math.floor(Number(amount) || 0))
    if (!n) {
      toast('Isi jumlah koin dulu')
      return
    }
    const delta = (dir === '-1' ? -1 : 1) * n
    setSaving(true)
    adjustCoins(
      target.id,
      delta,
      note.trim() || (delta > 0 ? 'Tambah manual admin' : 'Kurangi manual admin'),
    )
      .then(() => {
        onClose()
        toast((delta > 0 ? '+' : '-') + n.toLocaleString('id-ID') + ' koin tersimpan')
      })
      .catch((error: unknown) => {
        const e = error as { code?: string; message?: string }
        if (!e || e.code !== 'OFFLINE') toast(e && e.message ? e.message : 'Gagal menyimpan')
      })
      .finally(() => setSaving(false))
  }

  return (
    <Sheet open={target !== null} onClose={onClose} sheetClassName="sheet feature-sheet">
      <SheetHeader kicker="Koin Warga · Admin" title="Ubah saldo koin" onClose={onClose} />
      {target ? (
        <>
          <p>
            <b>{target.name}</b> ·{' '}
            <span>
              {target.coins.toLocaleString('id-ID')} koin ({money(target.coins)})
            </span>
          </p>
          <div className="control-grid">
            <label className="control-field">
              Jumlah koin
              <input
                inputMode="numeric"
                placeholder="0"
                aria-label="Jumlah koin"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
              />
            </label>
            <label className="control-field">
              Arah
              <select value={dir} onChange={(e) => setDir(e.target.value)} aria-label="Arah perubahan">
                <option value="1">Tambah</option>
                <option value="-1">Kurangi</option>
              </select>
            </label>
          </div>
          <label className="control-field full" style={{ marginTop: 8 }}>
            Catatan
            <input
              placeholder="cth: koreksi manual"
              aria-label="Catatan"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <button className="primary-wide" style={{ marginTop: 12 }} disabled={saving} onClick={save}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </>
      ) : null}
    </Sheet>
  )
}

/* ---------- Event bonus (pengganti #bonusEventModal) ---------- */

function BonusEventSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const grantBonusToAll = useLocalAdminStore((s) => s.grantBonusToAll)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (open) {
      setAmount('')
      setReason('')
      setSending(false)
    }
  }, [open])

  const send = () => {
    const amt = Math.max(0, Math.floor(Number(amount) || 0))
    const rsn = reason.trim()
    if (!amt) {
      toast('Isi jumlah koin dulu')
      return
    }
    if (!rsn) {
      toast('Isi alasan dulu')
      return
    }
    setSending(true)
    grantBonusToAll(amt, rsn)
      .then((n) => {
        onClose()
        toast('Bonus dibagikan ke ' + n + ' pelanggan')
      })
      .catch((error: unknown) => {
        const e = error as { code?: string; message?: string }
        if (!e || e.code !== 'OFFLINE') toast(e && e.message ? e.message : 'Gagal membagikan')
      })
      .finally(() => setSending(false))
  }

  return (
    <Sheet open={open} onClose={onClose} sheetClassName="sheet feature-sheet">
      <SheetHeader kicker="Koin Warga · Admin" title="Event bonus" onClose={onClose} />
      <p className="service-note">
        Koin dibagikan ke <b>SEMUA</b> pelanggan yang disetujui, sekali jalan.
      </p>
      <div className="control-grid">
        <label className="control-field">
          Jumlah koin per pelanggan
          <input
            inputMode="numeric"
            placeholder="0"
            aria-label="Jumlah koin per pelanggan"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
          />
        </label>
      </div>
      <label className="control-field full" style={{ marginTop: 8 }}>
        Alasan (wajib)
        <input
          placeholder="cth: Bonus akhir tahun"
          aria-label="Alasan bonus"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <div className="sheet-actions">
        <button className="ghost" onClick={onClose}>
          Batal
        </button>
        <button className="primary" disabled={sending} onClick={send}>
          {sending ? 'Membagikan…' : 'Bagikan'}
        </button>
      </div>
    </Sheet>
  )
}
