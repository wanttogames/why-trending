<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ date: string }>()
const formatted = computed(() => new Intl.DateTimeFormat('ko-KR', { month:'long', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false, timeZone:'Asia/Seoul' }).format(new Date(props.date)))
</script>
<template><span class="last-updated"><i /> {{ formatted }} 업데이트</span></template>
