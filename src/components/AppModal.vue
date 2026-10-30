<script setup lang="ts">
// Modal：遮罩 500ms 淡入 + 面板 200ms 滑入，支持底部/顶部两个方向
withDefaults(defineProps<{
  modelValue: boolean
  direction?: 'bottom' | 'top'
}>(), { direction: 'bottom' })
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()
</script>

<template>
  <div class="modal-root" :class="{ open: modelValue }">
    <div class="mask" @click="emit('update:modelValue', false)" />
    <div class="sheet" :class="direction === 'top' ? 'sheet-top' : 'sheet-bottom'">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.modal-root {
  position: fixed;
  inset: 0;
  z-index: 40;
  pointer-events: none;
}
.modal-root.open {
  pointer-events: auto;
}
.mask {
  position: absolute;
  inset: 0;
  background: var(--c-mask);
  opacity: 0;
  transition: opacity 500ms ease-out;
}
.open .mask {
  opacity: 1;
}
.sheet {
  position: absolute;
  left: 0;
  right: 0;
  background: var(--c-bg);
  max-height: calc(var(--vh, 1vh) * 100 - 3rem);
  overflow: auto;
  transition: all 200ms ease-out;
  padding: 1.25rem 1rem;
}
.sheet-bottom {
  bottom: 0;
  border-top: 1px solid var(--c-border);
  padding-bottom: calc(1.25rem + env(safe-area-inset-bottom));
  transform: translateY(100%);
}
.sheet-top {
  top: 0;
  border-bottom: 1px solid var(--c-border);
  padding-top: calc(1.25rem + env(safe-area-inset-top));
  transform: translateY(-100%);
}
.open .sheet-bottom,
.open .sheet-top {
  transform: translateY(0);
}
</style>
