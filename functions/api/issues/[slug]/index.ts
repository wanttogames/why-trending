import { errorResponse, getIssue, json, slugParam, type PagesContext } from '../../../_shared/http'

export const onRequestGet = async ({ env, params }: PagesContext): Promise<Response> => {
  try {
    const result = await getIssue(env, slugParam(params))
    return result ? json(result) : json({ error: '이슈를 찾을 수 없습니다.' }, { status: 404 })
  } catch (error) {
    return errorResponse(error)
  }
}
