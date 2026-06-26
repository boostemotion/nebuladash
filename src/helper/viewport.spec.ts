import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getAppViewportHeight,
  shouldPreventVerticalOverscroll,
  shouldRestoreProxyScroll,
} from './viewport.ts'

test('uses the visual viewport height when available', () => {
  assert.equal(getAppViewportHeight(640.4, 800), 640)
  assert.equal(getAppViewportHeight(undefined, 800), 800)
})

test('restores proxy scroll only when the element is ready or the wait timed out', () => {
  assert.equal(shouldRestoreProxyScroll(null, 120, false), false)
  assert.equal(shouldRestoreProxyScroll(100, 120, false), false)
  assert.equal(shouldRestoreProxyScroll(121, 120, false), true)
  assert.equal(shouldRestoreProxyScroll(null, 120, true), true)
})

test('prevents vertical overscroll at scroll boundaries', () => {
  assert.equal(
    shouldPreventVerticalOverscroll({
      deltaX: 0,
      deltaY: 20,
      scrollTop: 0,
      clientHeight: 300,
      scrollHeight: 900,
    }),
    true,
  )
  assert.equal(
    shouldPreventVerticalOverscroll({
      deltaX: 0,
      deltaY: -20,
      scrollTop: 600,
      clientHeight: 300,
      scrollHeight: 900,
    }),
    true,
  )
  assert.equal(
    shouldPreventVerticalOverscroll({
      deltaX: 0,
      deltaY: -20,
      scrollTop: 200,
      clientHeight: 300,
      scrollHeight: 900,
    }),
    false,
  )
  assert.equal(
    shouldPreventVerticalOverscroll({
      deltaX: 20,
      deltaY: 10,
      scrollTop: 0,
      clientHeight: 300,
      scrollHeight: 900,
    }),
    false,
  )
})
