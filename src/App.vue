<script setup lang="ts">
import { onMounted,ref,watch } from 'vue'
import { useRouter,useRoute } from 'vue-router'
import { BRAND,NOTICE } from '@shared/config'
import { token } from '@shared/identity'
import { api,runtime,track } from './lib/api'
const route=useRoute(),router=useRouter(),query=ref(''),error=ref('')
function search(){try{router.push(`/search/${token(query.value)}`);track('keyword_search');error.value=''}catch(e){error.value=(e as Error).message}}
watch(()=>route.fullPath,()=>{
 document.title=`${BRAND.name} · ${BRAND.tagline}`
 document.querySelector('meta[name="description"]')?.setAttribute('content',BRAND.description)
 document.querySelector('meta[property="og:title"]')?.setAttribute('content',document.title)
 document.querySelector('meta[property="og:url"]')?.setAttribute('content',location.href)
},{immediate:true})
onMounted(async()=>{try{runtime.value=await api('/api/config')}catch{}})
</script>
<template>
 <header class="site-header"><div class="shell nav"><RouterLink class="brand" to="/"><span class="brand-icon">↗</span>{{ BRAND.name }}<small>BETA</small></RouterLink><nav aria-label="주 메뉴"><RouterLink to="/trending">급상승</RouterLink><RouterLink to="/vs">A vs B</RouterLink><RouterLink to="/shopping">쇼핑 탐색</RouterLink><RouterLink to="/issues">이슈 기록</RouterLink></nav><form class="header-search" @submit.prevent="search"><label class="sr-only" for="global-search">키워드 검색</label><input id="global-search" v-model="query" placeholder="관심 있는 키워드" maxlength="60"/><button aria-label="검색">⌕</button></form></div></header>
 <div v-if="error" class="shell alert">{{ error }}</div>
 <div v-if="runtime.mode==='mock'" class="demo-banner">체험 모드 · 표시된 관심도는 가상 데이터입니다.</div>
 <main class="shell"><RouterView /></main>
 <footer class="shell footer"><div><RouterLink class="brand" to="/">{{ BRAND.name }}</RouterLink><p>{{ NOTICE }}</p><p>관리 키워드 중 상승 추이를 보여줍니다. 대한민국 전체 검색 순위가 아닙니다.</p></div><nav><RouterLink to="/about">서비스 소개</RouterLink><RouterLink to="/methodology">계산 방법</RouterLink><RouterLink to="/privacy">개인정보처리방침</RouterLink><RouterLink to="/terms">이용약관</RouterLink></nav></footer>
</template>
