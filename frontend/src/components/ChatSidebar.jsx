import { Plus, MessageSquare, Trash2 } from 'lucide-react'
import styles from './ChatSidebar.module.css'

export default function ChatSidebar({ sessions, activeId, onSelect, onNewChat, onDeleteSession, onClearAll }) {
  function formatDate(ts) {
    const d = new Date(ts)
    const isToday = d.toDateString() === new Date().toDateString()
    if (isToday) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
  }

  function handleDeleteSession(e, id) {
    e.stopPropagation() // don't trigger onSelect
    onDeleteSession(id)
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <button className={styles.newChatBtn} onClick={onNewChat}>
          <Plus size={15} />
          New Chat
        </button>
      </div>

      <div className={styles.list}>
        {sessions.length === 0 && (
          <p className={styles.empty}>No conversations yet</p>
        )}
        {sessions.map(session => (
          <div
            key={session.id}
            className={`${styles.item} ${session.id === activeId ? styles.active : ''}`}
            onClick={() => onSelect(session.id)}
          >
            <MessageSquare size={13} className={styles.itemIcon} />
            <div className={styles.itemText}>
              <span className={styles.itemTitle}>{session.title}</span>
              <span className={styles.itemDate}>{formatDate(session.timestamp)}</span>
            </div>
            <button
              className={styles.deleteBtn}
              onClick={e => handleDeleteSession(e, session.id)}
              title="Delete this chat"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      {sessions.length > 0 && (
        <div className={styles.footer}>
          <button className={styles.clearAllBtn} onClick={onClearAll}>
            Clear history
          </button>
        </div>
      )}
    </aside>
  )
}
