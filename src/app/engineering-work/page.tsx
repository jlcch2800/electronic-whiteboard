import { createClient } from '@/lib/supabase/server'
import EngineeringWorkClient from './EngineeringWorkClient'

export const dynamic = 'force-dynamic'

export default async function EngineeringWorkPage() {
    const supabase = await createClient()
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })

    const { data } = await supabase
        .from('engineering_today_work')
        .select('*')
        .lte('start_date', today)
        .gte('end_date', today)
        .order('start_date', { ascending: false })

    return <EngineeringWorkClient initialData={data || []} />
}
