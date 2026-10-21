/**
 * KasirQuh React — src/pages/admin/StoreProfilePage.tsx
 * Halaman Profil Toko (dulu StoreProfileSheet): #storeProfileModal
 * (identitas & jam operasional toko).
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '../../components/ui'
import AdminNav from '../../components/AdminNav'
import { useAdminBoot } from '../../features/admin/useAdminBoot'
import { useLocalAdminStore } from '../../features/admin/localAdmin'
import { useSettingsStore } from '../../stores/settings'

type ProfileField = 'name' | 'openAt' | 'closeAt' | 'address' | 'phone'

export default function StoreProfilePage() {
  useAdminBoot()
  const navigate = useNavigate()
  const storeName = useLocalAdminStore((s) => s.storeName)
  const openTime = useLocalAdminStore((s) => s.openTime)
  const closeTime = useLocalAdminStore((s) => s.closeTime)
  const storeAddress = useLocalAdminStore((s) => s.storeAddress)
  const storePhone = useLocalAdminStore((s) => s.storePhone)
  const saveStoreSettings = useLocalAdminStore((s) => s.saveStoreSettings)
  const settingsLoaded = useSettingsStore((s) => s.settingsLoaded)

  const [name, setName] = useState(storeName)
  const [openAt, setOpenAt] = useState(openTime)
  const [closeAt, setCloseAt] = useState(closeTime)
  const [address, setAddress] = useState(storeAddress)
  const [phone, setPhone] = useState(storePhone)
  const [saving, setSaving] = useState(false)

  /* Pengaman form settings (pola yang sama di semua form pengaturan):
   * field yang belum disentuh user mengikuti snapshot settings terbaru;
   * alamat & telepon kini dibaca dari dokumen — dulu teks contoh hardcode
   * yang selalu menimpa nilai live setiap kali profil disimpan. */
  const dirtyRef = useRef<Set<ProfileField>>(new Set())
  useEffect(() => {
    if (!settingsLoaded) return
    const d = dirtyRef.current
    if (!d.has('name')) setName((v) => (v === storeName ? v : storeName))
    if (!d.has('openAt')) setOpenAt((v) => (v === openTime ? v : openTime))
    if (!d.has('closeAt')) setCloseAt((v) => (v === closeTime ? v : closeTime))
    if (!d.has('address')) setAddress((v) => (v === storeAddress ? v : storeAddress))
    if (!d.has('phone')) setPhone((v) => (v === storePhone ? v : storePhone))
  }, [settingsLoaded, storeName, openTime, closeTime, storeAddress, storePhone])

  const save = () => {
    if (!settingsLoaded) {
      toast('Pengaturan masih dimuat — tunggu sebentar, lalu coba lagi')
      return
    }
    if (dirtyRef.current.size === 0) {
      /* Simpan tanpa perubahan: tidak menulis apa pun ke Firestore. */
      navigate(-1)
      toast('Tidak ada perubahan')
      return
    }
    const clean = (v: string) => v.replace(/[<>]/g, '').trim()
    setSaving(true)
    saveStoreSettings({
      storeName: clean(name) || 'Warunge Mimi',
      openTime: openAt || '06:00',
      closeTime: closeAt || '21:00',
      storeAddress: clean(address),
      storePhone: clean(phone),
    })
      .then(() => {
        navigate(-1)
        toast('Profil toko disimpan')
      })
      .catch((error: unknown) => {
        const e = error as { code?: string; message?: string }
        if (!e || e.code !== 'OFFLINE') toast(e && e.message ? e.message : 'Gagal menyimpan')
      })
      .finally(() => setSaving(false))
  }

  return (
    <div className="admin-screen">
      <div id="storeProfileView" className="subview admin-page active">
        <div className="admin-page-head">
          <span>
            <small>Kelola Warung</small>
            <h2>Profil Toko</h2>
          </span>
        </div>
      <p className="tool-intro">Identitas dan informasi operasional yang dilihat pelanggan.</p>
      {!settingsLoaded && <p className="tool-intro">Memuat pengaturan toko…</p>}
      <div className="control-grid">
        <label className="control-field full">
          Nama toko
          <input
            value={name}
            onChange={(e) => {
              dirtyRef.current.add('name')
              setName(e.target.value)
            }}
          />
        </label>
        <label className="control-field">
          Jam buka
          <input
            type="time"
            value={openAt}
            onChange={(e) => {
              dirtyRef.current.add('openAt')
              setOpenAt(e.target.value)
            }}
          />
        </label>
        <label className="control-field">
          Jam tutup
          <input
            type="time"
            value={closeAt}
            onChange={(e) => {
              dirtyRef.current.add('closeAt')
              setCloseAt(e.target.value)
            }}
          />
        </label>
        <label className="control-field full">
          Alamat
          <textarea
            value={address}
            onChange={(e) => {
              dirtyRef.current.add('address')
              setAddress(e.target.value)
            }}
          />
        </label>
        <label className="control-field full">
          Telepon
          <input
            type="tel"
            value={phone}
            onChange={(e) => {
              dirtyRef.current.add('phone')
              setPhone(e.target.value)
            }}
          />
        </label>
      </div>
      <button className="primary-wide" style={{ marginTop: 12 }} disabled={saving || !settingsLoaded} onClick={save}>
        {saving ? 'Menyimpan…' : 'Simpan Profil Toko'}
      </button>
        <AdminNav />
      </div>
    </div>
  )
}
