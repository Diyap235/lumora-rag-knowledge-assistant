import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Database, MessageSquare, Sun, Moon } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import styles from './Layout.module.css'

const apiBaseUrl = import.meta.env.VITE_API_URL

export default function Layout({ children }) {
  const { pathname } = useLocation()
  const { theme, toggleTheme } = useTheme()
  const [docCount, setDocCount] = useState(null)

  const onSearch = pathname === '/' || pathname.startsWith('/chat')
  const onKB = pathname === '/kb-manager'

  useEffect(() => {
    function fetchCount() {
      fetch(`${apiBaseUrl}/documents`)
        .then(r => r.json())
        .then(data => setDocCount(data.documents?.length ?? 0))
        .catch(() => setDocCount(0))
    }
    fetchCount()
    // re-fetch when KB Manager fires a doc change event
    window.addEventListener('lumora-docs-updated', fetchCount)
    return () => window.removeEventListener('lumora-docs-updated', fetchCount)
  }, [])

  return (
    <div className={styles.root}>
      <nav className={styles.nav}>
        <div className={styles.navLeft}>
          <Link to="/" className={styles.logo}>
            <img src="/logo-icon.svg" alt="Lumora" className={styles.logoImg} />
            <div className={styles.logoText}>
              <span className={styles.logoName}>Lumora</span>
              <span className={styles.logoSub}>Space-O's Internal Knowledge Assistant</span>
            </div>
          </Link>

          <div className={styles.liveBadge} title="Knowledge base status">
            <span className={styles.liveDot} />
            <span className={styles.liveLabel}>
              Live{docCount !== null ? ` · ${docCount} docs` : ''}
            </span>
          </div>
        </div>

        <div className={styles.navCenter}>
          <Link to="/" className={`${styles.navLink} ${onSearch ? styles.active : ''}`}>
            <MessageSquare size={15} />
            Search
          </Link>
          <Link to="/kb-manager" className={`${styles.navLink} ${onKB ? styles.active : ''}`}>
            <Database size={15} />
            KB Manager
          </Link>
        </div>

        <button
          className={styles.themeBtn}
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </nav>

      <main className={styles.main}>
        {children}
      </main>
    </div>
  )
}
