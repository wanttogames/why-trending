<script setup lang="ts">defineProps<{ score: number; large?: boolean }>()</script>
<template>
  <div class="score-badge" :class="{ large }"><span>이슈지수</span><strong>{{ Math.round(score) }}</strong></div>
</template>
