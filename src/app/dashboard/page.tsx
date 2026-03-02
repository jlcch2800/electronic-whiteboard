// Dashboard Page - 三欄表格總覽（原首頁）
import { createClient } from '@/lib/supabase/server'
import { format, addMonths } from 'date-fns'
import WhiteboardClient from '../WhiteboardClient'

// Force dynamic rendering (no prerendering at build time)
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
    const supabase = await createClient()

    // Fetch initial data for the whiteboard (today's data)
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
    // 待處理工作項目預設顯示當日起六個月內
    const sixMonthsLater = format(addMonths(new Date(), 6), 'yyyy-MM-dd')

    const [vendorData, engineeringData, pendingData] = await Promise.all([
        supabase
            .from('vendor_today_work')
            .select('*')
            .eq('work_date', today)
            .order('entry_status', { ascending: true }),
        supabase
            .from('engineering_today_work')
            .select('*')
            .lte('start_date', today)
            .gte('end_date', today),
        // 待處理工作項目：查詢當日起六個月內的項目
        supabase
            .from('pending_work')
            .select('*')
            .gte('end_date', today)
            .lte('start_date', sixMonthsLater)
            .order('start_date', { ascending: true }),
    ])

    return (
        <WhiteboardClient
            initialVendors={vendorData.data || []}
            initialEngineering={engineeringData.data || []}
            initialPending={pendingData.data || []}
        />
    )
}
