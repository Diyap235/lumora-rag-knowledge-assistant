import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Upload, Link, FileText, Globe, Trash2, CheckCircle, XCircle, Database, RefreshCw, AlertCircle } from 'lucide-react'
import styles from './KBManager.module.css'
import { getDisplayName, getSourceVersion, saveSourceMeta, saveSourceMetaAsVersion } from '../utils/kbMeta'

const apiBaseUrl = import.meta.env.VITE_API_URL

export default function KBManager() {
  const [knowledgeSources, setKnowledgeSources] = useState([])
  const [file, setFile] = useState(null)
  const [urlInput, setUrlInput] = useState('')
  const [fileStatus, setFileStatus] = useState(null)
  const [urlStatus, setUrlStatus] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [ingestingUrl, setIngestingUrl] = useState(false)
  const [removingSource, setRemovingSource] = useState(null)
  // Fix 3: modal state for duplicate detection
  const [duplicateModal, setDuplicateModal] = useState(null) // { file, existing }
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    fetchKnowledgeSources()
  }, [])

  async function fetchKnowledgeSources() {
    try {
      const res = await fetch(`${apiBaseUrl}/documents`)
      const data = await res.json()
      setKnowledgeSources(data.documents || [])
      window.dispatchEvent(new Event('lumora-docs-updated'))
    } catch {
      // fetch failed, list stays empty
    }
  }

  // Fix 3: check for duplicate before uploading
  function handleFileSelect(f) {
    if (!f) return
    setFileStatus(null)

    const displayName = getDisplayName(f.name)
    const existing = knowledgeSources.find(
      s => getDisplayName(s.source) === displayName && s.type !== 'url'
    )

    if (existing) {
      // duplicate found — show modal instead of uploading
      setDuplicateModal({ file: f, existing })
    } else {
      setFile(f)
    }
  }

  // Fix 3: user confirmed replacement
  async function replaceWithNewVersion() {
    const { file: f, existing } = duplicateModal
    setDuplicateModal(null)
    setUploading(true)
    setFileStatus(null)

    try {
      // 1. delete old document
      const delRes = await fetch(`${apiBaseUrl}/documents/${encodeURIComponent(existing.source)}`, { method: 'DELETE' })
      if (!delRes.ok) throw new Error('Failed to remove old version')

      // 2. upload new file
      const form = new FormData()
      form.append('file', f)
      const uploadRes = await fetch(`${apiBaseUrl}/ingest`, { method: 'POST', body: form })
      const data = await uploadRes.json()
      if (!uploadRes.ok) throw new Error(data.detail || 'Upload failed')

      // 3. update version metadata — base off the old document's version so it increments correctly
      const oldVersion = getSourceVersion(existing.source)
      saveSourceMetaAsVersion(f.name, data.chunks, oldVersion)
      localStorage.setItem('lumora-last-upload', String(Date.now()))

      setFileStatus({ ok: true, message: `${getDisplayName(f.name)} updated to v${getSourceVersion(f.name)} — ${data.chunks} chunks` })
      setFile(null)
      fetchKnowledgeSources()
    } catch (err) {
      setFileStatus({ ok: false, message: err.message })
    } finally {
      setUploading(false)
    }
  }

  async function uploadDocument(fileToUpload) {
    const f = fileToUpload || file
    if (!f) return

    if (!fileToUpload) setUploading(true)
    setFileStatus(null)

    const form = new FormData()
    form.append('file', f)

    try {
      const res = await fetch(`${apiBaseUrl}/ingest`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Upload failed')

      saveSourceMeta(f.name, data.chunks)
      localStorage.setItem('lumora-last-upload', String(Date.now()))

      if (!fileToUpload) {
        setFileStatus({ ok: true, message: `${getDisplayName(f.name)} indexed — ${data.chunks} chunks` })
        setFile(null)
      }
      fetchKnowledgeSources()
    } catch (err) {
      if (!fileToUpload) setFileStatus({ ok: false, message: err.message })
    } finally {
      if (!fileToUpload) setUploading(false)
    }
  }

  // Fix 3: refresh icon on a row — check for duplicate by display name
  function handleVersionUpload(selectedFile, existingSource) {
    if (!selectedFile) return
    const displayName = getDisplayName(selectedFile.name)
    const existingMatch = knowledgeSources.find(
      s => getDisplayName(s.source) === displayName && s.type !== 'url'
    )
    if (existingMatch) {
      setDuplicateModal({ file: selectedFile, existing: existingMatch })
    } else {
      uploadDocument(selectedFile)
    }
  }

  async function ingestFromUrl() {
    if (!urlInput.trim()) return
    setIngestingUrl(true)
    setUrlStatus(null)

    try {
      const res = await fetch(`${apiBaseUrl}/ingest-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Ingestion failed')
      setUrlStatus({ ok: true, message: `Indexed ${data.chunks} chunks from URL` })
      setUrlInput('')
      localStorage.setItem('lumora-last-upload', String(Date.now()))
      fetchKnowledgeSources()
    } catch (err) {
      setUrlStatus({ ok: false, message: err.message })
    } finally {
      setIngestingUrl(false)
    }
  }

  async function removeSource(source) {
    if (!window.confirm(`Remove "${getDisplayName(source)}" from the knowledge base?`)) return
    setRemovingSource(source)
    try {
      const res = await fetch(`${apiBaseUrl}/documents/${encodeURIComponent(source)}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Delete failed')
      fetchKnowledgeSources()
    } catch (err) {
      alert(`Error: ${err.message}`)
    } finally {
      setRemovingSource(null)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Knowledge Base</h1>
          <p className={styles.pageSubtitle}>Manage the documents and sources that power Lumora.</p>
        </div>

        <div className={styles.addRow}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <Upload size={16} className={styles.cardIcon} />
              <span className={styles.cardTitle}>Upload Document</span>
            </div>
            <p className={styles.cardDesc}>PDF, DOCX, or TXT. Chunked and embedded automatically.</p>

            {/* Fix 4: styled drop zone with drag-and-drop support */}
            <div
              className={`${styles.dropZone} ${file ? styles.dropZoneActive : ''}`}
              style={{
                pointerEvents: 'all',
                borderColor: dragOver ? '#3fb950' : undefined,
                background: dragOver ? 'rgba(63, 185, 80, 0.1)' : undefined,
                cursor: 'pointer',
              }}
              onClick={() => document.getElementById('kb-file-input').click()}
              onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setDragOver(true) }}
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOver(true) }}
              onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setDragOver(false) }}
              onDrop={e => {
                e.preventDefault()
                e.stopPropagation()
                setDragOver(false)
                const dropped = e.dataTransfer.files[0]
                if (dropped) handleFileSelect(dropped)
              }}
            >
              <input
                id="kb-file-input"
                type="file"
                accept=".pdf,.docx,.txt"
                style={{ display: 'none' }}
                onChange={e => handleFileSelect(e.target.files[0])}
              />
              {file ? (
                <span className={styles.dropZoneFile}>{file.name}</span>
              ) : (
                <>
                  <Upload size={20} className={styles.dropZoneIcon} />
                  <span className={styles.dropZoneText}>Drop PDF, DOCX, or TXT here</span>
                  <span className={styles.dropZoneHint}>or click to browse</span>
                </>
              )}
            </div>

            <button className={styles.actionBtn} onClick={() => uploadDocument()} disabled={!file || uploading}>
              {uploading ? 'Indexing…' : 'Upload & Index'}
            </button>
            {fileStatus && <StatusMessage status={fileStatus} />}
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <Link size={16} className={styles.cardIcon} />
              <span className={styles.cardTitle}>Ingest from URL</span>
            </div>
            <p className={styles.cardDesc}>Works best with static pages. JS-heavy SPAs may return limited content.</p>
            <input
              type="url"
              value={urlInput}
              onChange={e => { setUrlInput(e.target.value); setUrlStatus(null) }}
              placeholder="https://example.com/policy"
              className={styles.urlInput}
            />
            <button className={styles.actionBtn} onClick={ingestFromUrl} disabled={!urlInput.trim() || ingestingUrl}>
              {ingestingUrl ? 'Indexing…' : 'Ingest URL'}
            </button>
            {urlStatus && <StatusMessage status={urlStatus} />}
          </div>
        </div>

        <div className={styles.sourcesSection}>
          <h2 className={styles.sectionTitle}>
            Indexed Sources
            {knowledgeSources.length > 0 && (
              <span className={styles.countBadge}>{knowledgeSources.length}</span>
            )}
          </h2>

          {knowledgeSources.length === 0 ? (
            <div className={styles.emptyState}>
              <Database size={32} className={styles.emptyIcon} />
              <p>No sources indexed yet. Upload a document or ingest a URL to get started.</p>
            </div>
          ) : (
            <div className={styles.sourceGrid}>
              {knowledgeSources.map((source, i) => {
                const displayName = getDisplayName(source.source)
                const version = getSourceVersion(source.source)
                const isUrl = source.type === 'url'

                return (
                  <motion.div
                    key={source.source}
                    className={styles.sourceCard}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div className={styles.sourceIcon}>
                      {isUrl ? <Globe size={16} /> : <FileText size={16} />}
                    </div>
                    <div className={styles.sourceInfo}>
                      <span className={styles.sourceName}>{displayName}</span>
                      {!isUrl && (
                        <span className={styles.sourceRaw}>{source.source}</span>
                      )}
                      <div className={styles.sourceMeta}>
                        <span className={styles.versionBadge}>v{version}</span>
                        <span className={styles.dot} />
                        <span>{source.chunks} chunks</span>
                        <span className={styles.dot} />
                        <span>{source.uploaded_at}</span>
                      </div>
                    </div>

                    <div className={styles.sourceActions}>
                      {!isUrl && (
                        <label className={styles.versionBtn} title="Upload new version">
                          <RefreshCw size={13} />
                          <input
                            type="file"
                            accept=".pdf,.docx,.txt"
                            style={{ display: 'none' }}
                            onChange={e => handleVersionUpload(e.target.files[0], source.source)}
                          />
                        </label>
                      )}
                      <button
                        className={styles.removeBtn}
                        onClick={() => removeSource(source.source)}
                        disabled={removingSource === source.source}
                        title="Remove source"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* Fix 3: duplicate version confirmation modal */}
      {duplicateModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalIcon}>
              <AlertCircle size={20} />
            </div>
            <p className={styles.modalTitle}>Document already exists</p>
            <p className={styles.modalBody}>
              <strong>{getDisplayName(duplicateModal.existing.source)}</strong> already exists
              (v{getSourceVersion(duplicateModal.existing.source)}, indexed on {duplicateModal.existing.uploaded_at}).
              Upload as v{getSourceVersion(duplicateModal.existing.source) + 1} and replace the existing version?
            </p>
            <div className={styles.modalActions}>
              <button className={styles.modalConfirm} onClick={replaceWithNewVersion}>
                Replace with v{getSourceVersion(duplicateModal.existing.source) + 1}
              </button>
              <button className={styles.modalCancel} onClick={() => setDuplicateModal(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusMessage({ status }) {
  return (
    <div className={`${styles.statusMsg} ${status.ok ? styles.statusOk : styles.statusErr}`}>
      {status.ok ? <CheckCircle size={13} /> : <XCircle size={13} />}
      {status.message}
    </div>
  )
}
