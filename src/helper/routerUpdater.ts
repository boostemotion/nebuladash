export type RouterUpdaterAction = 'status' | 'update' | 'rollback'
export type RouterUpdaterStatus = 'idle' | 'updating' | 'ok' | 'error'

export type RouterUpdaterResponse = {
  ok: boolean
  status: RouterUpdaterStatus
  active?: 'a' | 'b'
  version?: string
  message?: string
  updatedAt?: string
}

const VALID_STATUSES: RouterUpdaterStatus[] = ['idle', 'updating', 'ok', 'error']

export const buildRouterUpdaterUrl = (
  endpoint: string,
  action: RouterUpdaterAction,
  token?: string,
) => {
  const url = new URL(endpoint.replace(/\/+$/, ''))
  url.searchParams.set('action', action)
  if (token) {
    url.searchParams.set('token', token)
  }
  return url.toString()
}

export const buildRouterUpdaterHeaders = (token: string) => ({
  'X-NebulaDash-Token': token,
})

export const getDefaultRouterUpdaterEndpoint = (href: string) => {
  const url = new URL(href)
  url.port = ''
  url.pathname = '/cgi-bin/nebuladash-updater'
  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}

export const parseRouterUpdaterResponse = (value: unknown): RouterUpdaterResponse => {
  if (typeof value !== 'object' || value === null) {
    return { ok: false, status: 'error', message: 'Invalid updater response' }
  }

  const candidate = value as Partial<RouterUpdaterResponse>
  if (
    typeof candidate.ok !== 'boolean' ||
    !VALID_STATUSES.includes(candidate.status as RouterUpdaterStatus)
  ) {
    return { ok: false, status: 'error', message: 'Invalid updater response' }
  }

  return {
    ok: candidate.ok,
    status: candidate.status as RouterUpdaterStatus,
    active: candidate.active === 'a' || candidate.active === 'b' ? candidate.active : undefined,
    version: typeof candidate.version === 'string' ? candidate.version : undefined,
    message: typeof candidate.message === 'string' ? candidate.message : undefined,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : undefined,
  }
}
