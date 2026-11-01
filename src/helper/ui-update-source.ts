import type { Config } from '@/types'

/**
 * NebulaDash 更新源保护。
 *
 * OpenClash 的 `external-ui-download-url` 指向官方 Zashboard 时，面板内“更新面板”
 * 会把 NebulaDash 覆盖成官方版。因此只有下载地址指向 NebulaDash Release ZIP 时，
 * 才允许触发面板更新。
 */
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
