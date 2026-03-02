import { createClient } from '@/lib/supabase/server'
import { format, addMonths } from 'date-fns'
import PendingWorkClient from './PendingWorkClient'

export const dynamic = 'force-dynamic'

export default async function PendingWorkPage() {
    const supabase = await createClient()
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
    const sixMonthsLater = format(addMonths(new Date(), 6), 'yyyy-MM-dd')

    const { data } = await supabase
        .from('pending_work')
        .select('*')
        .gte('end_date', today)
        .lte('start_date', sixMonthsLater)
        .order('start_date', { ascending: true })

    return <PendingWorkClient initialData={data || []} />
}
