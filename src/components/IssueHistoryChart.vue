<script setup lang="ts">
import { computed } from 'vue'
import type { IssueSnapshot } from '@shared/types'
const props = defineProps<{ history: IssueSnapshot[] }>()
const points = computed(() => {
  if (!props.history.length) return ''
  const width = 680, height = 220, pad = 12
  return props.history.map((item, index) => {
    const x = pad + (index / Math.max(1, props.history.length - 1)) * (width - pad * 2)
    const y = height - pad - (item.issueScore / 100) * (height - pad * 2)
    return `${x},${y}`
  }).join(' ')
})
const area = computed(() => points.value ? `12,208 ${points.value} 668,208` : '')
const labels = computed(() => props.history.filter((_, index) => index % 6 === 0 || index === props.history.length - 1))
</script>
<template>
  <div class="chart-wrap">
    <div class="chart-scale"><span>100</span><span>50</span><span>0</span></div>
    <svg v-if="history.length" class="history-chart" viewBox="0 0 680 220" preserveAspectRatio="none" role="img" aria-label="최근 24시간 이슈지수 변화 그래프">
      <defs><linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff4d00" stop-opacity=".28"/><stop offset="1" stop-color="#ff4d00" stop-opacity="0"/></linearGradient></defs>
      <path d="M12 110H668M12 208H668M12 12H668" class="grid-line"/>
      <polygon :points="area" fill="url(#scoreFill)"/>
      <polyline :points="points" fill="none" stroke="#ff4d00" stroke-width="4" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <div v-else class="empty-chart">아직 충분한 기록이 없어요.</div>
    <div class="chart-labels"><span v-for="item in labels" :key="item.collectedAt">{{ new Date(item.collectedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}) }}</span></div>
  </div>
</template>
