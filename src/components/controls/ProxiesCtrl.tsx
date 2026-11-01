import { can } from '@/assembly/backend'
import { configs, updateConfigs } from '@/assembly/config'
import {
  allProxiesLatencyTest,
  fetchProxies,
  fetchProxyProviders,
  hasSmartGroup,
  proxyProviderLastUpdatedAt,
  proxyProviderLoadStatus,
  proxyProviderRequestDurationMs,
  proxyProviederList,
  updateProxyProvider,
} from '@/assembly/proxies'
import { useCtrlsBar } from '@/composables/use-ctrls-bar'
import { PROXY_SORT_TYPE, PROXY_TAB_TYPE, ROUTE_NAME, SETTINGS_MENU_KEY } from '@/constant'
import { proxyGroupRoleSplit, renderProxiesPageItems } from '@/helper/proxies'
import { isProxyNodeSearchMode, toggleProxySearchMode } from '@/helper/proxy-search'
import { getMinCardWidth } from '@/helper/utils'
import { proxiesFilter, proxiesTabShow } from '@/store/proxies'
import { isProxyFolderModeActive } from '@/store/proxy-folders'
import {
  automaticDisconnection,
  collapseGroupMap,
  disableProxiesPageTextSelect,
  displayFinalOutbound,
  groupProxiesByProvider,
  hideUnavailableProxies,
  manageHiddenGroup,
  minProxyCardWidth,
  nodeClusterVariants,
  proxyCardSize,
  proxySortType,
  twoColumnProxyGroup,
  useSmartGroupSort,
} from '@/store/settings'
import {
  ArrowPathIcon,
  BoltIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  GlobeAltIcon,
  RectangleGroupIcon,
  RectangleStackIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/vue/24/outline'
import { every } from 'lodash'
import { computed, defineComponent, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import CtrlsBar from '../common/CtrlsBar.vue'
import DialogWrapper from '../common/DialogWrapper.vue'
import SegmentedControl from '../common/SegmentedControl.vue'
import SelectInput from '../common/SelectInput.vue'
import TextInput from '../common/TextInput.vue'
import DaeEntryModal from '../proxies/DaeEntryModal.vue'

export default defineComponent({
  name: 'ProxiesCtrl',
  setup() {
    const { t } = useI18n()
    const router = useRouter()
    const isUpgrading = ref(false)
    const isAllLatencyTesting = ref(false)
    const settingsModel = ref(false)
    const entryManagerModel = ref(false)
    const { isLargeCtrlsBar } = useCtrlsBar()
    const handlerClickUpdateAllProviders = async () => {
      if (isUpgrading.value) return
      isUpgrading.value = true
      try {
        await Promise.all(
          proxyProviederList.value.map((provider) => updateProxyProvider(provider.name)),
        )
        await fetchProxies()
        isUpgrading.value = false
      } catch {
        await fetchProxies()
        isUpgrading.value = false
      }
    }

    const hasProviders = computed(() => {
      // NebulaDash: Provider 是按需加载的，未加载时列表为空，
      // 不能让“数量为 0”把分段控件藏起来。
      return proxyProviederList.value.length > 0 || can('proxyProviderUpdate')
    })

    const foldersUiVisible = computed(
      () => isProxyFolderModeActive.value && proxiesTabShow.value !== PROXY_TAB_TYPE.PROVIDER,
    )

    const defaultModes = ['direct', 'rule', 'global']
    const modeList = computed(() => {
      return configs.value?.['mode-list'] || configs.value?.['modes'] || defaultModes
    })
    const needTranslateModes = computed(() => {
      return every(modeList.value, (mode) => defaultModes.includes(mode.toLowerCase()))
    })

    const handlerModeChange = (mode: string) => {
      updateConfigs({ mode })
    }

    const handlerClickLatencyTestAll = async () => {
      if (isAllLatencyTesting.value) return
      isAllLatencyTesting.value = true
      try {
        await allProxiesLatencyTest()
        isAllLatencyTesting.value = false
      } catch {
        isAllLatencyTesting.value = false
      }
    }

    const hasNotCollapsed = computed(() => {
      return renderProxiesPageItems.value.some((name) => collapseGroupMap.value[name])
    })

    const handlerClickToggleCollapse = () => {
      collapseGroupMap.value = Object.fromEntries(
        renderProxiesPageItems.value.map((name) => [name, !hasNotCollapsed.value]),
      )
    }

    const handlerResetProxyCardWidth = () => {
      minProxyCardWidth.value = getMinCardWidth(proxyCardSize.value)
    }

    // “按提供商分组”依赖节点上的 provider-name，只有启用了才需要 Provider 数据。
    watch(
      groupProxiesByProvider,
      (enabled) => {
        if (enabled) void fetchProxyProviders()
      },
      { immediate: true },
    )

    /**
     * NebulaDash: 只有切到“代理商”标签时才请求 `/providers/proxies`。
     * 策略组/节点组首屏不得等待该接口。
     */
    const handlerTabChange = (value: string) => {
      proxiesTabShow.value = value as PROXY_TAB_TYPE

      if (value === PROXY_TAB_TYPE.PROVIDER) {
        void fetchProxyProviders()
      }
    }

    // NebulaDash: 节点组聚类词表（每行一个正则片段，顺序即簇内优先级）。
    const nodeClusterVariantsText = computed({
      get: () => nodeClusterVariants.value.join('\n'),
      set: (value: string) => {
        nodeClusterVariants.value = value
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
      },
    })

    const providerStatusLabel = computed(() => {
      switch (proxyProviderLoadStatus.value) {
        case 'loading':
          return t('loading')
        case 'cached':
          return t('providerStatusCached')
        case 'stale':
          return t('providerStatusStale')
        case 'fresh':
          return t('providerStatusFresh')
        case 'timeout':
          return t('providerStatusTimeout')
        case 'error':
          return t('providerStatusError')
        default:
          return ''
      }
    })

    const providerStatusClass = computed(() => {
      switch (proxyProviderLoadStatus.value) {
        case 'fresh':
          return 'badge-success'
        case 'cached':
          return 'badge-info'
        case 'stale':
          return 'badge-warning'
        case 'timeout':
        case 'error':
          return 'badge-error'
        case 'loading':
          return 'badge-info'
        default:
          return 'badge-ghost'
      }
    })

    const providerStatusTitle = computed(() => {
      const details: string[] = []

      if (proxyProviderRequestDurationMs.value > 0) {
        details.push(`${proxyProviderRequestDurationMs.value} ms`)
      }

      if (proxyProviderLastUpdatedAt.value > 0) {
        details.push(new Date(proxyProviderLastUpdatedAt.value).toLocaleString())
      }

      return details.join(' | ')
    })

    const tabsWithNumbers = computed(() => {
      const { strategyGroups, nodeGroups } = proxyGroupRoleSplit.value

      const countMap: Record<PROXY_TAB_TYPE, number> = {
        [PROXY_TAB_TYPE.STRATEGY]: strategyGroups.length,
        [PROXY_TAB_TYPE.NODE]: nodeGroups.length,
        [PROXY_TAB_TYPE.PROVIDER]: proxyProviederList.value.length,
      }

      return Object.values(PROXY_TAB_TYPE).map((type) => ({ type, count: countMap[type] }))
    })
    return () => {
      const tabs = (
        <SegmentedControl
          modelValue={proxiesTabShow.value}
          onUpdate:modelValue={handlerTabChange}
          options={tabsWithNumbers.value.map(({ type, count }) => ({
            value: type,
            label: t(type),
            count,
          }))}
        />
      )
      const manageEntriesIcon = (can('entryManage') || can('groupConfigPatch')) && (
        <>
          <button
            class="btn btn-circle btn-sm"
            title={t('daeEntries')}
            onClick={() => (entryManagerModel.value = true)}
          >
            <RectangleStackIcon class="h-4 w-4" />
          </button>
          <DaeEntryModal v-model={entryManagerModel.value} />
        </>
      )
      const providerStatusBadge = proxiesTabShow.value === PROXY_TAB_TYPE.PROVIDER &&
        providerStatusLabel.value && (
          <span
            class={['badge badge-sm whitespace-nowrap', providerStatusClass.value]}
            title={providerStatusTitle.value}
          >
            {providerStatusLabel.value}
          </span>
        )
      const upgradeAllIcon = proxiesTabShow.value === PROXY_TAB_TYPE.PROVIDER &&
        can('proxyProviderUpdate') && (
          <button
            class="btn btn-circle btn-sm"
            onClick={handlerClickUpdateAllProviders}
          >
            <ArrowPathIcon class={['h-4 w-4', isUpgrading.value && 'animate-spin']} />
          </button>
        )
      const modeSelect = configs.value && can('configPatch') && (
        <SelectInput
          class={['select select-sm', isLargeCtrlsBar.value ? 'min-w-40' : 'min-w-24']}
          modelValue={configs.value.mode}
          onUpdate:modelValue={(value) => (configs.value!.mode = value as string)}
          onChange={(value) => handlerModeChange(value as string)}
          options={modeList.value.map((value) => ({
            value,
            label: needTranslateModes.value ? t(value.toLowerCase()) : value,
          }))}
        />
      )
      const sort = (
        <SelectInput
          class={['select select-sm']}
          modelValue={proxySortType.value}
          onUpdate:modelValue={(value) => (proxySortType.value = value as PROXY_SORT_TYPE)}
          options={Object.values(PROXY_SORT_TYPE).map((value) => ({
            value,
            label: t(value),
          }))}
        />
      )

      const latencyTestAll = can('latencyTest') && (
        <button
          class="btn btn-circle btn-sm"
          onClick={handlerClickLatencyTestAll}
        >
          {isAllLatencyTesting.value ? (
            <span class="loading loading-spinner loading-sm"></span>
          ) : (
            <BoltIcon class="h-4 w-4" />
          )}
        </button>
      )

      const toggleCollapseAll = (
        <button
          class={[
            'btn btn-circle btn-sm',
            twoColumnProxyGroup.value &&
              proxiesTabShow.value !== PROXY_TAB_TYPE.PROVIDER &&
              'max-sm:hidden',
          ]}
          onClick={handlerClickToggleCollapse}
        >
          {hasNotCollapsed.value ? (
            <ChevronUpIcon class="h-4 w-4" />
          ) : (
            <ChevronDownIcon class="h-4 w-4" />
          )}
        </button>
      )

      const searchPlaceholder = isProxyNodeSearchMode.value
        ? `${t('searchProxyNode')} | Regex`
        : `${t('searchProxyGroup')} | Regex`
      const searchInput = (
        <div class={['relative w-32 flex-1', isLargeCtrlsBar.value && 'max-w-80']}>
          <button
            class="btn btn-circle btn-ghost btn-xs absolute top-1/2 left-1 z-20 h-6 min-h-6 w-6 -translate-y-1/2 p-0"
            title={
              isProxyNodeSearchMode.value ? t('proxySearchModeGlobal') : t('proxySearchModeGroup')
            }
            onClick={toggleProxySearchMode}
          >
            {isProxyNodeSearchMode.value ? (
              <GlobeAltIcon class="h-3.5 w-3.5" />
            ) : (
              <RectangleGroupIcon class="h-3.5 w-3.5" />
            )}
          </button>
          <TextInput
            v-model={proxiesFilter.value}
            placeholder={searchPlaceholder}
            clearable={true}
            class="w-full pl-7"
          />
        </div>
      )

      const settingsModal = (
        <>
          <button
            class="btn btn-circle btn-sm"
            onClick={() => (settingsModel.value = true)}
          >
            <WrenchScrewdriverIcon class="h-4 w-4" />
          </button>
          <DialogWrapper
            v-model={settingsModel.value}
            title={t('proxySettings')}
          >
            <div class="flex flex-col gap-3 text-sm">
              <div class="settings-grid">
                <div class="setting-item">
                  <div class="setting-item-label">{t('sortBy')}</div>
                  {sort}
                </div>
                {hasSmartGroup.value && (
                  <div class="setting-item">
                    <div class="setting-item-label">{t('useSmartGroupSort')}</div>
                    <input
                      class="toggle"
                      type="checkbox"
                      v-model={useSmartGroupSort.value}
                    />
                  </div>
                )}
                <div class="setting-item">
                  <div class="setting-item-label">{t('groupProxiesByProvider')}</div>
                  <input
                    type="checkbox"
                    class="toggle"
                    v-model={groupProxiesByProvider.value}
                  />
                </div>
                <div class="setting-item">
                  <div class="setting-item-label">{t('unavailableProxy')}</div>
                  <input
                    type="checkbox"
                    class="toggle"
                    v-model={hideUnavailableProxies.value}
                  />
                </div>
                <div class="setting-item">
                  <div class="setting-item-label">{t('manageHiddenGroup')}</div>
                  <input
                    class="toggle"
                    type="checkbox"
                    v-model={manageHiddenGroup.value}
                  />
                </div>
                <div class="setting-item">
                  <div class="setting-item-label">{t('automaticDisconnection')}</div>
                  <input
                    class="toggle"
                    type="checkbox"
                    v-model={automaticDisconnection.value}
                  />
                </div>
                <div class="setting-item">
                  <div class="setting-item-label">{t('displayFinalOutbound')}</div>
                  <input
                    class="toggle"
                    type="checkbox"
                    v-model={displayFinalOutbound.value}
                  />
                </div>
                <div class="setting-item">
                  <div class="setting-item-label">{t('disableProxiesPageTextSelect')}</div>
                  <input
                    class="toggle"
                    type="checkbox"
                    v-model={disableProxiesPageTextSelect.value}
                  />
                </div>
                <div class="setting-item">
                  <div class="setting-item-label">{t('minProxyCardWidth')}</div>
                  <div class="join">
                    <input
                      class="input input-sm join-item w-20"
                      type="number"
                      v-model={minProxyCardWidth.value}
                    />
                    <button
                      class="btn join-item btn-sm"
                      onClick={handlerResetProxyCardWidth}
                    >
                      {t('reset')}
                    </button>
                  </div>
                </div>
                <div class="setting-item col-span-full">
                  <div class="setting-item-label">{t('nodeClusterVariants')}</div>
                  <textarea
                    class="textarea textarea-sm w-full font-mono text-xs"
                    rows={4}
                    v-model={nodeClusterVariantsText.value}
                  />
                  <div class="text-base-content/60 text-xs">{t('nodeClusterVariantsTip')}</div>
                </div>
              </div>
              <button
                class="btn btn-block"
                onClick={() => {
                  settingsModel.value = false
                  router.push({
                    name: ROUTE_NAME.settings,
                    query: { section: SETTINGS_MENU_KEY.proxies },
                  })
                }}
              >
                {t('moreSettings')}
              </button>
            </div>
          </DialogWrapper>
        </>
      )

      const content = !isLargeCtrlsBar.value ? (
        <div class="flex flex-col gap-2 p-2">
          {hasProviders.value && (
            <div class="flex gap-2">
              {tabs}
              {providerStatusBadge}
              {upgradeAllIcon}
            </div>
          )}
          <div class="flex w-full gap-2">
            {modeSelect}
            {searchInput}
            {settingsModal}
            {manageEntriesIcon}
            {toggleCollapseAll}
            {latencyTestAll}
          </div>
        </div>
      ) : (
        <div class="flex gap-2 p-2">
          {hasProviders.value && tabs}
          {providerStatusBadge}
          {modeSelect}
          <div class="flex flex-1">{searchInput}</div>
          {upgradeAllIcon}
          {settingsModal}
          {manageEntriesIcon}
          {toggleCollapseAll}
          {latencyTestAll}
        </div>
      )

      return <CtrlsBar solid={foldersUiVisible.value}>{content}</CtrlsBar>
    }
  },
})
