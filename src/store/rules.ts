import { fetchRuleProvidersAPI, fetchRulesAPI } from '@/api'
import { RULE_TAB_TYPE } from '@/constant'
import { getSearchTermVariants, matchesSearchTerm, splitSearchTerms } from '@/helper/search'
import { getProxyGroupChains } from '@/store/proxies'
import type { Rule, RuleProvider } from '@/types'
import { computed, ref } from 'vue'

export const rulesFilter = ref('')
export const rulesTabShow = ref(RULE_TAB_TYPE.RULES)

export const rules = ref<Rule[]>([])
export const ruleProviderList = ref<RuleProvider[]>([])

export const renderRules = computed(() => {
  const rulesFilterValue = splitSearchTerms(rulesFilter.value)

  if (rulesFilterValue.length === 0) {
    return rules.value
  }

  return rules.value.filter((rule) => {
    const searchCandidates = [
      rule.type,
      rule.payload,
      rule.proxy,
      ...getProxyGroupChains(rule.proxy),
    ]

    return rulesFilterValue.every((term) => {
      const variants = getSearchTermVariants(term)

      return variants.some((variant) =>
        searchCandidates.some((candidate) => matchesSearchTerm(candidate ?? '', variant)),
      )
    })
  })
})

export const renderRulesProvider = computed(() => {
  const rulesFilterValue = splitSearchTerms(rulesFilter.value)

  if (rulesFilterValue.length === 0) {
    return ruleProviderList.value
  }

  return ruleProviderList.value.filter((ruleProvider) => {
    const searchCandidates = [ruleProvider.name, ruleProvider.behavior, ruleProvider.vehicleType]

    return rulesFilterValue.every((term) => {
      const variants = getSearchTermVariants(term)

      return variants.some((variant) =>
        searchCandidates.some((candidate) => matchesSearchTerm(candidate ?? '', variant)),
      )
    })
  })
})

export const fetchRules = async () => {
  const { data: ruleData } = await fetchRulesAPI()
  const { data: providerData } = await fetchRuleProvidersAPI()

  rules.value = ruleData.rules.map((rule) => {
    const proxy = rule.proxy
    const proxyName = proxy.startsWith('route(') ? proxy.substring(6, proxy.length - 1) : proxy

    return {
      ...rule,
      proxy: proxyName,
    }
  })
  ruleProviderList.value = Object.values(providerData.providers)
}
