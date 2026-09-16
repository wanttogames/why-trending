<script setup lang="ts">
import type { IssueStatus } from '@shared/types'
const props = defineProps<{ status: IssueStatus; change: number }>()
const config: Record<IssueStatus, { icon: string; label: string }> = {
  NEW: { icon: '●', label: 'NEW' }, 급상승: { icon: '↗', label: '급상승' }, 상승: { icon: '↑', label: '상승' }, 유지: { icon: '−', label: '유지' }, 하락: { icon: '↓', label: '하락' },
}
</script>
<template>
  <span class="rank-change" :data-status="status"><b aria-hidden="true">{{ config[props.status].icon }}</b>{{ config[props.status].label }}<template v-if="change !== 0"> {{ Math.abs(change) }}계단</template></span>
</template>
