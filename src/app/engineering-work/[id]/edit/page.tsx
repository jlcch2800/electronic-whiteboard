
import { createClient } from '@/lib/supabase/server'
import EngineeringEditClient from './EngineeringEditClient'

export default async function EngineeringWorkEditPage({ params }: { params: { id: string } }) {
    const supabase = await createClient()
    const { data } = await supabase.from('engineering_today_work').select('*').eq('id', params.id).single()

    return <EngineeringEditClient initialData={data} />
}
