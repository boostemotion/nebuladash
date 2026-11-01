<template>
  <div class="flex flex-col text-sm">
    <div
      class="settings-section-label"
      data-router-updater-section
    >
      {{ $t('routerUpdater') }}
    </div>
    <div class="settings-grid">
      <div class="setting-item max-sm:flex-col max-sm:items-start! max-sm:py-3">
        <div class="setting-item-label">{{ $t('routerUpdaterEndpoint') }}</div>
        <TextInput
          v-model="routerUpdaterEndpoint"
          class="w-full flex-2"
          :clearable="false"
        />
      </div>
      <div class="setting-item max-sm:flex-col max-sm:items-start! max-sm:py-3">
        <div class="setting-item-label">{{ $t('routerUpdaterToken') }}</div>
        <TextInput
          v-model="routerUpdaterToken"
          class="w-full flex-2"
          :clearable="true"
        />
      </div>
    </div>
    <div class="mt-2 flex flex-wrap gap-2">
      <button
        class="btn btn-sm"
        :disabled="busy"
        @click="checkUpdater"
      >
        {{ $t('routerUpdaterCheck') }}
      </button>
      <button
        class="btn btn-primary btn-sm"
        :disabled="busy"
        @click="updateNebulaDash"
      >
        {{ $t('routerUpdaterUpdate') }}
      </button>
      <button
        class="btn btn-warning btn-sm"
        :disabled="busy"
        @click="rollbackNebulaDash"
      >
        {{ $t('routerUpdaterRollback') }}
      </button>
    </div>
    <p
      v-if="message"
      class="text-base-content/70 mt-2 text-xs break-all"
    >
      <span class="font-medium">{{ $t('routerUpdaterStatus') }}:</span>
      {{ message }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { fetchRouterUpdaterStatus, runRouterUpdaterAction } from '@/api/router-updater'
import TextInput from '@/components/common/TextInput.vue'
import { dashboardVersion } from '@/assembly/version'
import { showNotification } from '@/helper/notification'
import { compareReleaseVersion, fetchLatestReleaseTag } from '@/helper/release-version'
import { i18n } from '@/i18n'
import { routerUpdaterEndpoint, routerUpdaterToken } from '@/store/settings'
import { ref } from 'vue'

const busy = ref(false)
const message = ref('')

const assertToken = () => {
  if (!routerUpdaterToken.value.trim()) {
    showNotification({ content: 'routerUpdaterTokenMissing', type: 'alert-warning' })
    return false
  }

  return true
}

/**
 * 更新前的版本风险确认。
 * 远端同版本 / 远端更旧 / 无法确认版本时都要用户明确确认，避免误覆盖或误降级。
 */
const confirmVersionRisk = async () => {
  try {
    const latestReleaseTag = await fetchLatestReleaseTag()
    const comparison =
      latestReleaseTag === null
        ? null
        : compareReleaseVersion(latestReleaseTag, dashboardVersion.value)

    if (comparison === 1) {
      return true
    }

    if (comparison === 0) {
      return window.confirm(
        i18n.global.t('routerUpdaterSameVersionConfirm', { version: latestReleaseTag }),
      )
    }

    if (comparison === -1) {
      return window.confirm(
        i18n.global.t('routerUpdaterDowngradeConfirm', {
          current: dashboardVersion.value,
          remote: latestReleaseTag,
        }),
      )
    }
  } catch {
    // 落到下面的“未知版本”确认。
  }

  return window.confirm(i18n.global.t('routerUpdaterUnknownVersionConfirm'))
}

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

/** 更新期间轮询 status，把下载 / 解压 / 切换分区等阶段显示出来。 */
const pollUntilSettled = async (actionRequest: Promise<unknown>) => {
  for (;;) {
    const settled = await Promise.race([
      actionRequest.then(
        () => true,
        () => true,
      ),
      sleep(700).then(() => false),
    ])

    if (settled) {
      return
    }

    try {
      const status = await fetchRouterUpdaterStatus(
        routerUpdaterEndpoint.value,
        routerUpdaterToken.value,
      )

      if (status.status === 'updating') {
        message.value = status.message || status.status
      }
    } catch {
      // 继续等待动作请求的结果。
    }
  }
}

const checkUpdater = async () => {
  if (!assertToken()) return

  busy.value = true
  try {
    const result = await fetchRouterUpdaterStatus(
      routerUpdaterEndpoint.value,
      routerUpdaterToken.value,
    )
    message.value = result.message || result.status
    showNotification({ content: 'routerUpdaterSuccess', type: 'alert-success' })
  } catch (error) {
    message.value = error instanceof Error ? error.message : ''
    showNotification({ content: 'routerUpdaterFailed', type: 'alert-error' })
  } finally {
    busy.value = false
  }
}

const updateNebulaDash = async () => {
  if (!assertToken()) return
  if (!(await confirmVersionRisk())) return

  busy.value = true
  try {
    const updateRequest = runRouterUpdaterAction(
      routerUpdaterEndpoint.value,
      routerUpdaterToken.value,
      'update',
    )
    const pollRequest = pollUntilSettled(updateRequest)
    const [result] = await Promise.all([updateRequest, pollRequest])

    message.value = result.message || result.status
    showNotification({ content: 'routerUpdaterSuccess', type: 'alert-success' })
    setTimeout(() => window.location.reload(), 1000)
  } catch (error) {
    message.value = error instanceof Error ? error.message : ''
    showNotification({ content: 'routerUpdaterFailed', type: 'alert-error' })
  } finally {
    busy.value = false
  }
}

const rollbackNebulaDash = async () => {
  if (!assertToken()) return

  busy.value = true
  try {
    const result = await runRouterUpdaterAction(
      routerUpdaterEndpoint.value,
      routerUpdaterToken.value,
      'rollback',
    )
    message.value = result.message || result.status
    showNotification({ content: 'routerUpdaterSuccess', type: 'alert-success' })
    setTimeout(() => window.location.reload(), 1000)
  } catch (error) {
    message.value = error instanceof Error ? error.message : ''
    showNotification({ content: 'routerUpdaterFailed', type: 'alert-error' })
  } finally {
    busy.value = false
  }
}
</script>
