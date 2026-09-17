import { errorResponse, getIssues, json, type PagesContext } from '../../_shared/http'

export const onRequestGet = async ({ request, env }: PagesContext): Promise<Response> => {
  try {
    const url = new URL(request.url)
    const category = url.searchParams.get('category')
    const rawLimit = Number(url.searchParams.get('limit') ?? 20)
    const limit = Math.max(1, Math.min(100, Number.isFinite(rawLimit) ? rawLimit : 20))
    return json(await getIssues(env, category, limit, true))
  } catch (error) {
    return errorResponse(error)
  }
}
