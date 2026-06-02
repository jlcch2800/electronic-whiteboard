import { createClient } from '@/lib/supabase/server'
import VendorWorkClient from '../vendor-work/VendorWorkClient'

export const dynamic = 'force-dynamic'

/**
 * 特定人員專用的廠商今日施工頁面
 * 與 /vendor-work 完全一樣，但移除「返回首頁」按鈕
 */
export default async function VendorWorkGuestPage() {
    const supabase = await createClient()
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })

    const { data } = await supabase
        .from('vendor_today_work')
        .select('*')
        .eq('work_date', today)
        .order('entry_status', { ascending: true })

    return <VendorWorkClient initialData={data || []} hideHomeButton={true} />
}
