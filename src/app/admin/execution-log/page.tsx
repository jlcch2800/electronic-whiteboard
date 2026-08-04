// 系統執行記錄頁面 (Server Component)
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ExecutionLogClient from './ExecutionLogClient'

export const dynamic = 'force-dynamic'

export default async function ExecutionLogPage() {
    const supabase = await createClient()

    // 驗證登入
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login?redirect=/admin/execution-log')

    // 驗證管理員權限
    const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') redirect('/')

    // 執行記錄改由 Client 端初次載入 (搭配分頁與搜尋)
    const logs: any[] = []

    return <ExecutionLogClient initialLogs={logs} />
}
