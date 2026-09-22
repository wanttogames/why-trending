<script setup lang="ts">
import { onMounted,ref } from 'vue'
import CompareForm from '../components/CompareForm.vue'
import RankingSection from '../components/RankingSection.vue'
import AdSenseSlot from '../components/AdSenseSlot.vue'
import { ADSENSE_SLOTS } from '../config/adsense'
import { CATEGORIES,SUGGESTED_PAIRS } from '@shared/config'
import { vsPath } from '@shared/identity'
import { api,runtime } from '../lib/api'
const popular=ref(SUGGESTED_PAIRS.map(([a,b])=>({a,b}))),suggested=ref(true),count=ref(0),shoppingCount=ref(0)
onMounted(async()=>{try{const r=await api<{data:Array<{a:string;b:string}>;suggested:boolean}>('/api/popular');popular.value=r.data;suggested.value=r.suggested}catch{}})
</script>
<template><section class="hero"><div class="hero-topline"><span class="eyebrow">FOLLOW YOUR CURIOSITY</span><span class="live-pill"><i/> 데이터로 보는 관심의 흐름</span></div><h1>요즘 뭐가<br><em>더 뜰까?</em><span class="hero-spark" aria-hidden="true">✳</span></h1><p>궁금한 두 대상을 나란히.<br class="mobile-only"/> 관심도의 변화를 직접 비교해 보세요.</p><CompareForm/><div class="quick-pairs"><span>이런 비교는 어때요?</span><RouterLink v-for="[a,b] in SUGGESTED_PAIRS.slice(0,3)" :key="a" :to="vsPath(a,b)">{{ a }} <b>vs</b> {{ b }} ↗</RouterLink></div></section><RankingSection compact @loaded="count=$event"/><section class="popular-section"><div class="section-heading"><div><span class="eyebrow">SIDE BY SIDE</span><h2>{{ suggested?'함께 비교해 보세요':'많이 살펴본 비교' }}</h2></div><span class="muted">{{ suggested?'추천 비교 예시':'시간대별 중복을 줄인 비교 활동 기준' }}</span></div><div class="pair-grid"><RouterLink v-for="(pair,i) in popular" :key="pair.a" :to="vsPath(pair.a,pair.b)" class="pair-card"><span>0{{ i+1 }} / COMPARE</span><div><strong>{{ pair.a }}</strong><b>vs</b><strong>{{ pair.b }}</strong></div><small>관심도 비교하기 ↗</small></RouterLink></div></section><RankingSection shopping compact @loaded="shoppingCount=$event"/><AdSenseSlot v-if="runtime.ads&&runtime.mode==='real'&&count>=5&&shoppingCount>=5" :slot-id="ADSENSE_SLOTS.main1"/><section class="category-section"><span class="eyebrow">FIND YOUR INTEREST</span><h2>어떤 분야가 궁금하세요?</h2><div class="category-grid"><RouterLink v-for="c in CATEGORIES.slice(1)" :key="c" :to="`/trending?category=${encodeURIComponent(c)}`">{{ c }} <span>↗</span></RouterLink></div></section></template>
