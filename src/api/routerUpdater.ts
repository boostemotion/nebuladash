import {
  buildRouterUpdaterHeaders,
  buildRouterUpdaterUrl,
  parseRouterUpdaterResponse,
  type RouterUpdaterAction,
} from '@/helper/routerUpdater'

const callRouterUpdater = async (endpoint: string, token: string, action: RouterUpdaterAction) => {
  const response = await fetch(buildRouterUpdaterUrl(endpoint, action, token), {
    method: action === 'status' ? 'GET' : 'POST',
    headers: buildRouterUpdaterHeaders(token),
  })
  const payload = await response.json().catch(() => null)
  const parsed = parseRouterUpdaterResponse(payload)

  if (!response.ok || !parsed.ok) {
    throw new Error(parsed.message || `Router updater ${action} failed`)
  }

  return parsed
}

export const fetchRouterUpdaterStatus = (endpoint: string, token: string) => {
  return callRouterUpdater(endpoint, token, 'status')
}

export const runRouterUpdaterAction = (
  endpoint: string,
  token: string,
  action: Exclude<RouterUpdaterAction, 'status'>,
) => {
  return callRouterUpdater(endpoint, token, action)
}
