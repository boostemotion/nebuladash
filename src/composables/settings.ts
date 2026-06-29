import { fetchUIUpdateState, upgradeUIAPI } from '@/api'
import { canUpgradeNebulaDashFromConfig } from '@/helper/uiUpdateSource'
import type { ReleaseUpdateCheck } from '@/helper/version'
import { configs } from '@/store/config'
import { autoUpgrade, hiddenSettingsItems } from '@/store/settings'
import type { MaybeRef } from 'vue'
import { computed, ref, unref } from 'vue'

const isUIUpdateAvailable = ref(false)
const isCheckingUIUpdate = ref(false)
const hasCheckedUIUpdate = ref(false)
const latestUIReleaseTag = ref<string | null>(null)
const uiUpdateState = ref<ReleaseUpdateCheck['status']>('unknown')
let uiUpdateCheckPromise: Promise<ReleaseUpdateCheck> | null = null

/**
 * Returns true when the setting item with the given key is visible.
 * Use inside computed() for reactivity. For templates, use useIsSettingVisible(key) instead.
 */
export function isSettingVisible(key: string): boolean {
  return !hiddenSettingsItems.value[key]
}

/**
 * Returns a computed that is true when the setting item with the given key is visible.
 * Use in templates for reactive visibility checks.
 */
export function useIsSettingVisible(key: MaybeRef<string>) {
  return computed(() => !hiddenSettingsItems.value[unref(key)])
}

/**
 * Returns a computed that is true when at least one of the given setting keys is visible.
 * Use for "has any visible item" in a settings section.
 */
export function useHasAnyVisibleSetting(keys: MaybeRef<string[]>) {
  return computed(() => unref(keys).some((k) => !hiddenSettingsItems.value[k]))
}

export const useSettings = () => {
  const checkUIUpdate = async () => {
    if (uiUpdateCheckPromise) {
      return uiUpdateCheckPromise
    }

    isCheckingUIUpdate.value = true
    uiUpdateCheckPromise = (async () => {
      const result = await fetchUIUpdateState()

      hasCheckedUIUpdate.value = true
      isUIUpdateAvailable.value = result.isUpdateAvailable
      latestUIReleaseTag.value = result.latestReleaseTag
      uiUpdateState.value = result.status

      if (
        result.isUpdateAvailable &&
        autoUpgrade.value &&
        canUpgradeNebulaDashFromConfig(configs.value)
      ) {
        upgradeUIAPI()
      }

      return result
    })()

    try {
      return await uiUpdateCheckPromise
    } finally {
      isCheckingUIUpdate.value = false
      uiUpdateCheckPromise = null
    }
  }

  return {
    hasCheckedUIUpdate,
    isCheckingUIUpdate,
    isUIUpdateAvailable,
    checkUIUpdate,
    latestUIReleaseTag,
    uiUpdateState,
  }
}
