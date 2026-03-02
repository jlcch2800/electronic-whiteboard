import { createClient } from '@/lib/supabase/server'
import VendorWorkClient from './VendorWorkClient'

export const dynamic = 'force-dynamic'

export default async function VendorWorkPage() {
    const supabase = await createClient()
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })

    const { data } = await supabase
        .from('vendor_today_work')
        .select('*')
        .eq('work_date', today)
        .order('entry_status', { ascending: true })

    return <VendorWorkClient initialData={data || []} />
}
