
import { createClient } from '@/lib/supabase/server'
import PendingEditClient from './PendingEditClient'

export default async function PendingWorkEditPage({ params }: { params: { id: string } }) {
    const supabase = await createClient()
    const { data } = await supabase.from('pending_work').select('*').eq('id', params.id).single()

    return <PendingEditClient initialData={data} />
}
