import type { Config } from '@/types'

export const NEBULADASH_RELEASE_DOWNLOAD_URL =
  'https://github.com/boostemotion/nebuladash/releases/latest/download/dist.zip'

const NEBULADASH_RELEASE_PATH_PREFIX = '/boostemotion/nebuladash/releases/'

type UiDownloadConfig = Partial<Pick<Config, 'external-ui-download-url' | 'external-ui-url'>>

export const getExternalUiDownloadUrl = (config?: UiDownloadConfig): string => {
  const url = config?.['external-ui-download-url'] ?? config?.['external-ui-url']

  return typeof url === 'string' ? url.trim() : ''
}

export const isNebulaDashUiDownloadUrl = (value: string): boolean => {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return false

  try {
    const url = new URL(normalized)

    return (
      url.hostname === 'github.com' &&
      url.pathname.startsWith(NEBULADASH_RELEASE_PATH_PREFIX) &&
      url.pathname.endsWith('.zip')
    )
  } catch {
    return false
  }
}

export const canUpgradeNebulaDashFromConfig = (config?: UiDownloadConfig): boolean => {
  return isNebulaDashUiDownloadUrl(getExternalUiDownloadUrl(config))
}
