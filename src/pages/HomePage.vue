<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { Category, Issue } from '@shared/types'
import { fetchIssues, searchIssues } from '@/api/issues'
import CategoryTabs from '@/components/CategoryTabs.vue'
import IssueRankingList from '@/components/IssueRankingList.vue'
import LastUpdated from '@/components/LastUpdated.vue'
import SearchBar from '@/components/SearchBar.vue'
import { useDocumentMeta } from '@/composables/useDocumentMeta'

const category = ref<Category>('전체')
const issues = ref<Issue[]>([])
const updatedAt = ref(new Date().toISOString())
const loading = ref(true)
const error = ref('')
const query = ref('')
const searching = ref(false)
const searchMode = ref(false)

const now = computed(() => new Intl.DateTimeFormat('ko-KR', { weekday:'long', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false, timeZone:'Asia/Seoul' }).format(new Date()))
useDocumentMeta('왜떠? - 지금 대한민국에서 뜨는 이슈', '순위 너머의 이유까지 보여주는 실시간 이슈 탐지 서비스')

const loadIssues = async () => {
  loading.value = true; error.value = ''; searchMode.value = false
  try {
    const result = await fetchIssues(category.value)
    issues.value = result.data; updatedAt.value = result.meta.updatedAt
  } catch {
    error.value = '이슈를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'
  } finally { loading.value = false }
}

const submitSearch = async () => {
  if (!query.value.trim()) return
  searching.value = true; error.value = ''
  try {
    const result = await searchIssues(query.value.trim())
    issues.value = [...result.data.active, ...result.data.past]
    updatedAt.value = result.meta.updatedAt; searchMode.value = true
  } catch { error.value = '검색 결과를 불러오지 못했어요.' }
  finally { searching.value = false }
}

watch(category, () => { query.value = ''; void loadIssues() })
onMounted(loadIssues)
</script>

<template>
  <section class="home-hero">
    <div class="content-width hero-inner">
      <p class="eyebrow"><span>대한민국</span> 실시간 관심 신호</p>
      <h1>지금, 사람들은<br><em>왜 이걸 찾을까?</em></h1>
      <p class="hero-copy">갑자기 뜨는 키워드와 그 배경을 한눈에 확인하세요.</p>
      <SearchBar v-model="query" :busy="searching" @submit="submitSearch" />
      <div class="time-row"><span>{{ now }}</span><LastUpdated :date="updatedAt" /></div>
    </div>
  </section>

  <section class="content-width ranking-section">
    <div class="section-heading">
      <div><span class="section-kicker">NOW TRENDING</span><h2>{{ searchMode ? `'${query}' 검색 결과` : '실시간 이슈 TOP 20' }}</h2></div>
      <button v-if="searchMode" class="text-button" @click="query=''; loadIssues()">전체 순위 보기</button>
    </div>
    <CategoryTabs v-if="!searchMode" v-model="category" />
    <div v-if="error" class="error-state" role="alert"><span>!</span><p>{{ error }}</p><button @click="loadIssues">다시 시도</button></div>
    <IssueRankingList v-else :issues="issues" :loading="loading" />
    <p class="score-note"><span>i</span> 이슈지수는 검색 관심도와 뉴스 증가 속도 등 여러 공개 데이터 신호를 조합한 자체 지표입니다.</p>
  </section>
</template>
