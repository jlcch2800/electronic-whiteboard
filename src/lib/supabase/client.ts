// Supabase Client for Client Components (Singleton Pattern)
import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database.types'

// 單例：確保整個 App 只有一個 Supabase client，避免 navigator.locks 競爭
let supabaseClient: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
    if (!supabaseClient) {
        supabaseClient = createBrowserClient<Database>(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
    }
    return supabaseClient
}
