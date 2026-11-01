/*
 * NebulaDash 代理页 / 搜索回归冒烟。
 *
 *   pnpm build && pnpm test:nebula
 *
 * 检查项：
 *   1. 代理页三段（策略组 / 节点组 / 代理商），不再是上游的两段；
 *   2. 首屏打开代理页时**不请求** `/providers/proxies`；
 *   3. 切到“代理商”标签后才请求，且只请求一次；状态徽标出现；
 *   4. 搜索 `google.com` 能通过“规则 -> 代理组”反向映射显示对应策略组；
 *   5. 规则页搜索下游节点名能筛出上游规则（链路感知）。
 *
 * 这几条是 NebulaDash 的核心差异化能力，也是上游同步时最容易被覆盖的地方。
 */
import { parseArgs } from 'node:util'
import { sleep, waitFor } from './lib/cdp.mjs'
import { startHarness } from './lib/harness.mjs'

const { values } = parseArgs({
  options: {
    groups: { type: 'string', default: '40' },
    nodes: { type: 'string', default: '20' },
    url: { type: 'string' },
    lang: { type: 'string' },
    headful: { type: 'boolean', default: false },
  },
})

const GROUPS = Number(values.groups)
const NODES = Number(values.nodes)

// 一条指向 Group-002 的规则：用来验证“域名 -> 规则 -> 代理组”反向映射，
// 以及规则页搜索下游节点名（Group-002 的当前节点是 Node-002）时的链路感知。
const RULES = [
  { type: 'DomainSuffix', payload: 'google.com', proxy: 'Group-002' },
  { type: 'DomainSuffix', payload: 'github.com', proxy: 'Group-003' },
]
const RULE_GROUP = 'Group-002'
const RULE_DOWNSTREAM_NODE = 'Node-002'

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  ${detail}` : ''}`)
}
const section = (title) => console.log(`\n${title}`)

const harness = await startHarness({
  groups: GROUPS,
  nodes: NODES,
  connections: 60,
  rules: RULES,
  appUrl: values.url,
  headless: !values.headful,
})

// 可选：固定界面语言，便于在本地复现 CI（默认英文）下的断言。
const languageSettings = values.lang ? { 'config/language': values.lang } : {}

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

/**
 * 往搜索框里输入。
 * 优先用稳定锚点 `[data-proxy-search] input`，避免依赖会随界面语言变化的 placeholder。
 */
const typeIntoSearch = async (page, placeholderPattern, text) => {
  return await page.evaluate(`
    (() => {
      const input =
        document.querySelector('[data-proxy-search] input') ||
        Array.from(document.querySelectorAll('input[type="text"]')).find((el) =>
          ${placeholderPattern}.test(el.placeholder || ''),
        )
      if (!input) return false
      input.focus()
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      ).set
      setter.call(input, ${JSON.stringify(text)})
      input.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    })()
  `)
}

const renderedItems = (page) =>
  page.evaluate(`document.querySelectorAll('[data-proxy-page-item]').length`)

const renderedItemNames = async (page) =>
  page.evaluateJson(`
    JSON.stringify(
      Array.from(document.querySelectorAll('[data-proxy-page-item]')).map((el) =>
        el.getAttribute('data-proxy-page-item'),
      ),
    )
  `)

try {
  const page = await harness.openProxiesPage({ settings: languageSettings })

  // 在应用脚本之前注入请求记录钩子，然后重载，确保首屏请求也被记录
  await page.call('Page.addScriptToEvaluateOnNewDocument', { source: REQUEST_LOG })
  await page.reload()
  await waitFor(
    async () => await page.evaluate(`document.querySelectorAll('[role="tab"]').length >= 3`),
    { timeout: 30000, interval: 200 },
  )
  await sleep(1500)

  section('三段视图')
  const tabs = await page.evaluateJson(`
    JSON.stringify(
      Array.from(document.querySelectorAll('[role="tab"]')).map((el) => el.textContent.trim())
    )
  `)
  check('代理页存在三段标签', tabs.length === 3, tabs.join(' | '))

  const tabTexts = tabs.join(' ')
  check(
    '标签包含策略组 / 节点组 / 代理商',
    /策略组|strategy/i.test(tabTexts) &&
      /节点组|Node/i.test(tabTexts) &&
      /代理提供商|proxy provider/i.test(tabTexts),
    tabTexts,
  )

  section('Provider 按需加载')
  const requestsBefore = await page.evaluateJson(
    `JSON.stringify(window.__nebulaProviderRequests ?? [])`,
  )
  check(
    '首屏未请求 /providers/proxies',
    requestsBefore.length === 0,
    `实际 ${requestsBefore.length} 次`,
  )

  check('策略组标签已有卡片', (await renderedItems(page)) > 0, `${await renderedItems(page)} 张`)

  const clicked = await page.evaluate(`
    (() => {
      const tab = Array.from(document.querySelectorAll('[role="tab"]')).find((el) =>
        /代理提供商|proxy provider/i.test(el.textContent),
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
  check(
    'Provider 请求被去重（只请求一次）',
    requestsAfter.length === 1,
    `实际 ${requestsAfter.length} 次`,
  )
  check(
    'Provider 标签已渲染列表',
    (await renderedItems(page)) > 0,
    `${await renderedItems(page)} 项`,
  )

  const statusBadge = await page.evaluate(`
    (() => {
      const badge = Array.from(document.querySelectorAll('.badge')).find((el) =>
        /缓存|旧缓存|刚更新|超时|失败|Cached|Old cache|Fresh|timeout|error/.test(el.textContent),
      )
      return badge ? badge.textContent.trim() : ''
    })()
  `)
  check('显示 Provider 状态徽标', Boolean(statusBadge), statusBadge)

  section('搜索：域名 -> 规则 -> 代理组反向映射')
  await page.evaluate(`
    (() => {
      const tab = Array.from(document.querySelectorAll('[role="tab"]')).find((el) =>
        /策略组|strategy/i.test(el.textContent),
      )
      tab?.click()
    })()
  `)
  await sleep(600)

  const typedProxy = await typeIntoSearch(page, /searchProxyGroup|search|搜索/i, 'google.com')
  check('代理页搜索框可输入', typedProxy === true)

  const linkedVisible = await waitFor(
    async () => (await renderedItemNames(page)).includes(RULE_GROUP),
    { timeout: 10000, interval: 200 },
  )
  check(
    '搜索 google.com 能显示规则指向的策略组',
    linkedVisible !== null,
    (await renderedItemNames(page)).join(', '),
  )

  const unrelatedHidden = !(await renderedItemNames(page)).includes('Group-009')
  check('无关组被过滤掉', unrelatedHidden, (await renderedItemNames(page)).join(', '))

  // 清空搜索后再检查角色拆分：拆分基于“过滤后的代理组”，搜索态下只看命中项。
  await typeIntoSearch(page, /searchProxyGroup|search|搜索/i, '')
  await sleep(800)

  section('角色拆分（有规则时按规则目标判定）')
  const splitTabs = await page.evaluateJson(`
    JSON.stringify(
      Array.from(document.querySelectorAll('[role="tab"]')).map((el) => el.textContent.trim())
    )
  `)
  const nodeTabCount = (() => {
    const match = splitTabs.find((text) => /节点组|Node/i.test(text))
    const parsed = match?.match(/(\d+)/)
    return parsed ? Number(parsed[1]) : -1
  })()
  check('规则就绪后出现节点组', nodeTabCount > 0, `节点组 ${nodeTabCount}`)

  section('规则直通：链路弹窗与代理商标尾')
  await page.evaluate(`
    (() => {
      const tab = Array.from(document.querySelectorAll('[role="tab"]')).find((el) =>
        /策略组|strategy/i.test(el.textContent),
      )
      tab?.click()
    })()
  `)
  await sleep(800)

  const openedChain = await page.evaluate(`
    (() => {
      const card = document.querySelector('[data-proxy-page-item="${RULE_GROUP}"]')
      if (!card) return false
      // 策略组卡片头部的“规则直通”按钮
      const button = card.querySelector('[data-proxy-rule-shortcut]')
      if (!button) return false
      button.click()
      return true
    })()
  `)
  await sleep(1200)
  const dialogOpen = await page.evaluate(`
    (() => {
      const box = document.querySelector('.modal.modal-open .modal-box')
      const text = box ? box.innerText : ''
      return text.includes('跳转规则') || text.includes('Go to rules')
    })()
  `)
  check(
    '可以打开链路弹窗',
    openedChain === true && dialogOpen === true,
    `opened=${openedChain} dialog=${dialogOpen}`,
  )

  const chainText = await page.evaluate(`
    (() => {
      const box = document.querySelector('.modal.modal-open .modal-box')
      return box ? box.innerText : ''
    })()
  `)
  check(
    '链路末尾显示所属代理商',
    /代理提供商|Proxy provider/.test(chainText),
    JSON.stringify(String(chainText).slice(0, 160)),
  )
  check('弹窗内提供“跳转规则”', /跳转规则|go to rules/i.test(chainText))

  section('规则页：链路感知搜索')
  await page.goto(`${await page.evaluate('location.origin')}/#/rules`)
  await sleep(1500)

  const typedRules = await typeIntoSearch(page, /search|搜索/i, RULE_DOWNSTREAM_NODE)
  check('规则页搜索框可输入', typedRules === true)

  const ruleVisible = await waitFor(
    async () =>
      await page.evaluate(`
        (() => {
          const text = document.body.innerText
          return text.includes('${RULE_DOWNSTREAM_NODE}') || text.includes('${RULE_GROUP}')
        })()
      `),
    { timeout: 10000, interval: 200 },
  )
  check('搜索下游节点名能筛出上游规则', ruleVisible !== null, `搜索词 ${RULE_DOWNSTREAM_NODE}`)

  section('设置页：更新源保护与路由器更新器')
  await page.goto(`${await page.evaluate('location.origin')}/#/settings?section=generalSettings`)
  await sleep(2000)

  const settingsText = await page.evaluate('document.body.innerText')
  // 区块标题在英文下会被 CSS uppercase 成 "ROUTER UPDATER"，
  // 因此优先用稳定锚点，文本断言一律大小写不敏感。
  const hasUpdaterSection = await page.evaluate(
    `Boolean(document.querySelector('[data-router-updater-section]'))`,
  )
  check(
    '显示路由器更新器区块',
    hasUpdaterSection || /路由器更新器|router updater/i.test(settingsText),
    '区块标题',
  )
  check(
    '显示更新器地址与密钥',
    /更新器地址|updater endpoint/i.test(settingsText) &&
      /更新器密钥|updater token/i.test(settingsText),
  )
  check(
    '后端下载地址非 NebulaDash 时给出禁用提示',
    /未指向 NebulaDash|does not point to a nebuladash/i.test(settingsText),
  )
  check(
    '禁用提示包含要求的 Release 地址',
    settingsText.includes('github.com/boostemotion/nebuladash/releases/latest/download/dist.zip'),
  )

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
