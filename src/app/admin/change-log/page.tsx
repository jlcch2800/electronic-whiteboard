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

    // 取得異動記錄（預設最新 100 筆）
    const { data: logs } = await supabase
        .from('system_change_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

    return <ChangeLogClient initialLogs={logs || []} />
}
