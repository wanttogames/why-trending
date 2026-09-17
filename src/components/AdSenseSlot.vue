<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { ADSENSE_PUBLISHER_ID } from '@/config/adsense'

defineProps<{ slotId: string }>()

const adElement = ref<HTMLElement | null>(null)

onMounted(async () => {
  if (!import.meta.env.PROD) return

  await nextTick()
  const element = adElement.value
  if (!element || element.dataset.adInitialized === 'true' || element.dataset.adsbygoogleStatus) return

  try {
    window.adsbygoogle = window.adsbygoogle ?? []
    window.adsbygoogle.push({})
    element.dataset.adInitialized = 'true'
  } catch (error) {
    console.warn('[AdSense] 광고 슬롯 초기화 실패', error)
  }
})
</script>

<template>
  <aside class="ad-slot" aria-label="광고">
    <span class="ad-label">광고</span>
    <ins
      ref="adElement"
      class="adsbygoogle"
      style="display: block"
      :data-ad-client="ADSENSE_PUBLISHER_ID"
      :data-ad-slot="slotId"
      data-ad-format="auto"
      data-full-width-responsive="true"
    ></ins>
  </aside>
</template>

<style scoped>
.ad-slot {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  margin: 1.5rem 0;
  padding: 0.625rem 0;
  overflow: hidden;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
}

.ad-label {
  display: block;
  margin-bottom: 0.375rem;
  color: #8491a5;
  font-size: 0.6875rem;
  line-height: 1;
  letter-spacing: 0.08em;
}

.adsbygoogle {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
}

@media (min-width: 768px) {
  .ad-slot {
    margin: 2rem 0;
    padding: 0.75rem 0;
  }
}
</style>
