import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader, Send, MessageSquare } from 'lucide-react'
import ChatSidebar from '../components/ChatSidebar'
import AssistantMessage from '../components/AssistantMessage'
import styles from './Chat.module.css'

const apiBaseUrl = import.meta.env.VITE_API_URL
const STORAGE_KEY = 'lumora_sessions'

function loadSessions() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveSessions(sessions) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function makeTitle(question) {
  const trimmed = question.trim()
  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  return capitalized.length > 40 ? capitalized.slice(0, 40) + '…' : capitalized
}

const WELCOME_MSG = {
  role: 'assistant',
  text: "Hi! I'm Lumora, your Space-O knowledge assistant. Ask me anything about company policies, leaves, reimbursements, and more.",
  sources: [],
  question: '',
}

export default function Chat() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState(loadSessions)
  const [activeId, setActiveId] = useState(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [askedRelated, setAskedRelated] = useState([]) // tracks related questions used this session
  const bottomRef = useRef(null)

  // current session's messages
  const activeSession = sessions.find(s => s.id === activeId)
  const messages = activeSession?.messages || [WELCOME_MSG]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function deleteSession(id) {
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== id)
      saveSessions(updated)
      return updated
    })
    if (activeId === id) {
      setActiveId(null)
      setAskedRelated([])
    }
  }

  function clearAllSessions() {
    if (!window.confirm('Delete all chat history? This cannot be undone.')) return
    setSessions([])
    saveSessions([])
    setActiveId(null)
    setAskedRelated([])
  }

  function startNewChat() {
    setActiveId(null)
    setInput('')
    setAskedRelated([])
  }

  function selectSession(id) {
    setActiveId(id)
    setInput('')
    setAskedRelated([])
  }

  function updateSession(id, updatedMessages) {
    setSessions(prev => {
      const updated = prev.map(s =>
        s.id === id ? { ...s, messages: updatedMessages } : s
      )
      saveSessions(updated)
      return updated
    })
  }

  async function sendMessage(questionOverride) {
    const q = (questionOverride || input).trim()
    if (!q || loading) return

    setInput('')

    // track if this was a related question
    if (questionOverride) {
      setAskedRelated(prev => [...prev, questionOverride])
    }

    const userMsg = { role: 'user', text: q, timestamp: Date.now() }
    const startTime = Date.now()

    // create a new session if none is active
    let sessionId = activeId
    let currentMessages = messages

    if (!sessionId) {
      sessionId = makeId()
      const newSession = {
        id: sessionId,
        title: makeTitle(q),
        messages: [WELCOME_MSG, userMsg],
        timestamp: Date.now(),
      }
      setSessions(prev => {
        const updated = [newSession, ...prev]
        saveSessions(updated)
        return updated
      })
      setActiveId(sessionId)
      currentMessages = [WELCOME_MSG, userMsg]
    } else {
      currentMessages = [...messages, userMsg]
      updateSession(sessionId, currentMessages)
    }

    setLoading(true)

    try {
      const res = await fetch(`${apiBaseUrl}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Request failed')

      // track session stats for homepage
      const elapsed = Date.now() - startTime
      const prevCount = parseInt(sessionStorage.getItem('lumora-questions') || '0', 10)
      const prevAvg = parseInt(sessionStorage.getItem('lumora-avg-ms') || '0', 10)
      const newCount = prevCount + 1
      const newAvg = Math.round((prevAvg * prevCount + elapsed) / newCount)
      sessionStorage.setItem('lumora-questions', String(newCount))
      sessionStorage.setItem('lumora-avg-ms', String(newAvg))

      const assistantMsg = {
        role: 'assistant',
        text: data.answer,
        sources: data.sources || [],
        question: q,
        timestamp: Date.now(),
      }
      const withResponse = [...currentMessages, assistantMsg]
      updateSession(sessionId, withResponse)
    } catch (err) {
      const errMsg = {
        role: 'assistant',
        text: `Something went wrong: ${err.message}`,
        sources: [],
        question: q,
      }
      updateSession(sessionId, [...currentMessages, errMsg])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const hasRealMessages = messages.some(m => m.role === 'user')

  return (
    <div className={styles.page}>
      <ChatSidebar
        sessions={sessions}
        activeId={activeId}
        onSelect={selectSession}
        onNewChat={startNewChat}
        onDeleteSession={deleteSession}
        onClearAll={clearAllSessions}
      />

      <div className={styles.chatArea}>
        {/* subtle aurora */}
        <div className={styles.aurora1} />
        <div className={styles.aurora2} />

        <div className={styles.thread}>
          {!hasRealMessages ? (
            <div className={styles.emptyState}>
              <MessageSquare size={40} className={styles.emptyIcon} />
              <p className={styles.emptyText}>Ask your first question</p>
              <p className={styles.emptyHint}>Type anything below to get started</p>
            </div>
          ) : (
            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                >
                  {msg.role === 'user' ? (
                    <div className={styles.userRow}>
                      <div className={styles.userBubbleWrap}>
                        <div className={styles.userBubble}>{msg.text}</div>
                        {msg.timestamp && (
                          <span className={styles.userTimestamp}>
                            {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : i === 0 ? (
                    <div className={styles.welcomeRow}>
                      <div className={styles.welcomeMsg}>{msg.text}</div>
                    </div>
                  ) : (
                    <AssistantMessage
                      msg={msg}
                      onRelatedSelect={sendMessage}
                      askedQuestions={askedRelated}
                    />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {loading && (
            <motion.div
              className={styles.thinking}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className={styles.thinkingAvatar}>L</div>
              <div className={styles.thinkingText}>
                <Loader size={13} className={styles.spin} />
                <span>Searching knowledge base…</span>
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className={styles.inputArea}>
          <div className={styles.inputBox}>
            <textarea
              className={styles.textarea}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything…"
              rows={1}
            />
            <button
              className={styles.sendBtn}
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
            >
              <Send size={15} />
            </button>
          </div>
          <p className={styles.footer}>
            &copy; 2026{' '}
            <a href="https://www.spaceotechnologies.com/" target="_blank" rel="noreferrer">
              Space-O Technologies
            </a>
            . Lumora is for internal use only.
          </p>
        </div>
      </div>
    </div>
  )
}
