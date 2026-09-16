<script setup lang="ts">
import { CATEGORIES, type Category } from '@shared/types'
defineProps<{ modelValue: Category }>()
defineEmits<{ 'update:modelValue': [value: Category] }>()
</script>

<template>
  <nav class="category-tabs" aria-label="이슈 카테고리">
    <button v-for="category in CATEGORIES" :key="category" type="button" :class="{ active: modelValue === category }" @click="$emit('update:modelValue', category)">{{ category }}</button>
  </nav>
</template>
