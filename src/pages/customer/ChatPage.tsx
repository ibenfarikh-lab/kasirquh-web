/**
 * KasirQuh React — src/pages/customer/ChatPage.tsx
 * Pengganti #chatCustomerView (Rumpi Warga + Chat Toko).
 * Rumpi Warga -> /beranda/chat/rumpi, Chat Toko -> /beranda/chat/toko (halaman penuh).
 */
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/ui'
import { useChatLocal } from '../../features/customer/local'

export default function ChatPage() {
  const navigate = useNavigate()
  const rumpiUnread = useChatLocal((s) => s.rumpiUnread)
  const threadUnread = useChatLocal((s) => s.threadUnread)
  const thread = useChatLocal((s) => s.thread)

  const latest = thread[thread.length - 1]

  return (
    <div id="chatCustomerView" className="customer-view">
      <header className="plain-head top-safe">
        <p className="page-kicker">Tetap terhubung</p>
        <h1>Chat</h1>
      </header>
      <main className="content">
        <div className="chat-choice">
          <button id="openCustomerRumpi" className="chat-choice-card" onClick={() => navigate('/beranda/chat/rumpi')}>
            <div className="chat-icon">
              <Icon name="users" />
            </div>
            <div>
              <h3>Rumpi Warga</h3>
              <p>Obrolan tetangga, resep, dan kabar sekitar.</p>
            </div>
            <span className="count-badge" id="customerRumpiCount" hidden={rumpiUnread === 0}>
              {rumpiUnread}
            </span>
          </button>
          <button id="openCustomerStoreChat" className="chat-choice-card" onClick={() => navigate('/beranda/chat/toko')}>
            <div className="chat-icon store-chat">
              <Icon name="store" />
            </div>
            <div>
              <h3>Chat Toko</h3>
              <p id="customerChatPreview">{latest ? latest.text : 'Tanya stok, pesanan, atau kebutuhanmu.'}</p>
            </div>
            <span className="chat-time-wrap">
              <small id="customerChatTime" hidden={!latest}>
                {latest ? latest.time : 'Belum ada'}
              </small>
              <b id="customerStoreUnread" className="chat-unread" hidden={threadUnread === 0}>
                {threadUnread}
              </b>
            </span>
          </button>
        </div>
      </main>
    </div>
  )
}
