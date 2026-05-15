import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import MaintenanceEditClient from './MaintenanceEditClient'

export const dynamic = 'force-dynamic'

export default async function MaintenanceEditPage({ params }: { params: { id: string } }) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('maintenance_work_orders')
        .select('*')
        .eq('id', params.id)
        .single()

    if (error || !data) {
        // 嘗試在歷史表中找
        const { data: histData } = await supabase
            .from('maintenance_work_orders_history')
            .select('*')
            .eq('id', params.id)
            .single()
        
        if (histData) {
            return <MaintenanceEditClient id={params.id} initialData={histData} />
        }
        
        return notFound()
    }

    return <MaintenanceEditClient id={params.id} initialData={data} />
}
