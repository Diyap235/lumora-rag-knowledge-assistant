import { useState } from 'react'
import { Search, ArrowRight, Loader } from 'lucide-react'
import styles from './SearchBar.module.css'

export default function SearchBar({ onSubmit, loading = false, placeholder = "Ask anything about Space-O..." }) {
  const [query, setQuery] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (query.trim() && !loading) {
      onSubmit(query.trim())
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.inputWrapper}>
        <Search size={18} className={styles.icon} />
        <textarea
          className={styles.input}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
        />
        <button
          type="submit"
          className={styles.submitBtn}
          disabled={!query.trim() || loading}
        >
          {loading ? <Loader size={16} className={styles.spin} /> : <ArrowRight size={16} />}
        </button>
      </div>
    </form>
  )
}
