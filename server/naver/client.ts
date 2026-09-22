import type { WorkerEnv } from '../../shared/types'
import { SubrequestCounter, type SubrequestKind } from '../metrics/subrequest-counter'

const BASE_URL = 'https://naverapihub.apigw.ntruss.com'

export class NaverApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'NaverApiError'
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  timeoutMs?: number
  retries?: number
}

const parseError = async (response: Response): Promise<NaverApiError> => {
  const fallback = `NAVER API 요청 실패 (${response.status})`
  try {
    const payload = await response.json() as {
      error?: { errorCode?: string; message?: string; details?: string }
      errorCode?: string
      errorMessage?: string
      errMsg?: string
      errId?: string
    }
    const code = payload.error?.errorCode ?? payload.errorCode ?? payload.errId
    const message = payload.error?.message ?? payload.errorMessage ?? payload.errMsg ?? fallback
    return new NaverApiError(message, response.status, code)
  } catch {
    return new NaverApiError(fallback, response.status)
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class NaverClient {
  constructor(
    private readonly env: WorkerEnv,
    private readonly counter?: SubrequestCounter,
    private readonly permit?: (service: string) => Promise<void>,
  ) {}

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, timeoutMs = 8_000, retries = 1 } = options
    if (!this.env.NAVER_CLIENT_ID || !this.env.NAVER_CLIENT_SECRET) {
      throw new NaverApiError('NAVER API 인증 정보가 설정되지 않았습니다.', 500, 'MISSING_SECRET')
    }

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        await this.permit?.(path.startsWith('/search-trend/') ? 'trend' : path.startsWith('/shopping/') ? 'shopping' : 'search')
        const kind: SubrequestKind = path.startsWith('/search/v1/') ? 'naverNews'
          : path.startsWith('/search-trend/') ? 'datalab'
            : path.startsWith('/shopping/') ? 'shopping' : 'other'
        this.counter?.increment(kind)
        const response = await fetch(`${BASE_URL}${path}`, {
          method,
          headers: {
            'X-NCP-APIGW-API-KEY-ID': this.env.NAVER_CLIENT_ID,
            'X-NCP-APIGW-API-KEY': this.env.NAVER_CLIENT_SECRET,
            ...(body ? { 'Content-Type': 'application/json' } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        })
        if (response.ok) return await response.json() as T

        const error = await parseError(response)
        const retryable = response.status === 429 || response.status >= 500
        console.error('[naver-api]', { path, attempt, status: response.status, code: error.code })
        if (!retryable || attempt === retries) throw error
        const header = response.headers.get('retry-after')
        const retryAfter = header === null ? NaN : Number(header)
        if (retryAfter > 30) throw error
        await delay(Number.isFinite(retryAfter) ? Math.max(0, retryAfter) * 1_000 : 500 * 2 ** attempt)
      } catch (error) {
        const retryable = error instanceof DOMException && error.name === 'AbortError'
        if (!retryable || attempt === retries) throw error
        console.warn('[naver-api] timeout; retrying', { path, attempt })
        await delay(500 * 2 ** attempt)
      } finally {
        clearTimeout(timer)
      }
    }
    throw new NaverApiError('NAVER API 재시도 한도를 초과했습니다.', 503)
  }
}
