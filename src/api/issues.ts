import type { ApiEnvelope, Issue } from '@shared/types'

const request = async <T>(path: string): Promise<T> => {
  const response = await fetch(path, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`API request failed: ${response.status}`)
  return response.json() as Promise<T>
}

export const fetchIssues = async (category = '전체', limit = 20): Promise<ApiEnvelope<Issue[]>> => {
  return request(`/api/issues?category=${encodeURIComponent(category)}&limit=${limit}`)
}

export const fetchIssue = async (slug: string): Promise<ApiEnvelope<Issue>> => {
  return request(`/api/issues/${encodeURIComponent(slug)}`)
}

export interface SearchResult { active: Issue[]; past: Issue[] }
export const searchIssues = async (query: string): Promise<ApiEnvelope<SearchResult>> => {
  return request(`/api/search?q=${encodeURIComponent(query)}`)
}
