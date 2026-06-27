import styles from './KnowledgeGraph.module.css'

// positions nodes in a circle around the center answer node
function getNodePositions(count, cx, cy, radius) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    }
  })
}

export default function KnowledgeGraph({ sources, question }) {
  if (!sources || sources.length === 0) return null

  const W = 320
  const H = 200
  const cx = W / 2
  const cy = H / 2
  const radius = 70

  const positions = getNodePositions(sources.length, cx, cy, radius)

  function truncate(str, n) {
    return str.length > n ? str.slice(0, n) + '…' : str
  }

  return (
    <div className={styles.wrapper}>
      <p className={styles.heading}>Knowledge graph</p>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg}>
        {/* lines from center to each source */}
        {positions.map((pos, i) => (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={pos.x} y2={pos.y}
            className={styles.edge}
          />
        ))}

        {/* source nodes */}
        {positions.map((pos, i) => (
          <g key={i}>
            <circle cx={pos.x} cy={pos.y} r={22} className={styles.sourceNode} />
            <text x={pos.x} y={pos.y + 1} className={styles.nodeText} textAnchor="middle" dominantBaseline="middle">
              {truncate(sources[i].replace(/^.*[\\/]/, '').replace('.pdf','').replace('.txt','').replace('.docx',''), 8)}
            </text>
          </g>
        ))}

        {/* center answer node */}
        <circle cx={cx} cy={cy} r={28} className={styles.centerNode} />
        <text x={cx} y={cy} className={styles.centerText} textAnchor="middle" dominantBaseline="middle">Answer</text>
      </svg>
    </div>
  )
}
