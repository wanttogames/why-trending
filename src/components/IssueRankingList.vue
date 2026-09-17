<script setup lang="ts">
import type { Issue } from '@shared/types'
import { ADSENSE_SLOTS } from '@/config/adsense'
import AdSenseSlot from './AdSenseSlot.vue'
import IssueRankingItem from './IssueRankingItem.vue'
defineProps<{ issues: Issue[]; loading?: boolean }>()
</script>
<template>
  <div v-if="loading" class="ranking-list skeleton-list" aria-label="이슈를 불러오는 중">
    <div v-for="item in 6" :key="item" class="skeleton-row"><i/><div><b/><span/></div><em/></div>
  </div>
  <div v-else-if="issues.length" class="ranking-list">
    <template v-for="(issue, index) in issues" :key="issue.id">
      <IssueRankingItem :issue="issue" />
      <AdSenseSlot v-if="index === 3" :slot-id="ADSENSE_SLOTS.main1" />
      <AdSenseSlot v-if="index === 8" :slot-id="ADSENSE_SLOTS.main2" />
    </template>
  </div>
  <div v-else class="empty-state"><strong>표시할 이슈가 없어요</strong><p>다른 카테고리를 선택하거나 잠시 후 다시 확인해 주세요.</p></div>
</template>
