<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="site-shell">
    <header class="site-header">
      <div class="content-width header-inner">
        <RouterLink to="/" class="brand" aria-label="왜떠? 홈">
          <span class="brand-mark">?</span><span>왜떠?</span>
        </RouterLink>
        <span class="live-chip"><i aria-hidden="true" /> LIVE</span>
      </div>
    </header>
    <main><RouterView /></main>
    <footer class="site-footer content-width">
      <p>이슈지수는 여러 공개 데이터의 증가 속도를 기반으로 계산한 자체 지표입니다.</p>
      <p>실제 검색량이나 네이버 실시간 검색 순위를 의미하지 않습니다.</p>
      <span>© 2026 왜떠?</span>
    </footer>
  </div>
</template>
