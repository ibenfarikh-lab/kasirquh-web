import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection,
  getDocs,
  limit,
  query as fsQuery,
  where,
  type DocumentData,
} from 'firebase/firestore'
import { useAdminBoot } from '../../features/admin/useAdminBoot'
import { useProductsStore } from '../../stores/products'
import { useCartStore } from '../../stores/cart'
import { useLocalAdminStore } from '../../features/admin/localAdmin'
import { getDb, requireOnline } from '../../lib/firebase'
import { withTimeout, WRITE_TIMEOUT_MS } from '../../lib/firestore'
import { money, numericValue, stockText } from '../../lib/format'
import { Icon, toast } from '../../components/ui'
import AdminNav from '../../components/AdminNav'
import { Sheet, SheetHeader } from '../../components/ui'
import ScannerModal from '../../components/ScannerModal'

export default function PosPage() {
  useAdminBoot()
  const navigate = useNavigate()

  const products = useProductsStore((s) => s.products)
  const refreshProducts = useProductsStore((s) => s.refresh)
  const adminCart = useCartStore((s) => s.adminCart)
  const addAdminItem = useCartStore((s) => s.addAdminItem)
  const decAdminItem = useCartStore((s) => s.decAdminItem)
  const clearAdminCart = useCartStore((s) => s.clearAdminCart)
  const adminCat = useLocalAdminStore((s) => s.adminCat)
  const setAdminCat = useLocalAdminStore((s) => s.setAdminCat)
  const kasirMember = useLocalAdminStore((s) => s.kasirMember)
  const setKasirMember = useLocalAdminStore((s) => s.setKasirMember)
  const setKasirRedeem = useLocalAdminStore((s) => s.setKasirRedeem)

  const [query, setQuery] = useState('')
  const [cashOpen, setCashOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)

  const cats = useMemo(
    () => [...new Set(products.map((p) => p.cat).filter(Boolean))],
    [products],
  )

  const shown = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('id-ID')
    return products.filter((p) => {
      const matchQ = p.name.toLocaleLowerCase('id-ID').includes(q)
      const matchC = adminCat === 'Semua' || p.cat === adminCat
      return matchQ && matchC
    })
  }, [products, query, adminCat])

  const entries = useMemo(
    () =>
      Object.entries(adminCart)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => ({ id, qty, product: products.find((p) => p.id === id)! }))
        .filter((e) => e.product),
    [adminCart, products],
  )
  const itemCount = entries.reduce((s, e) => s + e.qty, 0)
  const total = entries.reduce((s, e) => s + e.product.price * e.qty, 0)

  const earnedCoins = useMemo(() => {
    const coin = useLocalAdminStore.getState().coin
    if (!coin.enabled || !coin.events.spend) return 0
    const rule = Math.max(1, Math.round(Number(coin.spendRule) || 0))
    const reward = Math.max(0, Math.round(Number(coin.spendReward) || 0))
    if (rule <= 0 || reward <= 0) return 0
    return Math.floor(Math.max(0, total) / rule) * reward
  }, [total])

  const openCash = () => {
    if (!entries.length) {
      toast('Transaksi masih kosong')
      return
    }
    const issue = entries.find((e) => e.product.stock < e.qty)
    if (issue) {
      toast(
        'Stok ' +
          issue.product.short +
          ' tidak cukup · tersedia ' +
          stockText(issue.product) +
          ', diminta ' +
          issue.qty,
      )
      return
    }
    setKasirRedeem(false)
    setCashOpen(true)
  }

  const identifyKasirMember = async (code: string) => {
    if (!/^KQ-[A-Z0-9]{8}$/i.test(code)) {
      toast('Kode member tidak valid')
      return
    }
    try {
      requireOnline()
      const db = getDb()
      const q = fsQuery(collection(db, 'customers'), where('memberCode', '==', code), limit(2))
      const snap = await withTimeout(getDocs(q), WRITE_TIMEOUT_MS, 'Cari member')
      if (snap.empty) {
        toast('Member tidak ditemukan')
        return
      }
      if (snap.size > 1) {
        toast('Data member ganda — hubungi admin')
        return
      }
      const d = snap.docs[0]
      const data: DocumentData = d.data() || {}
      if (data.approvalStatus !== 'approved') {
        toast('Member belum disetujui')
        return
      }
      const name = String(data.name || 'Member')
      setKasirMember({
        uid: d.id,
        name,
        memberCode: code,
        coins: Math.max(0, Math.round(Number(data.coins) || 0)),
      })
      setKasirRedeem(false)
      toast('Member: ' + name)
    } catch (error) {
      const e = error as { code?: string; message?: string }
      if (!e || e.code !== 'OFFLINE') toast(e && e.message ? e.message : 'Gagal cari member')
    }
  }

  const handleScan = (rawCode: string) => {
    setScanOpen(false)
    const code = String(rawCode || '').trim()
    if (!code) return
    if (/^KQ-/i.test(code)) {
      void identifyKasirMember(code.toUpperCase())
      return
    }
    const product = products.find((p) => String(p.barcode || '').trim() === code)
    if (!product) {
      toast('Barcode tidak dikenali · produk belum terdaftar')
      return
    }
    addAdminItem(product.id, 1)
  }

  return (
    <div className="admin-screen">
      <div id="kasirView" className="subview active">
        <header className="pos-sticky-head" aria-label="Alat kasir cepat">
          <label className="pos-search" htmlFor="adminProductSearch">
            <Icon name="search" />
            <input
              id="adminProductSearch"
              type="search"
              autoComplete="off"
              placeholder="Cari nama produk…"
              aria-label="Cari produk kasir"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button
            className="pos-header-scan"
            type="button"
            onClick={() => setScanOpen(true)}
            aria-label="Buka pemindai barcode"
          >
            <Icon name="barcode" />
            <span>Pindai</span>
          </button>
        </header>
        <div className="admin-body">
          <section
            className="admin-catalog"
            tabIndex={0}
            aria-label="Daftar produk kasir yang dapat digulir"
          >
            <div className="admin-cat-select-wrap">
              <select
                className="admin-cat-select"
                aria-label="Filter kategori produk"
                value={adminCat}
                onChange={(e) => setAdminCat(e.target.value)}
              >
                <option value="Semua">Semua Kategori</option>
                {cats.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-catalog-head">
              <div className="admin-label">Produk</div>
              <span>
                <b>{shown.length}</b> produk
              </span>
              <button
                className="refresh-btn"
                aria-label="Muat ulang produk"
                onClick={() => refreshProducts().then(() => toast('Produk dimuat ulang'))}
              >
                ⟳
              </button>
            </div>
            <div className="admin-products">
              {shown.map((p) => {
                const qty = adminCart[p.id] || 0
                return (
                  <article className="admin-product" key={p.id}>
                    <img src={p.img} alt={p.name} />
                    <div className="kasir-row-info">
                      <h3>{p.name}</h3>
                      <div className="kasir-row-sub">
                        {money(p.price)} · stok {stockText(p)}
                      </div>
                    </div>
                    <div className="kasir-row-action">
                      {qty === 0 ? (
                        <button
                          className="add"
                          aria-label={'Tambah ' + p.name}
                          onClick={() => {
                            addAdminItem(p.id, 1)
                          }}
                        >
                          +
                        </button>
                      ) : (
                        <div className="kasir-stepper" aria-label={'Jumlah ' + p.name}>
                          <button
                            aria-label={'Kurangi ' + p.name}
                            onClick={() => decAdminItem(p.id)}
                          >
                            −
                          </button>
                          <b>{qty}</b>
                          <button
                            aria-label={'Tambah ' + p.name}
                            onClick={() => addAdminItem(p.id, 1)}
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
            <div className="pos-product-empty" aria-live="polite" hidden={shown.length > 0}>
              <Icon name="search" />
              <b>Produk tidak ditemukan</b>
              <p>Coba nama lain atau hapus kata pencarian.</p>
            </div>
          </section>
          <section className="transaction">
            <h3>
              <Icon name="receipt" />
              <span>Transaksi Aktif</span>
              <span className="transaction-count">{itemCount} item</span>
            </h3>
            {kasirMember ? (
              <div className="kasir-member-badge">
                <span>👤 {kasirMember.name}</span>
                <span className="kasir-coin-info">
                  Saldo: {kasirMember.coins.toLocaleString('id-ID')} koin · Akan dapat:{' '}
                  {earnedCoins.toLocaleString('id-ID')}
                </span>
                <button
                  aria-label="Hapus member"
                  onClick={() => {
                    setKasirMember(null)
                  }}
                >
                  ×
                </button>
              </div>
            ) : null}
            <div id="adminCart">
              {entries.length ? (
                entries.map((e) => (
                  <div className="line-item" key={e.id}>
                    <div className="item-copy">
                      <strong>{e.product.short}</strong>
                      <small>
                        {money(e.product.price)} · ×{e.qty}
                      </small>
                    </div>
                    <div className="qty" aria-label={'Jumlah ' + e.product.name}>
                      <button
                        className="mini-btn"
                        aria-label={'Kurangi ' + e.product.name}
                        onClick={() => decAdminItem(e.id)}
                      >
                        −
                      </button>
                      <b>{e.qty}</b>
                      <button
                        className="mini-btn plus"
                        aria-label={'Tambah ' + e.product.name}
                        onClick={() => addAdminItem(e.id, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-note">Belum ada barang.</div>
              )}
            </div>
            <div className="totals">
              <div className="total-row">
                <span>Subtotal</span>
                <b>{money(total)}</b>
              </div>
              <div className="total-row final">
                <span>Total</span>
                <b>{money(total)}</b>
              </div>
            </div>
            <button className="pay" onClick={openCash}>
              <Icon name="lock" /> Bayar <span>{money(total)}</span>
            </button>
          </section>
        </div>
      </div>
      <AdminNav />
      <ScannerModal open={scanOpen} onClose={() => setScanOpen(false)} onScan={handleScan} />
      <CashPaymentSheet
        open={cashOpen}
        onClose={() => setCashOpen(false)}
        entries={entries.map((e) => ({ id: e.id, qty: e.qty }))}
        onDone={() => {
          setCashOpen(false)
          clearAdminCart()
          navigate('/admin/struk/terakhir')
        }}
      />
    </div>
  )
}


function CashPaymentSheet({
  open,
  onClose,
  entries,
  onDone,
}: {
  open: boolean
  onClose: () => void
  entries: { id: string; qty: number }[]
  onDone: () => void
}) {
  const products = useProductsStore((s) => s.products)
  const kasirMember = useLocalAdminStore((s) => s.kasirMember)
  const kasirRedeem = useLocalAdminStore((s) => s.kasirRedeem)
  const setKasirRedeem = useLocalAdminStore((s) => s.setKasirRedeem)
  const setKasirMember = useLocalAdminStore((s) => s.setKasirMember)
  const setLastReceipt = useLocalAdminStore((s) => s.setLastReceipt)
  const completeCashSale = useLocalAdminStore((s) => s.completeCashSale)

  const [receivedText, setReceivedText] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setReceivedText('')
      setBusy(false)
    }
  }, [open])

  const rawTotal = entries.reduce((s, e) => {
    const p = products.find((x) => x.id === e.id)
    return s + (p ? p.price * e.qty : 0)
  }, 0)

  const coin = useLocalAdminStore((s) => s.coin)

  const maxRedeem = useMemo(() => {
    if (!kasirMember || !coin.enabled) return 0
    const pct = Math.min(100, Math.max(0, Math.round(Number(coin.redeemPercent) || 0)))
    const val = Math.max(1, Math.round(Number(coin.value) || 1))
    if (pct <= 0 || val <= 0) return 0
    const maxByTotal = Math.floor((Math.max(0, rawTotal) * pct) / 100 / val)
    return Math.max(0, Math.min(kasirMember.coins, maxByTotal))
  }, [kasirMember, coin, rawTotal])

  const earned = useMemo(() => {
    if (!coin.enabled || !coin.events.spend) return 0
    const rule = Math.max(1, Math.round(Number(coin.spendRule) || 0))
    const reward = Math.max(0, Math.round(Number(coin.spendReward) || 0))
    if (rule <= 0 || reward <= 0) return 0
    return Math.floor(Math.max(0, rawTotal) / rule) * reward
  }, [coin, rawTotal])

  const payable =
    kasirMember && kasirRedeem
      ? Math.max(0, rawTotal - maxRedeem * Math.max(1, Math.round(Number(coin.value) || 1)))
      : rawTotal

  const received = numericValue(receivedText)
  const change = received - payable
  const valid = payable >= 0 && received >= payable
  const showRedeem = !!kasirMember && maxRedeem > 0

  const confirm = () => {
    if (!entries.length || received < payable) return
    const issue = entries.find((e) => {
      const p = products.find((x) => x.id === e.id)
      return !p || p.stock < e.qty
    })
    if (issue) {
      onClose()
      const p = products.find((x) => x.id === issue.id)
      toast('Stok ' + (p ? p.short : 'produk') + ' tidak cukup')
      return
    }
    let profit = 0
    let itemCount = 0
    const lines = entries.map((e) => {
      const p = products.find((x) => x.id === e.id)!
      profit += (p.price - p.cost) * e.qty
      itemCount += e.qty
      return { productId: e.id, qty: e.qty, name: p.short, total: p.price * e.qty }
    })
    const at = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date())
    const redeemCoins = kasirMember && kasirRedeem ? maxRedeem : 0
    const earnedCoins = kasirMember ? earned : 0
    setBusy(true)
    completeCashSale({
      lines,
      total: payable,
      profit,
      itemCount,
      redeemCoins,
      earnedCoins,
    })
      .then(() => {
        setLastReceipt({
          at,
          items: lines.map((l) => ({ name: l.name, qty: l.qty, total: l.total })),
          total: payable,
          rawTotal,
          cashReceived: received,
          change: received - payable,
          redeemCoins,
          earnedCoins,
          coinValue: Math.max(1, Math.round(Number(coin.value) || 1)),
          member: kasirMember
            ? { name: kasirMember.name, memberCode: kasirMember.memberCode }
            : null,
        })
        setKasirMember(null)
        setReceivedText('')
        onDone()
        toast('Pembayaran berhasil · stok & Pembukuan diperbarui')
      })
      .catch((error: unknown) => {
        const e = error as { code?: string; message?: string }
        if (!e || e.code !== 'OFFLINE') toast(e && e.message ? e.message : 'Penyimpanan gagal')
      })
      .finally(() => setBusy(false))
  }

  return (
    <Sheet open={open} onClose={onClose} sheetClassName="sheet">
      <SheetHeader kicker="Kasir tunai" title="Pembayaran" onClose={onClose} />
      <div className="cash-payment-total">
        <span>
          <small>Total belanja</small>
          <b>{money(payable)}</b>
        </span>
        <Icon name="cash" />
      </div>
      {showRedeem ? (
        <label className="kasir-redeem-row">
          <span>
            <b>Tukar Koin</b>
            <small>
              Pakai {maxRedeem.toLocaleString('id-ID')} koin (
              {money(maxRedeem * Math.max(1, Math.round(Number(coin.value) || 1)))})
            </small>
          </span>
          <span className="switch">
            <input
              type="checkbox"
              checked={kasirRedeem}
              onChange={(e) => setKasirRedeem(e.target.checked)}
            />
            <i />
          </span>
        </label>
      ) : null}
      <label className="field-label">
        Uang diterima (Rp)
        <input
          inputMode="numeric"
          placeholder="Contoh: 50000"
          autoComplete="off"
          value={receivedText}
          onChange={(e) => setReceivedText(e.target.value.replace(/[^\d]/g, ''))}
        />
      </label>
      <div className="cash-change">
        <span>Kembalian</span>
        <b>{received ? money(Math.max(0, change)) : 'Belum dihitung'}</b>
      </div>
      <p className={'cash-payment-status' + (received && !valid ? ' error' : '')}>
        {payable === 0
          ? 'Lunas dengan koin · transaksi siap diselesaikan.'
          : !received
            ? 'Masukkan jumlah uang yang diterima.'
            : valid
              ? 'Uang cukup · transaksi siap diselesaikan.'
              : 'Uang kurang ' + money(payable - received)}
      </p>
      <button className="primary-wide" disabled={!valid || busy} onClick={confirm}>
        {busy ? 'Menyimpan…' : 'Selesaikan & buka struk'}
      </button>
    </Sheet>
  )
}
