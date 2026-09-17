import type { CandidateKeyword } from '../../shared/types'

export const normalizeKeyword = (value: string): string =>
  value.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim()

export const normalizeCandidates = (items: CandidateKeyword[]): CandidateKeyword[] =>
  items.flatMap((item) => {
    const keyword = normalizeKeyword(item.keyword)
    return keyword ? [{ ...item, keyword }] : []
  })

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

export const keywordHash = (keyword: string): string => {
  const bytes = new TextEncoder().encode(normalizeKeyword(keyword).toLocaleLowerCase('ko-KR'))
  let hash = 0xcbf29ce484222325n
  for (const byte of bytes) {
    hash ^= BigInt(byte)
    hash = BigInt.asUintN(64, hash * 0x100000001b3n)
  }
  return hash.toString(16).padStart(16, '0')
}

export const slugify = (keyword: string): string => {
  const normalized = normalizeKeyword(keyword).toLocaleLowerCase('ko-KR')
  const readable = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
  const safelyReadable = /^[a-z0-9]+(?:[\s_-]+[a-z0-9]+)*$/.test(normalized)

  if (safelyReadable && readable) return readable

  const prefix = /[a-z]/.test(readable) ? readable : 'issue'
  return `${prefix}-${keywordHash(normalized)}`
}
