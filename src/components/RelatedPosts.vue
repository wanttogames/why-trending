<script setup lang="ts">
import { ref } from 'vue'
import type { RelatedPost } from '@shared/types'
const props = defineProps<{ slug: string }>()
const posts = ref<RelatedPost[]>([]), loading = ref(false), loaded = ref(false), error = ref(''), partial = ref(false)
async function load() {
  if (loading.value) return
  loading.value = true; error.value = ''
  try {
    const response = await fetch(`/api/issues/${encodeURIComponent(props.slug)}/posts`)
    if (!response.ok) throw new Error('request failed')
    const data = await response.json() as { posts: RelatedPost[]; partial: boolean }
    posts.value = data.posts; partial.value = data.partial; loaded.value = true
  } catch { error.value = '관련 글을 불러오지 못했습니다. 다시 시도해 주세요.' }
  finally { loading.value = false }
}
</script>
<template>
  <section class="detail-section related-posts">
    <h2>블로그·카페에서 함께 보기</h2>
    <p>관련 글 검색 결과입니다. 여론·호감도·시간대별 반응량을 나타내지 않습니다.</p>
    <button v-if="!loaded || error || partial" :disabled="loading" @click="load">{{ loading ? '불러오는 중…' : loaded ? '다시 불러오기' : '관련 글 보기' }}</button>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="partial">일부 검색 결과를 가져오지 못했습니다.</p>
    <p v-if="loaded && !posts.length && !partial">관련 글이 없습니다.</p>
    <ul><li v-for="post in posts" :key="post.url"><a :href="post.url" target="_blank" rel="noopener noreferrer">{{ post.title }} ↗</a><small>{{ post.kind === 'blog' ? '블로그' : '카페' }} · {{ post.source }}</small></li></ul>
  </section>
</template>
