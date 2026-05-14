import { createClient } from '@/lib/supabase/server'
import MaintenanceWorkHistoryClient from './MaintenanceWorkHistoryClient'

export const dynamic = 'force-dynamic'

export default async function MaintenanceWorkHistoryPage() {
    const supabase = await createClient()

    // 初始載入第一頁歷史資料 (預設 10 筆)
    const { data } = await supabase
        .from('maintenance_work_orders_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

    return <MaintenanceWorkHistoryClient initialData={data || []} />
}
