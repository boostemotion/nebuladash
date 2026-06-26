import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildRouterUpdaterHeaders,
  buildRouterUpdaterUrl,
  parseRouterUpdaterResponse,
} from './routerUpdater.ts'

test('builds updater action URLs without duplicating slashes', () => {
  assert.equal(
    buildRouterUpdaterUrl('http://192.168.6.1/cgi-bin/nebuladash-updater/', 'status'),
    'http://192.168.6.1/cgi-bin/nebuladash-updater?action=status',
  )
})

test('sends the updater token in a fixed header', () => {
  assert.deepEqual(buildRouterUpdaterHeaders('secret-token'), {
    'X-NebulaDash-Token': 'secret-token',
  })
})

test('parses valid updater responses', () => {
  assert.deepEqual(
    parseRouterUpdaterResponse({
      ok: true,
      status: 'ok',
      active: 'b',
      version: '2.8.0-nebula.2',
      message: 'updated',
      updatedAt: '2026-06-26T09:00:00Z',
    }),
    {
      ok: true,
      status: 'ok',
      active: 'b',
      version: '2.8.0-nebula.2',
      message: 'updated',
      updatedAt: '2026-06-26T09:00:00Z',
    },
  )
})

test('normalizes malformed updater responses into an error response', () => {
  assert.deepEqual(parseRouterUpdaterResponse({ ok: true, status: 'broken' }), {
    ok: false,
    status: 'error',
    message: 'Invalid updater response',
  })
})
