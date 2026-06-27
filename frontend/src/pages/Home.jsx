import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import SearchBar from '../components/SearchBar'
import styles from './Home.module.css'

const PLACEHOLDERS = [
  'What is the leave policy?',
  'How do I submit a reimbursement?',
  'What are the office hours?',
  'What is the onboarding process?',
  'How do I request long leave?',
]

// real questions that navigate directly to chat — not keywords
const SUGGESTED_QUESTIONS = [
  'How many leave days do I get per year?',
  'What are the office hours at Space-O?',
  'How do I submit a reimbursement claim?',
  'What is the recruitment and hiring process?',
  'How do I apply for a long leave?',
]

export default function Home() {
  const navigate = useNavigate()
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setPlaceholderIndex(i => (i + 1) % PLACEHOLDERS.length)
    }, 3000)
    return () => clearInterval(timerRef.current)
  }, [])

  function handleSearch(query) {
    navigate(`/chat?q=${encodeURIComponent(query)}`)
  }

  return (
    <div className={styles.page}>
      <div className={styles.aurora1} />
      <div className={styles.aurora2} />
      <div className={styles.aurora3} />

      <motion.div
        className={styles.content}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <div className={styles.hero}>
          <p className={styles.eyebrow}>Space-O Technologies</p>
          <h1 className={styles.heading}>
            <span className={styles.lumoraText}>Lumora</span>
          </h1>
          <p className={styles.subheading}>
            Ask anything about company policies, documents, and procedures.
            Get instant cited answers from the knowledge base.
          </p>
        </div>

        <div className={styles.searchWrap}>
          <SearchBar
            onSubmit={handleSearch}
            placeholder={PLACEHOLDERS[placeholderIndex]}
          />
        </div>

        <div className={styles.prompts}>
          <span className={styles.promptsLabel}>Try asking</span>
          <div className={styles.promptChips}>
            {SUGGESTED_QUESTIONS.map(question => (
              <button
                key={question}
                className={styles.chip}
                onClick={() => handleSearch(question)}
              >
                {question}
              </button>
            ))}
          </div>
        </div>

        <p className={styles.footer}>
          &copy; 2026{' '}
          <a href="https://www.spaceotechnologies.com/" target="_blank" rel="noreferrer">
            Space-O Technologies
          </a>
          . Lumora is for internal use only.
        </p>
      </motion.div>
    </div>
  )
}
