<script setup lang="ts">
import type { NewsArticle } from '@shared/types'
import { ADSENSE_SLOTS } from '@/config/adsense'
import AdSenseSlot from './AdSenseSlot.vue'
defineProps<{ articles: NewsArticle[] }>()
const relative = (date: string) => {
  const minutes = Math.max(1, Math.round((Date.now() - Date.parse(date)) / 60_000))
  if (minutes < 60) return `${minutes}분 전`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}시간 전`
  return `${Math.floor(minutes / 1440)}일 전`
}
</script>
<template>
  <div v-if="articles.length" class="news-list">
    <template v-for="(article, index) in articles" :key="article.url">
      <a :href="article.url" target="_blank" rel="noopener noreferrer" class="news-item">
        <div><h3>{{ article.title }}</h3><p>{{ article.description }}</p><span>{{ article.publisher }} · {{ relative(article.publishedAt) }}</span></div><b aria-hidden="true">↗</b>
      </a>
      <AdSenseSlot v-if="index === 2" :slot-id="ADSENSE_SLOTS.detail1" />
      <AdSenseSlot v-if="index === 6" :slot-id="ADSENSE_SLOTS.detail2" />
    </template>
  </div>
  <div v-else class="empty-state small"><strong>아직 관련 뉴스가 없어요</strong></div>
</template>
