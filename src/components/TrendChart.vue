<script setup lang="ts">
import { computed,ref } from 'vue'
import type { Series } from '@shared/types'
const props=defineProps<{series:Series[];days:number}>(),table=ref(false)
const shown=computed(()=>props.series.map(s=>({...s,points:s.points.slice(-props.days)})))
const paths=computed(()=>shown.value.map(s=>{
 let path='',drawing=false
 s.points.forEach((p,i)=>{if(p.value===null){drawing=false;return}const x=35+i/Math.max(1,s.points.length-1)*725,y=215-p.value*1.85;path+=`${drawing?'L':'M'}${x.toFixed(1)},${y.toFixed(1)} `;drawing=true})
 return path
}))
</script>
<template><div class="chart"><div class="chart-legend"><span v-for="(s,i) in series" :key="s.keyword"><i :style="{background:i?'#d77942':'#21836e'}"/>{{ s.keyword }} {{ i?'(점선)':'(실선)' }}</span><span>상대 지수</span></div><svg viewBox="0 0 800 260" role="img" aria-label="기간별 상대 관심도 그래프. 아래 데이터 표에서 정확한 값을 확인할 수 있습니다."><g v-for="v in [0,25,50,75,100]" :key="v"><line x1="35" x2="760" :y1="215-v*1.85" :y2="215-v*1.85" stroke="#e3e9e6"/><text x="0" :y="219-v*1.85" fill="#73827b" font-size="11">{{ v }}</text></g><path v-for="(path,i) in paths" :key="i" :d="path" fill="none" :stroke="i?'#d77942':'#21836e'" stroke-width="3" :stroke-dasharray="i?'7 4':undefined"/><text x="35" y="245" font-size="12" fill="#73827b">{{ shown[0]?.points[0]?.date }}</text><text x="760" y="245" text-anchor="end" font-size="12" fill="#73827b">{{ shown[0]?.points.at(-1)?.date }}</text></svg><p class="muted">빈 구간은 제공되지 않은 데이터입니다. 0으로 보간하지 않습니다.</p><button class="text-button" @click="table=!table">{{ table?'데이터 표 닫기':'데이터 표 보기' }}</button><div v-if="table" class="table-wrap"><table><thead><tr><th>날짜</th><th v-for="s in shown" :key="s.keyword">{{ s.keyword }}</th></tr></thead><tbody><tr v-for="(p,i) in shown[0]?.points" :key="p.date"><td>{{ p.date }}</td><td v-for="s in shown" :key="s.keyword">{{ s.points[i]?.value?.toFixed(2)??'미제공' }}</td></tr></tbody></table></div></div></template>
