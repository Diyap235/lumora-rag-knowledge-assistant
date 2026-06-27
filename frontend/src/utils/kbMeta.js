// shared helpers for KB metadata — used by KBManager and AssistantMessage

const META_KEY = 'lumora_kb_meta'

export function getDisplayName(raw) {
  if (!raw || raw.startsWith('http')) return raw
  return raw
    .replace(/\.[^.]+$/, '')
    .replace(/\s*\(\d+\)\s*/g, ' ')
    .replace(/_random/gi, '')
    .replace(/_compressed/gi, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase())
}

export function getSourceVersion(raw) {
  try {
    const meta = JSON.parse(localStorage.getItem(META_KEY) || '{}')
    return meta[raw]?.version || 1
  } catch {
    return 1
  }
}

export function saveSourceMeta(raw, chunks) {
  try {
    const meta = JSON.parse(localStorage.getItem(META_KEY) || '{}')
    const current = meta[raw]?.version || 0
    meta[raw] = {
      display_name: getDisplayName(raw),
      raw_filename: raw,
      version: current + 1,
      chunks,
      uploaded_at: new Date().toLocaleString(),
    }
    localStorage.setItem(META_KEY, JSON.stringify(meta))
  } catch {
    // localStorage unavailable
  }
}

// used when replacing an existing document — forces version to baseVersion + 1
export function saveSourceMetaAsVersion(raw, chunks, baseVersion) {
  try {
    const meta = JSON.parse(localStorage.getItem(META_KEY) || '{}')
    meta[raw] = {
      display_name: getDisplayName(raw),
      raw_filename: raw,
      version: baseVersion + 1,
      chunks,
      uploaded_at: new Date().toLocaleString(),
    }
    localStorage.setItem(META_KEY, JSON.stringify(meta))
  } catch {
    // localStorage unavailable
  }
}
