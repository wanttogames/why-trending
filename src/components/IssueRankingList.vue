<script setup lang="ts">
import type { Issue } from '@shared/types'
import IssueRankingItem from './IssueRankingItem.vue'
defineProps<{ issues: Issue[]; loading?: boolean }>()
</script>
<template>
  <div v-if="loading" class="ranking-list skeleton-list" aria-label="이슈를 불러오는 중">
    <div v-for="item in 6" :key="item" class="skeleton-row"><i/><div><b/><span/></div><em/></div>
  </div>
  <div v-else-if="issues.length" class="ranking-list"><IssueRankingItem v-for="issue in issues" :key="issue.id" :issue="issue" /></div>
  <div v-else class="empty-state"><strong>표시할 이슈가 없어요</strong><p>다른 카테고리를 선택하거나 잠시 후 다시 확인해 주세요.</p></div>
</template>
