<script setup lang="ts">
defineProps<{ modelValue: string; busy?: boolean }>()
defineEmits<{ 'update:modelValue': [value: string]; submit: [] }>()
</script>
<template>
  <form class="search-bar" role="search" @submit.prevent="$emit('submit')">
    <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg>
    <input :value="modelValue" type="search" placeholder="궁금한 이슈를 검색해 보세요" aria-label="이슈 검색" @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)" />
    <button type="submit" :disabled="busy || !modelValue.trim()">{{ busy ? '검색 중' : '검색' }}</button>
  </form>
</template>
