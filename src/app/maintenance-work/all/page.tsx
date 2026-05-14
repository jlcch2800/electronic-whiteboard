import { createClient } from '@/lib/supabase/server'
import MaintenanceWorkAllClient from './MaintenanceWorkAllClient'

export const dynamic = 'force-dynamic'

export default async function MaintenanceWorkAllPage() {
    const supabase = await createClient()

    // 初始載入第一頁資料 (預設 10 筆)
    const { data } = await supabase
        .from('maintenance_work_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

    return <MaintenanceWorkAllClient initialData={data || []} />
}
