<script setup lang="ts">
import type { Issue } from '@shared/types'
import IssueScoreBadge from './IssueScoreBadge.vue'
import RankChange from './RankChange.vue'
defineProps<{ issue: Issue }>()
</script>
<template>
  <RouterLink :to="`/issue/${issue.slug}`" class="ranking-item">
    <div class="rank-number" :class="{ top: issue.rank <= 3 }">{{ issue.rank }}</div>
    <div class="issue-main">
      <div class="issue-title-row"><h3>{{ issue.keyword }}</h3><span class="category-label">{{ issue.category }}</span></div>
      <span v-if="issue.evidence" class="signal-label">{{ issue.evidence.signal === 'search' ? '↗ 검색 상승 확인 · 일간' : '↗ 뉴스 확산 감지' }}</span>
      <p>{{ issue.reason }}</p>
      <RankChange :status="issue.status" :change="issue.rankChange" />
    </div>
    <IssueScoreBadge :score="issue.issueScore" />
    <span class="item-arrow" aria-hidden="true">›</span>
  </RouterLink>
</template>
