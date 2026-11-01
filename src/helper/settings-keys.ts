/**
 * NebulaDash: 导入/同步设置时忽略的历史无效键。
 *
 * 这些键来自更早的面板版本（含原版 Zashboard 2.x），写入后再也读不到，
 * 只会污染 localStorage，并在后续导出里继续传播。
 */
export const DEPRECATED_SETTINGS_KEYS = new Set([
  'config/icon-size',
  'config/icon-margin-right',
  'config/use-large-proxy-group-icon',
  'config/singbox-channel',
  'config/use-singbox',
])

export const isDeprecatedSettingsKey = (key: string) => DEPRECATED_SETTINGS_KEYS.has(key)
