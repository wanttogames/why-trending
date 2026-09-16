import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { WorkerEnv } from '../shared/types'

export const createServerSupabase = (env: WorkerEnv): SupabaseClient => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase 서버 환경변수가 설정되지 않았습니다.')
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
