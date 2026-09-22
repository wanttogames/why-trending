<script setup lang="ts">
import { ref,watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../lib/api'
import { BRAND } from '@shared/config'
import { issueBody,listBody,issueTitle,issueDescription,type ArchiveDetail,type ArchiveList } from '@shared/archive'
const route=useRoute(),html=ref(''),error=ref(''),loading=ref(false);let seq=0
watch(()=>route.fullPath,async()=>{const id=++seq;loading.value=true;error.value='';html.value='';try{
 let title=`이슈 아카이브 | ${BRAND.name}`,description='과거와 현재의 관심도 기록을 확인하세요.'
 if(route.params.slug){const result=await api<ArchiveDetail>('/api/issues/'+encodeURIComponent(String(route.params.slug)));if(id!==seq)return;html.value=issueBody(result);title=issueTitle(result.data);description=issueDescription(result.data)}
 else{const result=await api<ArchiveList>('/api/issues?page='+encodeURIComponent(String(route.query.page??1)));if(id!==seq)return;html.value=listBody(result)}
 document.title=title;for(const selector of ['meta[name="description"]','meta[property="og:description"]'])document.querySelector(selector)?.setAttribute('content',description)
 document.querySelector('meta[property="og:title"]')?.setAttribute('content',title)
 document.querySelector('link[rel="canonical"]')?.setAttribute('href',location.origin+route.path)
 }catch(e){if(id===seq)error.value=(e as Error).message}finally{if(id===seq)loading.value=false}}, {immediate:true})
</script>
<template><p v-if="loading" role="status">관심도 기록을 불러오고 있습니다.</p><div v-else-if="error" role="alert"><p>{{ error }}</p><RouterLink to="/issues">이슈 목록</RouterLink></div><div v-else v-html="html"></div></template>
