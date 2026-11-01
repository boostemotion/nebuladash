/*
 * NebulaDash 代理页回归冒烟：验证三段视图与 Provider 按需加载。
 *
 *   pnpm build && pnpm test:nebula
 *
 * 检查项：
 *   1. 代理页存在三段（策略组 / 节点组 / 代理商），不再是上游的两段；
 *   2. 首屏打开代理页时**不请求** `/providers/proxies`；
 *   3. 切到“代理商”标签后才请求，且只请求一次；
 *   4. Provider 状态徽标在请求后出现。
 *
 * 这三条是 NebulaDash 存在的理由，也是上游同步时最容易被覆盖的地方。
 */
import { parseArgs } from 'node:util'
import { startHarness } from './lib/harness.mjs'
import { sleep, waitFor } from './lib/cdp.mjs'

const { values } = parseArgs({
  options: {
    groups: { type: 'string', default: '40' },
    nodes: { type: 'string', default: '20' },
    url: { type: 'string' },
    headful: { type: 'boolean', default: false },
  },
})

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  ${detail}` : ''}`)
}

const harness = await startHarness({
  groups: Number(values.groups),
  nodes: Number(values.nodes),
  connections: 60,
  appUrl: values.url,
  headless: !values.headful,
})

// 记录所有命中 /providers/proxies 的请求
const REQUEST_LOG = `
  (() => {
    window.__nebulaProviderRequests = []
    const open = XMLHttpRequest.prototype.open
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      try {
        if (String(url).includes('/providers/proxies')) {
          window.__nebulaProviderRequests.push(String(url))
        }
      } catch {}
      return open.call(this, method, url, ...rest)
    }
  })()
`

try {
  const page = await harness.openProxiesPage()

  // 在应用脚本之前注入请求记录钩子，然后重载，确保首屏请求也被记录
  await page.call('Page.addScriptToEvaluateOnNewDocument', { source: REQUEST_LOG })
  await page.reload()
  await waitFor(
    async () => await page.evaluate(`document.querySelectorAll('[role="tab"]').length >= 3`),
    { timeout: 30000, interval: 200 },
  )
  await sleep(1500)

  console.log('\n三段视图')
  const tabs = await page.evaluateJson(`
    JSON.stringify(
      Array.from(document.querySelectorAll('[role="tab"]')).map((el) => el.textContent.trim())
    )
  `)
  check('代理页存在三段标签', tabs.length === 3, tabs.join(' | '))

  const tabTexts = tabs.join(' ')
  check(
    '标签包含策略组 / 节点组 / 代理商',
    /策略组|Strategy/i.test(tabTexts) &&
      /节点组|Node/i.test(tabTexts) &&
      /代理提供商|Proxy provider/i.test(tabTexts),
    tabTexts,
  )

  console.log('\nProvider 按需加载')
  const requestsBefore = await page.evaluateJson(
    `JSON.stringify(window.__nebulaProviderRequests ?? [])`,
  )
  check('首屏未请求 /providers/proxies', requestsBefore.length === 0, `实际 ${requestsBefore.length} 次`)

  const groupsRendered = await page.evaluate(
    `document.querySelectorAll('[data-proxy-page-item]').length`,
  )
  check('策略组标签已有卡片', Number(groupsRendered) > 0, `${groupsRendered} 张`)

  // 切到“代理商”
  const clicked = await page.evaluate(`
    (() => {
      const tab = Array.from(document.querySelectorAll('[role="tab"]')).find((el) =>
        /代理提供商|Proxy provider/i.test(el.textContent),
      )
      if (!tab) return false
      tab.click()
      return true
    })()
  `)
  check('可以点击“代理商”标签', clicked === true)

  const requested = await waitFor(
    async () =>
      (await page.evaluateJson(`JSON.stringify(window.__nebulaProviderRequests ?? [])`)).length > 0,
    { timeout: 15000, interval: 200 },
  )
  check('切到“代理商”后请求 /providers/proxies', requested !== null)

  await sleep(1200)
  const requestsAfter = await page.evaluateJson(
    `JSON.stringify(window.__nebulaProviderRequests ?? [])`,
  )
  check('Provider 请求被去重（只请求一次）', requestsAfter.length === 1, `实际 ${requestsAfter.length} 次`)

  const providersRendered = await page.evaluate(
    `document.querySelectorAll('[data-proxy-page-item]').length`,
  )
  check('Provider 标签已渲染列表', Number(providersRendered) > 0, `${providersRendered} 项`)

  const statusBadge = await page.evaluate(`
    (() => {
      const badge = Array.from(document.querySelectorAll('.badge')).find((el) =>
        /缓存|旧缓存|刚更新|超时|失败|Cached|Old cache|Fresh|timeout|error/.test(el.textContent),
      )
      return badge ? badge.textContent.trim() : ''
    })()
  `)
  check('显示 Provider 状态徽标', Boolean(statusBadge), statusBadge)

  await page.close()
} finally {
  await harness.close()
}

const failed = results.filter((item) => !item.ok)

console.log(`\n${results.length - failed.length}/${results.length} 通过`)

if (failed.length) {
  for (const item of failed) console.log(`  ✗ ${item.name}`)
  process.exitCode = 1
}
