export type SubrequestKind = 'naverNews' | 'datalab' | 'supabase' | 'other'

export interface SubrequestSnapshot {
  naverNews: number
  datalab: number
  supabase: number
  other: number
  total: number
}

export class SubrequestCounter {
  private readonly counts: Record<SubrequestKind, number> = {
    naverNews: 0,
    datalab: 0,
    supabase: 0,
    other: 0,
  }

  increment(kind: SubrequestKind): void {
    this.counts[kind] += 1
  }

  snapshot(): SubrequestSnapshot {
    const { naverNews, datalab, supabase, other } = this.counts
    return { naverNews, datalab, supabase, other, total: naverNews + datalab + supabase + other }
  }
}
