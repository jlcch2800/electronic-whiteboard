// Supabase Client Component 用 - 單例模式
// 使用 @supabase/ssr 預設 cookie-based storage
// 讓 middleware / server components 也能讀取 session
import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database.types'

let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
    if (client) return client

    client = createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    return client
}
