import { activeBackend } from '@/store/setup'
import { watch } from 'vue'
import { can } from './backend'
import { fetchConfigs } from './config'
import { initConnections, stopConnections } from './connections'
import { fetchDaeRuntime } from './dae'
import { driver } from './driver'
import { initLogs, stopLogs } from './logs'
import { initSatistic, stopSatistic } from './overview'
import {
  hydrateProxiesFromCache,
  invalidateProxyProviders,
  refreshProxyData,
  resetProxyState,
} from './proxies'
import { fetchRules } from './rules'
import { probeActiveBackend } from './version'

const EVENT_DEBOUNCE = 400

let events: { close: () => void } | undefined
let refreshTimer: ReturnType<typeof setTimeout> | undefined

const scheduleRefresh = () => {
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    // 代际变化通常意味着配置重载：Provider 列表可能变了，先让标记失效，
    // 再用统一入口刷新（代理 + Provider）。
    invalidateProxyProviders()
    refreshProxyData().catch(() => {})
    fetchRules().catch(() => {})
    fetchConfigs().catch(() => {})
  }, EVENT_DEBOUNCE)
}

const stopEvents = () => {
  clearTimeout(refreshTimer)
  refreshTimer = undefined
  events?.close()
  events = undefined
}

const initEvents = () => {
  stopEvents()

  const subscribe = driver().events?.subscribe

  if (!subscribe || !can('backendEvents')) return

  events = subscribe((kind) => {
    if (kind === 'generation.changed') scheduleRefresh()
  })
}

export const startBackendSession = async () => {
  stopConnections()
  stopLogs()
  stopSatistic()
  stopEvents()
  driver().reset?.()

  // NebulaDash: 先重置内存状态，再用当前后端 UUID 的缓存起屏，最后后台刷新。
  resetProxyState()
  hydrateProxiesFromCache()

  if (!activeBackend.value) {
    probeActiveBackend()
    return
  }

  await probeActiveBackend().catch(() => {})

  fetchConfigs()
  // 后端会话建立时也走统一入口：Provider 数据按需加载，这里不会额外拉取。
  refreshProxyData()
  fetchRules()
  initConnections()
  initLogs()
  initSatistic()
  initEvents()

  if (activeBackend.value.type === 'dae') {
    fetchDaeRuntime().catch(() => {})
  }
}

watch(activeBackend, startBackendSession, { immediate: true })
