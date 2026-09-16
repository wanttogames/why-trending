import type { CandidateKeyword } from '../../shared/types'

export const normalizeKeyword = (value: string): string =>
  value.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim()

export const deduplicateCandidates = (items: CandidateKeyword[]): CandidateKeyword[] => {
  const seen = new Set<string>()
  return items.flatMap((item) => {
    const keyword = normalizeKeyword(item.keyword)
    const key = keyword.toLocaleLowerCase('ko-KR')
    if (!keyword || seen.has(key)) return []
    seen.add(key)
    return [{ ...item, keyword }]
  })
}

export const slugify = (keyword: string): string => {
  const ascii = keyword.normalize('NFKD').toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '')
  return ascii || `issue-${crypto.randomUUID().slice(0, 8)}`
}
