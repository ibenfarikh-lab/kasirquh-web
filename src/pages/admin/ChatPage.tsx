import { useNavigate } from 'react-router-dom'
import { useAdminBoot } from '../../features/admin/useAdminBoot'
import { useLocalAdminStore } from '../../features/admin/localAdmin'
import { Icon } from '../../components/ui'
import AdminNav from '../../components/AdminNav'

export default function ChatPage() {
  useAdminBoot()
  const navigate = useNavigate()
  const rumpiMessages = useLocalAdminStore((s) => s.rumpiMessages)
  const directThreads = useLocalAdminStore((s) => s.directThreads)

  const threads = Object.values(directThreads)
  const totalUnread = threads.reduce((sum, t) => sum + (t.unread || 0), 0)
  const latestThread = threads[0]
  const latest = latestThread?.messages?.[latestThread.messages.length - 1] ?? (latestThread ? { text: latestThread.lastMessage, time: '' } : undefined)

  return (
    <div className="admin-screen">
      <div className="subview admin-page active">
        <div className="admin-task-head">
          <div>
            <p className="page-kicker">Tetap terhubung</p>
            <h2>Chat</h2>
          </div>
        </div>
        <div className="chat-choice">
          <button className="chat-choice-card" onClick={() => navigate('/admin/chat/rumpi')}>
            <div className="chat-icon">
              <Icon name="users" />
            </div>
            <div>
              <h3>Rumpi Warga</h3>
              <p>Moderasi obrolan warga, posting sebagai Mimi.</p>
            </div>
            <span className="count-badge" hidden={rumpiMessages.length === 0}>
              {rumpiMessages.length}
            </span>
          </button>
          <button className="chat-choice-card" onClick={() => navigate('/admin/chat/toko')}>
            <div className="chat-icon store-chat">
              <Icon name="store" />
            </div>
            <div>
              <h3>Chat Toko</h3>
              <p>{latest ? latest.text : 'Balas pesan pelanggan.'}</p>
            </div>
            <span className="chat-time-wrap">
              <small hidden={!latest}>
                {latest ? latest.time : 'Belum ada'}
              </small>
              <b className="chat-unread" hidden={totalUnread === 0}>
                {totalUnread}
              </b>
            </span>
          </button>
        </div>
      </div>
      <AdminNav />
    </div>
  )
}
