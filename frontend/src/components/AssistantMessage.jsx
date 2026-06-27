import { useState } from 'react'
import { Copy, ThumbsUp, ThumbsDown, FileText, Globe, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import RelatedQuestions from './RelatedQuestions'
import { getDisplayName, getSourceVersion } from '../utils/kbMeta'
import styles from './AssistantMessage.module.css'

const apiBaseUrl = import.meta.env.VITE_API_URL

const FALLBACK_PHRASES = [
  "i couldn't find",
  "i don't know",
  "not find that",
  "no information",
  "couldn't find specific",
]

function isFallback(text) {
  const t = text.toLowerCase()
  return FALLBACK_PHRASES.some(phrase => t.includes(phrase))
}

function formatTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function renderAnswer(text) {
  const lines = text.split('\n')
  const blocks = []
  let listItems = []

  function flush() {
    if (listItems.length) {
      blocks.push({ type: 'list', items: [...listItems] })
      listItems = []
    }
  }

  for (const line of lines) {
    const t = line.trim()
    if (t.startsWith('- ')) {
      listItems.push(t.slice(2))
    } else {
      flush()
      if (t) blocks.push({ type: 'text', content: t })
    }
  }
  flush()

  return blocks.map((b, i) =>
    b.type === 'list' ? (
      <ul key={i} className={styles.list}>
        {b.items.map((item, j) => <li key={j}>{item}</li>)}
      </ul>
    ) : (
      <p key={i} className={styles.para}>{b.content}</p>
    )
  )
}

// Fix 3A: show clean display name + version instead of raw filename
function SourceChip({ source }) {
  const [expanded, setExpanded] = useState(false)
  const isUrl = source.name.startsWith('http')

  const label = isUrl
    ? new URL(source.name).hostname.replace('www.', '')
    : getDisplayName(source.name)

  const version = isUrl ? null : getSourceVersion(source.name)

  return (
    <div className={styles.sourceChipWrap}>
      <button className={styles.sourceChip} onClick={() => setExpanded(v => !v)}>
        {isUrl ? <Globe size={11} /> : <FileText size={11} />}
        <span>{label}</span>
        {!isUrl && <span className={styles.chipVersion}>· v{version}</span>}
        {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      {expanded && source.excerpt && (
        <div className={styles.sourceExcerpt}>
          <p className={styles.excerptLabel}>Relevant excerpt</p>
          <p className={styles.excerptText}>{source.excerpt}</p>
        </div>
      )}
    </div>
  )
}

export default function AssistantMessage({ msg, onRelatedSelect, askedQuestions }) {
  const [copied, setCopied] = useState(false)
  // Fix 3C: feedback state — null = not voted, 'up' or 'down' = voted (locked)
  const [feedback, setFeedback] = useState(null)
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [thankYou, setThankYou] = useState(false)

  const fallback = isFallback(msg.text)
  const hasSources = !fallback && msg.sources?.length > 0

  function copyAnswer() {
    navigator.clipboard.writeText(msg.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Fix 3C: submit feedback to backend, disable buttons after first vote
  async function submitFeedback(vote) {
    if (feedbackSent) return
    setFeedback(vote)
    setFeedbackSent(true)

    try {
      await fetch(`${apiBaseUrl}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: msg.question || '',
          answer: msg.text,
          sources: msg.sources || [],
          feedback: vote,
          timestamp: new Date().toISOString(),
        }),
      })
    } catch {
      // feedback submission failure is non-critical
    }

    setThankYou(true)
    setTimeout(() => setThankYou(false), 2000)
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.avatar}>L</div>

      <div className={`${styles.card} ${fallback ? styles.cardFallback : ''}`}>

        {fallback && (
          <div className={styles.fallbackHeader}>
            <AlertTriangle size={14} className={styles.fallbackIcon} />
            <span>No matching information found in the knowledge base</span>
          </div>
        )}

        <div className={styles.answer}>
          {renderAnswer(msg.text)}
        </div>

        {!fallback && msg.question && (
          <RelatedQuestions
            question={msg.question}
            onSelect={onRelatedSelect}
            askedQuestions={askedQuestions}
          />
        )}

        {hasSources && (
          <>
            <div className={styles.divider} />
            <div className={styles.sourcesSection}>
              <span className={styles.sectionLabel}>Sources used</span>
              <div className={styles.chips}>
                {msg.sources.map((src, i) => (
                  <SourceChip
                    key={i}
                    source={{ name: src, excerpt: msg.excerpts?.[i] || '' }}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        <div className={styles.divider} />
        <div className={styles.actionsRow}>
          <div className={styles.actions}>
            <button className={styles.actionBtn} onClick={copyAnswer} title="Copy answer">
              <Copy size={13} />
              {copied ? 'Copied ✓' : 'Copy'}
            </button>

            {/* Fix 3C: disabled after vote, highlight selected */}
            <button
              className={`${styles.actionBtn} ${feedback === 'up' ? styles.actionActive : ''}`}
              onClick={() => submitFeedback('up')}
              disabled={feedbackSent}
              title="Good answer"
            >
              <ThumbsUp size={13} />
            </button>
            <button
              className={`${styles.actionBtn} ${feedback === 'down' ? styles.actionActiveDown : ''}`}
              onClick={() => submitFeedback('down')}
              disabled={feedbackSent}
              title="Poor answer"
            >
              <ThumbsDown size={13} />
            </button>

            {thankYou && (
              <span className={styles.thankYou}>Thanks for your feedback</span>
            )}
          </div>
          {msg.timestamp && (
            <span className={styles.timestamp}>{formatTime(msg.timestamp)}</span>
          )}
        </div>

      </div>
    </div>
  )
}
