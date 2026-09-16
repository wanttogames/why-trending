import { mockIssues, mockUpdatedAt } from '@shared/mock-data'
import type { ApiEnvelope, Issue } from '@shared/types'

const request = async <T>(path: string): Promise<T> => {
  const response = await fetch(path, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`API request failed: ${response.status}`)
  return response.json() as Promise<T>
}

export const fetchIssues = async (category = '전체', limit = 20): Promise<ApiEnvelope<Issue[]>> => {
  try {
    return await request(`/api/issues?category=${encodeURIComponent(category)}&limit=${limit}`)
  } catch {
    const data = category === '전체' ? mockIssues : mockIssues.filter((issue) => issue.category === category)
    return { data: data.slice(0, limit), meta: { updatedAt: mockUpdatedAt, mode: 'mock' } }
  }
}

export const fetchIssue = async (slug: string): Promise<ApiEnvelope<Issue>> => {
  try {
    return await request(`/api/issues/${encodeURIComponent(slug)}`)
  } catch {
    const issue = mockIssues.find((item) => item.slug === slug)
    if (!issue) throw new Error('이슈를 찾을 수 없습니다.')
    return { data: issue, meta: { updatedAt: mockUpdatedAt, mode: 'mock' } }
  }
}

export interface SearchResult { active: Issue[]; past: Issue[] }
export const searchIssues = async (query: string): Promise<ApiEnvelope<SearchResult>> => {
  try {
    return await request(`/api/search?q=${encodeURIComponent(query)}`)
  } catch {
    const normalized = query.toLocaleLowerCase('ko-KR')
    const active = mockIssues.filter((issue) => issue.keyword.toLocaleLowerCase('ko-KR').includes(normalized) || issue.relatedKeywords.some((word) => word.toLocaleLowerCase('ko-KR').includes(normalized)))
    return { data: { active, past: [] }, meta: { updatedAt: mockUpdatedAt, mode: 'mock' } }
  }
}
