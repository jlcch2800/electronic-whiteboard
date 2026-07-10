import { createClient } from '@/lib/supabase/server'
import ProjectManagementClient from './ProjectManagementClient'

export const dynamic = 'force-dynamic'

export default async function ProjectManagementPage() {
    const supabase = await createClient()

    // 初始載入專案
    const { data: projects } = await supabase
        .from('maintenance_project')
        .select('*')
        .order('created_at', { ascending: false })

    return <ProjectManagementClient initialProjects={projects || []} />
}
