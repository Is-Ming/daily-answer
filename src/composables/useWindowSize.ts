import { onMounted, onUnmounted, ref } from 'vue'

/** 窗口尺寸（响应式）。仅用本项目需要的高度，避免引入 VueUse。 */
export function useWindowSize() {
  const width = ref(typeof window !== 'undefined' ? window.innerWidth : 0)
  const height = ref(typeof window !== 'undefined' ? window.innerHeight : 0)
  const onResize = () => {
    width.value = window.innerWidth
    height.value = window.innerHeight
  }
  onMounted(() => window.addEventListener('resize', onResize))
  onUnmounted(() => window.removeEventListener('resize', onResize))
  return { width, height }
}
