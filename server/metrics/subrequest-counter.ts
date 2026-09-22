export type SubrequestKind='naverNews'|'datalab'|'shopping'|'supabase'|'other'
export class SubrequestCounter {
 private counts:Record<SubrequestKind,number>={naverNews:0,datalab:0,shopping:0,supabase:0,other:0}
 increment(kind:SubrequestKind){if(this.snapshot().total>=45)throw new Error('외부 요청 예산 초과');this.counts[kind]++}
 snapshot(){return {...this.counts,total:Object.values(this.counts).reduce((a,b)=>a+b,0)}}
}
