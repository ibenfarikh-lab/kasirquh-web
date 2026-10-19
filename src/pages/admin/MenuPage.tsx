/**
 * KasirQuh React — src/pages/admin/MenuPage.tsx
 * Pengganti #menuView: grid Kelola Warung / Laci Alat / Pengaturan.
 * Tombol data-admin-jump -> rute admin; data-open-sheet -> sheet lokal.
 */
import { useNavigate } from 'react-router-dom'
import { useAdminBoot, adminRoute } from '../../features/admin/useAdminBoot'
import { Icon, toast } from '../../components/ui'
import { useAuthStore } from '../../stores/auth'
import AdminNav from '../../components/AdminNav'
import { clearGatewaySeen } from '../../lib/gateway'


interface MenuItem {
  icon: string
  title: string
  desc: string
  jump?: string
  route?: string
}

const MANAGE: MenuItem[] = [
  { icon: 'box', title: 'Produk', desc: 'Stok, foto, modal & harga jual', jump: 'produk' },
  { icon: 'store', title: 'Profil Toko', desc: 'Identitas, jam, alamat & telepon', jump: 'profil-toko' },
  { icon: 'home', title: 'Pusat Kendali Beranda', desc: 'Konten, tampilan & urutan bagian', jump: 'kendali-beranda' },
  { icon: 'coin', title: 'Koin Warga', desc: 'Nilai, event & batas penukaran', jump: 'pengaturan-koin' },
  { icon: 'receipt', title: 'Kasir Online', desc: 'Pesanan berlangsung & selesai', jump: 'online' },
  { icon: 'users', title: 'Data', desc: 'Pelanggan, persetujuan & laporan', jump: 'data' },
  { icon: 'chat', title: 'Chat', desc: 'Pelanggan & moderasi Rumpi', jump: 'chat' },
]

const TOOLS: MenuItem[] = [
  { icon: 'calculator', title: 'Kalkulator', desc: 'Hitung cepat', route: '/admin/kalkulator' },
  { icon: 'note', title: 'Catatan Toko', desc: 'Pengingat internal', jump: 'catatan-toko' },
  { icon: 'cart', title: 'Belanja Stok', desc: 'Daftar kulakan', jump: 'belanja-stok' },
  { icon: 'spark', title: 'AI Admin', desc: 'Ringkas & saran', jump: 'ai-admin' },
  { icon: 'book', title: 'Pembukuan', desc: 'Ringkasan kas & jurnal transaksi', jump: 'bookkeeping' },
  { icon: 'bank', title: 'Konfirmasi Transfer', desc: 'Verifikasi pembayaran', route: '/admin/transfer' },
  { icon: 'box', title: 'Paket Rutin', desc: 'Buat & kelola paket', jump: 'rutin' },
  { icon: 'box', title: 'Paket Hajatan', desc: 'Buat & kelola paket', jump: 'hajatan' },
  { icon: 'users', title: 'Patungan Warga', desc: 'Buat & kelola patungan', jump: 'patungan' },
  { icon: 'receipt', title: 'Struk 58mm', desc: 'Transaksi terakhir', route: '/admin/struk/terakhir' },
]

export default function MenuPage() {
  useAdminBoot()
  const navigate = useNavigate()

  const press = (item: MenuItem) => {
    if (item.jump) navigate(adminRoute(item.jump))
    else if (item.route) navigate(item.route)
  }

  const renderGrid = (items: MenuItem[]) => (
    <div className="admin-menu-grid">
      {items.map((item) => (
        <button key={item.title} className="menu-launch" onClick={() => press(item)}>
          <Icon name={item.icon} />
          <span>
            <b>{item.title}</b>
            <small>{item.desc}</small>
          </span>
        </button>
      ))}
    </div>
  )

  return (
    <div className="admin-screen">
      <div id="menuView" className="subview admin-menu-page active">
        <div className="admin-page-head">
          <span>
            <small>Semua alat &amp; pengaturan</small>
            <h2>Menu</h2>
          </span>
        </div>
        <section className="admin-menu-section">
          <h3>KELOLA WARUNG</h3>
          {renderGrid(MANAGE)}
        </section>
        <section className="admin-menu-section">
          <h3>LACI ALAT</h3>
          {renderGrid(TOOLS)}
        </section>
        <section className="admin-menu-section">
          <h3>PENGATURAN</h3>
          <div className="admin-menu-grid">
            <button
              className="menu-launch settings-wide"
              onClick={async () => {
                // Konsep terkunci: admin TIDAK boleh menjadi pelanggan.
                // Keluar dulu → gateway → masuk sebagai pelanggan bila perlu.
                await useAuthStore.getState().logout()
                clearGatewaySeen()
                navigate('/', { replace: true })
                toast('Keluar dari mode admin')
              }}
            >
              <Icon name="refresh" />
              <span>
                <b>Ganti ke Mode Pelanggan</b>
                <small>Lihat tampilan pelanggan</small>
              </span>
            </button>
            <button className="menu-launch settings-wide" onClick={() => navigate(adminRoute('pengaturan'))}>
              <Icon name="gear" />
              <span>
                <b>Pengaturan Global</b>
                <small>Tampilan, notifikasi, developer, tentang &amp; akun</small>
              </span>
            </button>
          </div>
          <p className="admin-menu-note">
            Kelola data warung, buka alat kerja, dan atur aplikasi dari satu halaman.
          </p>
        </section>
      </div>
      <AdminNav />

    </div>
  )
}
