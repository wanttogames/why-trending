<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import RankingSection from '../components/RankingSection.vue'
const route=useRoute(),shopping=computed(()=>route.path==='/shopping')
</script>
<template><div class="page-intro"><span class="eyebrow">{{ shopping?'SHOPPING':'EXPLORE' }}</span><h1>{{ shopping?'요즘 눈길이 가는 것들':'관심이 커지는 순간' }}</h1><p>{{ shopping?'구매량이 아닌, 쇼핑 검색 클릭의 흐름을 살펴보세요.':'관리 대상 키워드의 변화율을 비교합니다. 전체 검색어 순위가 아닙니다.' }}</p></div><RankingSection :key="route.fullPath" :shopping="shopping"/></template>
