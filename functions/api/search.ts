import { errorResponse, getIssues, json, type PagesContext } from '../_shared/http'
import { resolveDataMode } from '../../server/data-mode'

export const onRequestGet = async ({ request, env }: PagesContext): Promise<Response> => {
  try {
    const query = new URL(request.url).searchParams.get('q')?.trim().toLocaleLowerCase('ko-KR') ?? ''
    if (query.length < 1) return json({ data: { active: [], past: [] }, meta: { updatedAt: new Date().toISOString(), mode: resolveDataMode(env) } })
    const result = await getIssues(env, null, 100)
    const matches = result.data.filter((issue) => issue.keyword.toLocaleLowerCase('ko-KR').includes(query) || issue.relatedKeywords.some((keyword) => keyword.toLocaleLowerCase('ko-KR').includes(query)))
    const cutoff = Date.now() - 24 * 60 * 60_000
    return json({ data: { active: matches.filter((issue) => Date.parse(issue.lastDetectedAt) >= cutoff), past: matches.filter((issue) => Date.parse(issue.lastDetectedAt) < cutoff) }, meta: result.meta })
  } catch (error) {
    return errorResponse(error)
  }
}
