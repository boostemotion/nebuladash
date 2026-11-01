import { getNowProxyNodeName, getProxyGroupChains } from '@/assembly/proxies'
import { ruleProviderList, rules } from '@/assembly/rules'
import { RULE_TAB_TYPE } from '@/constant'
import { toSmartSearchMatcher } from '@/helper/search'
import { computed, ref, watch } from 'vue'
import { activeBackend } from './setup'

export const rulesFilter = ref('')
export const rulesTabShow = ref(RULE_TAB_TYPE.RULES)

watch(activeBackend, (backend) => {
  if (backend) rulesTabShow.value = RULE_TAB_TYPE.RULES
})

/**
 * NebulaDash: 规则搜索支持链路感知。
 *
 * 除了 `type / payload / proxy` 本身，还会匹配规则代理组的**下游链路组名**与
 * **最终出口节点名**，因此搜索 `香港-故转` / `香港-自动` / 具体节点名，都能筛出
 * 上游的 `ChatGPT`、`Gemini` 等规则。
 */
const getRuleSearchCandidates = (rule: (typeof rules.value)[number]) => {
  const chains = getProxyGroupChains(rule.proxy)
  const finalNode = getNowProxyNodeName(rule.proxy)
  const candidates = [rule.type, rule.payload, rule.proxy, ...chains]

  if (finalNode && !candidates.includes(finalNode)) {
    candidates.push(finalNode)
  }

  return candidates
}
export const renderRules = computed(() => {
  const searchMatcher = toSmartSearchMatcher(rulesFilter.value)

  if (!searchMatcher) {
    return rules.value
  }

  return rules.value.filter((rule) => searchMatcher.testAny(getRuleSearchCandidates(rule)))
})

export const renderRulesProvider = computed(() => {
  const searchMatcher = toSmartSearchMatcher(rulesFilter.value)

  if (!searchMatcher) {
    return ruleProviderList.value
  }

  return ruleProviderList.value.filter((ruleProvider) => {
    return searchMatcher.testAny([
      ruleProvider.name,
      ruleProvider.behavior,
      ruleProvider.vehicleType,
    ])
  })
})
