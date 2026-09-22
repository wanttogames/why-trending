<script setup lang="ts">
import { computed,ref,watch } from 'vue'
import type { ContentResult,Envelope } from '@shared/types'
import { api } from '../lib/api'
const props=defineProps<{keyword:string}>(),emit=defineEmits<{loaded:[count:number]}>(),result=ref<Envelope<ContentResult>|null>(null),error=ref(''),loading=ref(false),tab=ref<'news'|'blog'|'cafe'>('news')
const labels={news:'뉴스',blog:'블로그',cafe:'카페'},items=computed(()=>result.value?.data[tab.value]??[])
let seq=0
async function load(){const id=++seq;loading.value=true;error.value='';try{const r=await api<Envelope<ContentResult>>(`/api/content?q=${encodeURIComponent(props.keyword)}`);if(id===seq){result.value=r;emit('loaded',r.data.news.length+r.data.blog.length+r.data.cafe.length)}}catch(e){if(id===seq)error.value=(e as Error).message}finally{if(id===seq)loading.value=false}}
watch(()=>props.keyword,()=>{seq++;result.value=null;error.value='';loading.value=false})
</script>
<template><section class="content-panel"><div class="section-heading"><div><span class="eyebrow">EXPLORE MORE</span><h2>최근 관련 콘텐츠</h2><p>제공된 제목·설명과 원문 링크로 직접 확인하세요.</p></div><button class="secondary" :disabled="loading" @click="load">{{ loading?'불러오는 중…':result?'새로 확인':'관련 콘텐츠 보기' }}</button></div><p v-if="error" class="alert">{{ error }}</p><template v-if="result"><p v-if="result.meta.message" class="notice">{{ result.meta.message }}</p><div class="pills"><button v-for="(label,key) in labels" :key="key" :class="{active:tab===key}" @click="tab=key">{{ label }}</button></div><p v-if="result.data.unavailable.includes(tab)" class="notice">이 콘텐츠 제공처에 연결하지 못했습니다.</p><p v-else-if="!items.length" class="empty">표시할 관련 콘텐츠가 없습니다.</p><article v-for="item in items" :key="item.url" class="content-item"><a :href="item.url" target="_blank" rel="noopener noreferrer"><h3>{{ item.title }} ↗</h3></a><p>{{ item.description }}</p><small>{{ item.source }}<template v-if="item.publishedAt"> · {{ item.publishedAt.slice(0,10) }}</template></small></article></template></section></template>
