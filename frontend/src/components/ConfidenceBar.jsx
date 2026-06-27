import styles from './ConfidenceBar.module.css'

function getConfidence(text, sources) {
  if (!text) return null
  if (text.toLowerCase().includes("couldn't find") || text.toLowerCase().includes("i don't know")) {
    return { level: 'low', label: 'Low confidence', pct: 25 }
  }
  if (sources?.length > 0) {
    return { level: 'high', label: 'High confidence', pct: 90 }
  }
  return { level: 'medium', label: 'Medium confidence', pct: 60 }
}

export default function ConfidenceBar({ text, sources }) {
  const confidence = getConfidence(text, sources)
  if (!confidence) return null

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.bar} ${styles[confidence.level]}`}>
        <div className={styles.fill} style={{ width: `${confidence.pct}%` }} />
      </div>
      <span className={`${styles.label} ${styles[confidence.level]}`}>{confidence.label}</span>
    </div>
  )
}
