import { useEffect, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useSWUpdate } from './lib/swUpdate'
import BootLoading from './components/BootLoading'
import { Toaster } from './components/ui'
import CustomerNav from './components/CustomerNav'
import { AuthSheet } from './components/AuthSheet'
import { AdminLoginSheet } from './components/AdminLoginSheet'
import { SvgSprite } from './components/SvgSprite'
import { activateRoleTheme, watchSystemTheme } from './lib/theme'
import { guestGateForPath } from './lib/guestGate'
import { authPersistenceReady } from './lib/firebase'
import { useAuthStore } from './stores/auth'
import { usePromoStore } from './stores/promo'
import { useProductsStore } from './stores/products'
import { useSettingsStore } from './stores/settings'
import { useCatalogStore } from './stores/catalog'
import { useChatStore } from './stores/chat'
import GatewayPage from './pages/customer/GatewayPage'
import HomePage from './pages/customer/HomePage'
import CatalogPage from './pages/customer/CatalogPage'
import CartPage from './pages/customer/CartPage'
import ChatPage from './pages/customer/ChatPage'
import RumpiPage from './pages/customer/RumpiPage'
import TokoChatPage from './pages/customer/TokoChatPage'
import AccountPage from './pages/customer/AccountPage'
import BudgetPage from './pages/customer/BudgetPage'
import CustomerNotesPage from './pages/customer/NotesPage'
import RecipeFormPage from './pages/customer/RecipeFormPage'
import TitipPage from './pages/customer/TitipPage'
import GrosirPage from './pages/customer/GrosirPage'
import HajatanPage from './pages/customer/HajatanPage'
import PatunganPage from './pages/customer/PatunganPage'
import GamePage from './pages/customer/GamePage'
import RutinPage from './pages/customer/RutinPage'
import CoinPage from './pages/customer/CoinPage'
import DeliveryPage from './pages/customer/DeliveryPage'
import HistoryPage from './pages/customer/HistoryPage'
import MissionsPage from './pages/customer/MissionsPage'
import OrderPage from './pages/customer/OrderPage'
import QuizPage from './pages/customer/QuizPage'
import DashboardPage from './pages/admin/DashboardPage'
import PosPage from './pages/admin/PosPage'
import InboxPage from './pages/admin/InboxPage'
import OnlinePage from './pages/admin/OnlinePage'
import DataPage from './pages/admin/DataPage'
import ReportsPage from './pages/admin/ReportsPage'
import NotesPage from './pages/admin/NotesPage'
import BookkeepingPage from './pages/admin/BookkeepingPage'
import MenuPage from './pages/admin/MenuPage'
import ProductsPage from './pages/admin/ProductsPage'
import AdminChatPage from './pages/admin/ChatPage'
import AdminRumpiPage from './pages/admin/RumpiPage'
import AdminTokoChatPage from './pages/admin/TokoChatPage'
import SettingsPage from './pages/admin/SettingsPage'
import StoreProfilePage from './pages/admin/StoreProfilePage'
import AdminAiPage from './pages/admin/AdminAiPage'
import HomeControlPage from './pages/admin/HomeControlPage'
import CoinSettingsPage from './pages/admin/CoinSettingsPage'
import HajatanAdminPage from './pages/admin/HajatanAdminPage'
import PatunganAdminPage from './pages/admin/PatunganAdminPage'
import RutinAdminPage from './pages/admin/RutinAdminPage'
import StockShoppingPage from './pages/admin/StockShoppingPage'
import StoreNotesPage from './pages/admin/StoreNotesPage'
import CalculatorPage from './pages/admin/CalculatorPage'
import ProductFormPage from './pages/admin/ProductFormPage'
import ReceiptPage from './pages/admin/ReceiptPage'
import TransferPage from './pages/admin/TransferPage'


function Boot() {
  useEffect(() => {
    let cancelled = false
    const unsubs: (() => void)[] = []
    unsubs.push(useAuthStore.getState().init())
    authPersistenceReady.then(() => {
      if (cancelled) return
      unsubs.push(useProductsStore.getState().subscribe())
      unsubs.push(useSettingsStore.getState().subscribe())
      unsubs.push(useCatalogStore.getState().subscribeRecipes())
      unsubs.push(useCatalogStore.getState().subscribePatungan())
      unsubs.push(useCatalogStore.getState().subscribeRutinPackages())
      unsubs.push(useCatalogStore.getState().subscribeHajatanPackages())
      unsubs.push(useChatStore.getState().subscribeRumpi())
    })
    activateRoleTheme('customer')
    const unwatch = watchSystemTheme(() => {
      const role = useAuthStore.getState().session.role
      activateRoleTheme(role === 'admin' ? 'admin' : 'customer')
    })
    unsubs.push(unwatch)
    const unsubRole = useAuthStore.subscribe((st) => {
      activateRoleTheme(st.session.role === 'admin' ? 'admin' : 'customer')
    })
    unsubs.push(unsubRole)
    return () => {
      cancelled = true
      unsubs.forEach((u) => {
        try {
          u()
        } catch {
        }
      })
    }
  }, [])
  return null
}

function GuestGate({ children }: { children: ReactNode }) {
  const isGuest = useAuthStore((s) => s.session.isGuest)
  const openLoginSheet = useAuthStore((s) => s.openLoginSheet)
  const { pathname } = useLocation()
  const gate = isGuest ? guestGateForPath(pathname) : null
  useEffect(() => {
    if (gate) openLoginSheet(gate.action, gate.message)
  }, [gate, openLoginSheet])
  return <>{gate ? <HomePage /> : children}</>
}

function CustomerLayout() {
  const loginSheetOpen = useAuthStore((s) => s.loginSheetOpen)
  const closeLoginSheet = useAuthStore((s) => s.closeLoginSheet)
  const adminSheetOpen = useAuthStore((s) => s.adminSheetOpen)
  const closeAdminSheet = useAuthStore((s) => s.closeAdminSheet)
  const isGuest = useAuthStore((s) => s.session.isGuest)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const MAIN_TABS = ['/beranda', '/beranda/produk', '/beranda/keranjang', '/beranda/chat', '/beranda/akun']
  const showNav = MAIN_TABS.includes(pathname)

  function handleLoginSheetClose() {
    closeLoginSheet()
    if (isGuest && guestGateForPath(pathname)) {
      navigate('/beranda', { replace: true })
    }
  }

  const custRole = useAuthStore((s) => s.session.role)
  const custIsGuest = useAuthStore((s) => s.session.isGuest)
  const custId = useAuthStore((s) => s.session.customerId)
  const custLastCheckin = useAuthStore((s) => s.myCustomerDoc?.lastCheckin)
  const settingsLoaded = useSettingsStore((s) => s.settingsLoaded)
  useEffect(() => {
    if (custRole !== 'customer' || custIsGuest || !custId || !settingsLoaded) return
    void usePromoStore.getState().checkin()
  }, [custRole, custIsGuest, custId, custLastCheckin, settingsLoaded])

  return (
    <>
      <div className={`app customer-app${showNav ? '' : ' no-nav'}`}>
        <GuestGate>
          <Outlet />
        </GuestGate>
        <AuthSheet open={loginSheetOpen} onClose={handleLoginSheetClose} />
        <AdminLoginSheet open={adminSheetOpen} onClose={closeAdminSheet} />
      </div>
      {showNav && <CustomerNav />}
    </>
  )
}

function CustomerGate() {
  const authReady = useAuthStore((s) => s.authReady)
  const role = useAuthStore((s) => s.session.role)
  if (!authReady) {
    return (
      <div className="app">
        <BootLoading />
      </div>
    )
  }
  if (role === 'admin') return <Navigate to="/admin" replace />
  return <CustomerLayout />
}

function AdminGate() {
  const authReady = useAuthStore((s) => s.authReady)
  const role = useAuthStore((s) => s.session.role)
  if (!authReady) {
    return (
      <div className="app">
        <BootLoading />
      </div>
    )
  }
  if (role !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}

export default function App() {
  const { updating } = useSWUpdate()
  return (
    <BrowserRouter>
      <SvgSprite />
      <Boot />
      {updating && (
        <div className="sw-update-banner" role="alert">
          <span>Memperbarui aplikasi…</span>
        </div>
      )}
      <Routes>
        { }
        <Route path="/" element={<GatewayPage />} />
        <Route path="/beranda" element={<CustomerGate />}>
          <Route index element={<HomePage />} />
          <Route path="produk" element={<CatalogPage />} />
          <Route path="keranjang" element={<CartPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="chat/rumpi" element={<RumpiPage />} />
          <Route path="chat/toko" element={<TokoChatPage />} />
          <Route path="akun" element={<AccountPage />} />
          <Route path="anggaran" element={<BudgetPage />} />
          <Route path="catatan" element={<CustomerNotesPage />} />
          <Route path="resep-baru" element={<RecipeFormPage />} />
          <Route path="titip" element={<TitipPage />} />
          <Route path="grosir" element={<GrosirPage />} />
          <Route path="hajatan" element={<HajatanPage />} />
          <Route path="patungan" element={<PatunganPage />} />
          <Route path="rutin" element={<RutinPage />} />
          <Route path="koin" element={<CoinPage />} />
          <Route path="checkout" element={<DeliveryPage />} />
          <Route path="riwayat" element={<HistoryPage />} />
          <Route path="misi" element={<MissionsPage />} />
          <Route path="pesanan/:id" element={<OrderPage />} />
          <Route path="kuis" element={<QuizPage />} />
          <Route path="game/:kind" element={<GamePage />} />
        </Route>
        <Route path="/admin" element={<AdminGate />}>
          <Route index element={<DashboardPage />} />
          <Route path="kasir" element={<PosPage />} />
          <Route path="pesanan" element={<InboxPage />} />
          <Route path="online" element={<OnlinePage />} />
          <Route path="data" element={<DataPage />} />
          <Route path="laporan" element={<ReportsPage />} />
          <Route path="catatan" element={<NotesPage />} />
          <Route path="pembukuan" element={<BookkeepingPage />} />
          <Route path="menu" element={<MenuPage />} />
          <Route path="produk" element={<ProductsPage />} />
          <Route path="chat" element={<AdminChatPage />} />
          <Route path="chat/rumpi" element={<AdminRumpiPage />} />
          <Route path="chat/toko" element={<AdminTokoChatPage />} />
          <Route path="pengaturan" element={<SettingsPage />} />
          <Route path="profil-toko" element={<StoreProfilePage />} />
          <Route path="ai" element={<AdminAiPage />} />
          <Route path="kendali-beranda" element={<HomeControlPage />} />
          <Route path="pengaturan-koin" element={<CoinSettingsPage />} />
          <Route path="hajatan" element={<HajatanAdminPage />} />
          <Route path="patungan" element={<PatunganAdminPage />} />
          <Route path="rutin" element={<RutinAdminPage />} />
          <Route path="catatan-toko" element={<StoreNotesPage />} />
          <Route path="belanja-stok" element={<StockShoppingPage />} />
          <Route path="kalkulator" element={<CalculatorPage />} />
          <Route path="transfer" element={<TransferPage />} />
          <Route path="struk/:id" element={<ReceiptPage />} />
          <Route path="produk/baru" element={<ProductFormPage />} />
          <Route path="produk/:id/edit" element={<ProductFormPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}
