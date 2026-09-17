import type { WorkerEnv } from '../shared/types'
import { resolveDataMode } from '../server/data-mode'
import { runCollection } from '../server/pipeline/collect'

export default {
  async scheduled(_controller: ScheduledController, env: WorkerEnv, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runCollection(env).then((result) => console.info('[collector] complete', result)))
  },
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/health') return Response.json({ ok: true, mode: resolveDataMode(env) })
    if (url.pathname === '/__scheduled' && request.method === 'POST') return Response.json(await runCollection(env))
    return new Response('Not found', { status: 404 })
  },
}
