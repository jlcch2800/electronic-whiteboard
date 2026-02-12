
import { createClient } from '@/lib/supabase/server'
import VendorEditClient from './VendorEditClient'

export default async function VendorWorkEditPage({ params }: { params: { id: string } }) {
    const supabase = await createClient()
    const { data } = await supabase.from('vendor_today_work').select('*').eq('id', params.id).single()

    return <VendorEditClient initialData={data} />
}
