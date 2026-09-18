<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Issue } from '@shared/types'
import { fetchIssue } from '@/api/issues'
import IssueHistoryChart from '@/components/IssueHistoryChart.vue'
import IssueScoreBadge from '@/components/IssueScoreBadge.vue'
import RelatedPosts from '@/components/RelatedPosts.vue'
import NewsList from '@/components/NewsList.vue'
import RankChange from '@/components/RankChange.vue'
import { useDocumentMeta } from '@/composables/useDocumentMeta'

const route = useRoute(), router = useRouter()
const issue = ref<Issue | null>(null)
const loading = ref(true), error = ref(''), copied = ref(false)
const title = computed(() => issue.value ? `${issue.value.keyword} 왜 뜨지? - 현재 이슈 이유 | 왜떠?` : '이슈 확인 중 | 왜떠?')
const description = computed(() => issue.value?.reason ?? '현재 이슈가 뜨는 이유를 확인하세요.')
useDocumentMeta(title, description)

const formatDate = (date: string) => new Intl.DateTimeFormat('ko-KR', { month:'long', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false, timeZone:'Asia/Seoul' }).format(new Date(date))
const share = async () => {
  const data = { title: title.value, text: description.value, url: window.location.href }
  if (navigator.share) { await navigator.share(data); return }
  await navigator.clipboard.writeText(window.location.href); copied.value = true; setTimeout(() => copied.value = false, 1800)
}
let requestId = 0
watch(() => route.params.slug, async (slug) => {
  const id = ++requestId
  loading.value = true; error.value = ''; issue.value = null
  try { const result = await fetchIssue(String(slug)); if (id === requestId) issue.value = result.data }
  catch { if (id === requestId) error.value = '이슈 정보를 찾을 수 없어요.' }
  finally { if (id === requestId) loading.value = false }
}, { immediate: true })
</script>

<template>
  <div class="content-width detail-page">
    <button class="back-button" @click="router.back()"><span aria-hidden="true">←</span> 실시간 이슈로 돌아가기</button>
    <div v-if="loading" class="detail-loading"><i/><i/><i/></div>
    <div v-else-if="error || !issue" class="empty-state detail-empty"><strong>{{ error }}</strong><RouterLink to="/">홈으로 이동</RouterLink></div>
    <template v-else>
      <header class="detail-header">
        <div class="detail-header-main">
          <div class="detail-labels"><span>{{ issue.category }}</span><RankChange :status="issue.status" :change="issue.rankChange" /></div>
          <h1>{{ issue.keyword }}</h1>
          <p class="detail-question">지금 왜 뜨고 있을까요?</p>
        </div>
        <div class="detail-metrics">
          <div><span>현재 순위</span><strong>{{ issue.rank }}<small>위</small></strong></div>
          <IssueScoreBadge :score="issue.issueScore" large />
        </div>
      </header>

      <section class="reason-card">
        <span class="reason-icon">!</span><div><h2>이슈가 뜨는 이유</h2><p>{{ issue.reason }}</p></div>
      </section>

      <section v-if="issue.evidence" class="detail-section evidence-details">
        <h2>{{ issue.evidence.signal === 'search' ? '검색 상승 확인 · 일간 지표' : '뉴스 확산 감지' }}</h2>
        <p>뉴스 수치는 수집 표본 기준입니다. 전체 보도량이나 실시간 검색량을 뜻하지 않습니다.</p>
        <a v-if="issue.evidence.representative" :href="issue.evidence.representative.url" target="_blank" rel="noopener noreferrer">{{ issue.evidence.representative.title }} ↗</a>
        <small v-if="issue.evidence.representative">{{ formatDate(issue.evidence.representative.publishedAt) }}</small>
      </section>
      <section v-if="issue.events?.length" class="detail-section">
        <h2>이슈의 흐름</h2>
        <p>이 서비스가 관측한 변화이며 최초 보도 시각을 의미하지 않습니다.</p>
        <ol class="issue-timeline"><li v-for="(event, index) in issue.events" :key="index"><time>{{ formatDate(event.eventAt) }}</time><strong>{{ event.title }}</strong><p>{{ event.description }}</p></li></ol>
      </section>
      <div class="detected-grid">
        <div><span>최초 감지</span><strong>{{ formatDate(issue.firstDetectedAt) }}</strong></div>
        <div><span>마지막 감지</span><strong>{{ formatDate(issue.lastDetectedAt) }}</strong></div>
        <div><span>순위 변화</span><strong :class="issue.rankChange > 0 ? 'positive' : issue.rankChange < 0 ? 'negative' : ''">{{ issue.rankChange > 0 ? `↑ ${issue.rankChange}계단` : issue.rankChange < 0 ? `↓ ${Math.abs(issue.rankChange)}계단` : '− 유지' }}</strong></div>
      </div>

      <section class="detail-section">
        <div class="detail-section-heading"><div><span>LAST 24 HOURS</span><h2>이슈지수 변화</h2></div><strong>{{ issue.issueScore }}</strong></div>
        <IssueHistoryChart :history="issue.history ?? []" />
      </section>

      <section v-if="issue.relatedKeywords.length" class="detail-section related-section">
        <div class="detail-section-heading"><div><span>CONNECTED</span><h2>관련 키워드</h2></div></div>
        <div class="keyword-chips"><span v-for="keyword in issue.relatedKeywords" :key="keyword"># {{ keyword }}</span></div>
      </section>

      <section class="detail-section news-section">
        <div class="detail-section-heading"><div><span>RELATED NEWS</span><h2>관련 뉴스</h2></div><small>{{ issue.news?.length ?? 0 }}건</small></div>
        <NewsList :articles="issue.news ?? []" />
      </section>

      <RelatedPosts :key="issue.slug" :slug="issue.slug" />

      <button class="share-button" @click="share"><span aria-hidden="true">↗</span>{{ copied ? '링크를 복사했어요' : '이 이슈 공유하기' }}</button>
    </template>
  </div>
</template>
