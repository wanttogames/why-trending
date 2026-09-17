import { errorResponse, getIssue, getIssues, json } from '../functions/_shared/http'
import type { Issue, WorkerEnv } from '../shared/types'

interface Env extends WorkerEnv {
  ASSETS: Fetcher
}

const apiNotFound = (): Response =>
  json({ error: 'API 경로를 찾을 수 없습니다.' }, { status: 404 })

const methodNotAllowed = (): Response =>
  json({ error: '허용되지 않은 요청 방식입니다.' }, {
    status: 405,
    headers: { Allow: 'GET' },
  })

const parseLimit = (url: URL, fallback = 20): number => {
  const requested = Number(url.searchParams.get('limit') ?? fallback)
  return Math.max(1, Math.min(100, Number.isFinite(requested) ? requested : fallback))
}

const search = async (url: URL, env: Env): Promise<Response> => {
  const query = url.searchParams.get('q')?.trim().toLocaleLowerCase('ko-KR') ?? ''
  const result = await getIssues(env, null, 100)

  if (!query) {
    return json({ data: { active: [], past: [] }, meta: result.meta })
  }

  const matches = result.data.filter((issue) =>
    issue.keyword.toLocaleLowerCase('ko-KR').includes(query)
    || issue.relatedKeywords.some((keyword) => keyword.toLocaleLowerCase('ko-KR').includes(query)),
  )
  const activeCutoff = Date.now() - 24 * 60 * 60_000

  return json({
    data: {
      active: matches.filter((issue) => Date.parse(issue.lastDetectedAt) >= activeCutoff),
      past: matches.filter((issue) => Date.parse(issue.lastDetectedAt) < activeCutoff),
    },
    meta: result.meta,
  })
}

const issueSubresource = (issue: Issue, resource?: string) => {
  if (resource === 'history') return issue.history ?? []
  if (resource === 'news') return issue.news ?? []
  return issue
}

const handleApiRequest = async (request: Request, env: Env): Promise<Response> => {
  if (request.method !== 'GET') return methodNotAllowed()

  const url = new URL(request.url)
  console.log('DATA_MODE =', env.DATA_MODE)
  const pathname = url.pathname.length > 1
    ? url.pathname.replace(/\/+$/, '')
    : url.pathname

  try {
    if (pathname === '/api/trends' || pathname === '/api/issues') {
      const category = url.searchParams.get('category')
      const result = await getIssues(env, category, parseLimit(url))
      if (pathname === '/api/trends') {
        return json({ ...result, mode: result.meta.mode }, {
          headers: { 'X-Data-Mode': result.meta.mode },
        })
      }
      return json(result)
    }

    if (pathname === '/api/search') return await search(url, env)

    const issueMatch = pathname.match(/^\/api\/issues\/([^/]+)(?:\/(history|news))?$/)
    if (issueMatch) {
      const slug = decodeURIComponent(issueMatch[1])
      const resource = issueMatch[2]
      const result = await getIssue(env, slug)
      if (!result) return json({ error: '이슈를 찾을 수 없습니다.' }, { status: 404 })
      return json({ data: issueSubresource(result.data, resource), meta: result.meta })
    }

    return apiNotFound()
  } catch (error) {
    return errorResponse(error, env.DATA_MODE ?? null)
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return handleApiRequest(request, env)
    }

    return env.ASSETS.fetch(request)
  },
}
