<script setup lang="ts">
import { ref,watch } from 'vue'
import { useRouter } from 'vue-router'
import { vsPath } from '@shared/identity'
const props=defineProps<{a?:string;b?:string}>(),a=ref(props.a??''),b=ref(props.b??''),error=ref(''),router=useRouter()
watch(()=>[props.a,props.b],()=>{a.value=props.a??'';b.value=props.b??''})
function submit(){try{const path=vsPath(a.value,b.value);router.push(path);error.value=''}catch(e){error.value=(e as Error).message}}
</script>
<template><form class="compare-form" @submit.prevent="submit"><div class="compare-inputs"><label><span>첫 번째 관심사</span><input v-model="a" placeholder="예: ChatGPT" maxlength="60" required/></label><b class="vs-dot">VS</b><label><span>두 번째 관심사</span><input v-model="b" placeholder="예: Gemini" maxlength="60" required/></label><button class="primary">관심도 비교하기 <span>↗</span></button></div><p v-if="error" role="alert" class="error">{{ error }}</p></form></template>
