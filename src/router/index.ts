import { ROUTE_NAME } from '@/constant'
import { resolvePageTransition } from '@/helper/page-transition'
import { i18n } from '@/i18n'
import { language } from '@/store/settings'
import { activeBackend } from '@/store/setup'
import HomePage from '@/views/HomePage.vue'
import { useTitle } from '@vueuse/core'
import { watch } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'

const childrenRouter = [
  {
    path: 'proxies',
    name: ROUTE_NAME.proxies,
    component: () => import('@/views/ProxiesPage.vue'),
  },
  {
    path: 'overview',
    name: ROUTE_NAME.overview,
    component: () => import('@/views/OverviewPage.vue'),
  },
  {
    path: 'connections',
    name: ROUTE_NAME.connections,
    component: () => import('@/views/ConnectionsPage.vue'),
  },
  {
    path: 'logs',
    name: ROUTE_NAME.logs,
    component: () => import('@/views/LogsPage.vue'),
  },
  {
    path: 'rules',
    name: ROUTE_NAME.rules,
    component: () => import('@/views/RulesPage.vue'),
  },
  {
    path: 'settings',
    name: ROUTE_NAME.settings,
    component: () => import('@/views/SettingsPage.vue'),
  },
]

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: ROUTE_NAME.proxies,
      component: HomePage,
      children: childrenRouter,
    },
    {
      path: '/setup',
      name: ROUTE_NAME.setup,
      component: () => import('@/views/SetupPage.vue'),
    },
    {
      path: '/:catchAll(.*)',
      redirect: ROUTE_NAME.proxies,
    },
  ],
})

const title = useTitle('NebulaDash')
const setTitleByName = (name: string | symbol | undefined) => {
  if (typeof name === 'string' && activeBackend.value) {
    const backend = activeBackend.value
    const prefix = backend.label || `${backend.host}:${backend.port}`
    title.value = `${prefix} | ${i18n.global.t(name)}`
  } else {
    title.value = 'NebulaDash'
  }
}

router.beforeEach((to, from) => {
  resolvePageTransition(to, from)

  if (!activeBackend.value && to.name !== ROUTE_NAME.setup) {
    router.push({ name: ROUTE_NAME.setup, query: to.query })
  }
})

router.afterEach((to) => {
  setTitleByName(to.name)
})

watch([language, activeBackend], () => {
  setTimeout(() => {
    setTitleByName(router.currentRoute.value.name)
  })
})

export default router
