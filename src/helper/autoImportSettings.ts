import { showNotification } from '@/helper/notification'
import { useStorage } from '@vueuse/core'
const IMPORT_SETTINGS_URL_KEY = 'config/import-settings-url'
const DEPRECATED_IMPORT_KEYS = new Set([
  'config/icon-size',
  'config/icon-margin-right',
  'config/use-large-proxy-group-icon',
])

export const DEFAULT_SETTINGS_URL = './zashboard-settings.json'
export const importSettingsUrl = useStorage(IMPORT_SETTINGS_URL_KEY, DEFAULT_SETTINGS_URL)
export const autoImportSettings = useStorage('config/auto-import-settings', false)

const autoImportSettingsHash = useStorage('cache/auto-import-settings-hash', '')
const isImportKeyAllowed = (key: string) => {
  if (DEPRECATED_IMPORT_KEYS.has(key)) {
    return false
  }

  return key === IMPORT_SETTINGS_URL_KEY || localStorage.getItem(key) !== null
}

export const applyImportedSettings = (settings: Record<string, unknown>) => {
  for (const key in settings) {
    if (!isImportKeyAllowed(key)) {
      continue
    }

    if (key === IMPORT_SETTINGS_URL_KEY && !settings[key]) {
      continue
    }

    localStorage.setItem(key, String(settings[key]))
  }
}

const calculateSettingsHash = async (settings: Record<string, unknown>) => {
  const sortedKeys = Object.keys(settings).sort()
  const hashString = sortedKeys.map((key) => `${key}:${settings[key]}`).join('|')

  let hash = 0
  for (let i = 0; i < hashString.length; i++) {
    const char = hashString.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}
export const importSettingsFromUrl = async (force = false) => {
  const res = await fetch(importSettingsUrl.value)
  const errorHandler = () => {
    showNotification({
      content: 'importFailed',
      params: { url: res.url },
      type: 'alert-error',
    })
  }
  if (!res.ok) {
    errorHandler()
    return
  }
  let settings: Record<string, unknown> = {}
  try {
    settings = await res.json()
  } catch {
    errorHandler()
    return
  }

  if (!settings) {
    errorHandler()
    return
  }

  const newHash = await calculateSettingsHash(settings)

  if (newHash === autoImportSettingsHash.value && !force) {
    return
  }

  showNotification({
    content: 'importing',
  })
  autoImportSettingsHash.value = newHash

  applyImportedSettings(settings)
  location.reload()
}
