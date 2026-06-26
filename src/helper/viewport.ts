export const getAppViewportHeight = (
  visualViewportHeight: number | undefined,
  innerHeight: number,
) => {
  return Math.round(visualViewportHeight ?? innerHeight)
}

export const shouldRestoreProxyScroll = (
  scrollHeight: number | null,
  targetScrollTop: number,
  isTimedOut: boolean,
) => {
  return isTimedOut || (scrollHeight !== null && scrollHeight > targetScrollTop)
}

type OverscrollState = {
  deltaX: number
  deltaY: number
  scrollTop: number
  clientHeight: number
  scrollHeight: number
}

export const shouldPreventVerticalOverscroll = ({
  deltaX,
  deltaY,
  scrollTop,
  clientHeight,
  scrollHeight,
}: OverscrollState) => {
  if (Math.abs(deltaY) <= Math.abs(deltaX)) {
    return false
  }

  const atTop = scrollTop <= 0
  const atBottom = scrollTop + clientHeight >= scrollHeight - 1

  return (atTop && deltaY > 0) || (atBottom && deltaY < 0)
}
