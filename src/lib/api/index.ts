import { isDemoMode } from '../env'
import { demoAuth, demoData } from './demoApi'
import { supabaseAuth, supabaseData } from './supabaseApi'
import type { AuthApi, DataApi } from './types'

export const authApi: AuthApi = isDemoMode ? demoAuth : supabaseAuth
export const dataApi: DataApi = isDemoMode ? demoData : supabaseData
export type * from './types'
