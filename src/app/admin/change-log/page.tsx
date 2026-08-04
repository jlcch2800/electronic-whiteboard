// 系統異動記錄頁面 (Server Component)
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChangeLogClient from './ChangeLogClient'

export const dynamic = 'force-dynamic'

export default async function ChangeLogPage() {
    const supabase = await createClient()

    // 驗證登入
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login?redirect=/admin/change-log')

    // 驗證管理員權限
    const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') redirect('/')

    // 異動記錄改由 Client 端初次載入 (搭配分頁與搜尋)
    const logs: any[] = []

    return <ChangeLogClient initialLogs={logs} />
}
