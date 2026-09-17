import type { WorkerEnv } from '../shared/types'

export type DataMode = 'mock' | 'real'

export const resolveDataMode = (env: WorkerEnv): DataMode => {
  const mode = env.DATA_MODE?.trim().toLowerCase()
  if (mode === 'real' || mode === 'mock') return mode
  throw new Error('DATA_MODE 환경변수는 real 또는 mock으로 설정해야 합니다.')
}
