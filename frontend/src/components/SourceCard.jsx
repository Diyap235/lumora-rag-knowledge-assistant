import { FileText, Globe, ExternalLink } from 'lucide-react'
import styles from './SourceCard.module.css'

export default function SourceCard({ source, index }) {
  const isUrl = source.startsWith('http')
  const label = isUrl
    ? new URL(source).hostname.replace('www.', '')
    : source

  return (
    <a
      href={isUrl ? source : '#'}
      target={isUrl ? '_blank' : undefined}
      rel="noreferrer"
      className={styles.card}
    >
      <div className={styles.iconWrap}>
        {isUrl ? <Globe size={14} /> : <FileText size={14} />}
      </div>
      <div className={styles.info}>
        <span className={styles.index}>{index + 1}</span>
        <span className={styles.label} title={source}>{label}</span>
      </div>
      {isUrl && <ExternalLink size={11} className={styles.external} />}
    </a>
  )
}
