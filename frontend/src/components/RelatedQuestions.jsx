import { useState, useEffect } from 'react'
import styles from './RelatedQuestions.module.css'

const apiBaseUrl = import.meta.env.VITE_API_URL

function getCandidates(question) {
  const q = question.toLowerCase()

  if (q.includes('leave')) return [
    'How many leaves do I get per year?',
    'Can I carry forward unused leaves?',
    'What is the process to apply for leave?',
  ]
  if (q.includes('reimburse') || q.includes('expense')) return [
    'What expenses are eligible for reimbursement?',
    'How long does reimbursement take?',
    'What documents are needed for reimbursement?',
  ]
  if (q.includes('office') || q.includes('hour') || q.includes('timing')) return [
    'What are the office hours?',
    'What is the late arrival policy?',
    'Is there a grace period for arriving late?',
  ]
  if (q.includes('recruit') || q.includes('hire') || q.includes('join')) return [
    'What is the onboarding process?',
    'How long is the probation period?',
    'What documents are needed to join?',
  ]

  return []
}

export default function RelatedQuestions({ question, onSelect, askedQuestions = [] }) {
  const [validQuestions, setValidQuestions] = useState([])

  useEffect(() => {
    const candidates = getCandidates(question)
    if (candidates.length === 0) return

    fetch(`${apiBaseUrl}/related`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions: candidates }),
    })
      .then(r => r.json())
      .then(data => {
        // filter out questions already asked in this conversation
        const filtered = (data.questions || []).filter(q => !askedQuestions.includes(q))
        setValidQuestions(filtered.slice(0, 3))
      })
      .catch(() => setValidQuestions([]))
  }, [question])

  if (validQuestions.length === 0) return null

  return (
    <div className={styles.wrapper}>
      <p className={styles.heading}>Related questions</p>
      <div className={styles.list}>
        {validQuestions.map(q => (
          <button key={q} className={styles.chip} onClick={() => onSelect(q)}>
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}
