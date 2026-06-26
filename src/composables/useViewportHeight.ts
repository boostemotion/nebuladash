import { getAppViewportHeight } from '@/helper/viewport'
import { onBeforeUnmount, onMounted } from 'vue'

export const useViewportHeight = () => {
  const update = () => {
    const viewport = window.visualViewport
    const height = getAppViewportHeight(viewport?.height, window.innerHeight)

    document.documentElement.style.setProperty('--app-height', `${height}px`)

    if (viewport && viewport.offsetTop !== 0) {
      window.scrollTo(0, 0)
    }
  }

  onMounted(() => {
    update()
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
  })

  onBeforeUnmount(() => {
    window.visualViewport?.removeEventListener('resize', update)
    window.visualViewport?.removeEventListener('scroll', update)
    window.removeEventListener('resize', update)
  })
}
