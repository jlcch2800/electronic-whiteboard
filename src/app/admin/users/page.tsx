// Admin User Management Page
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UserManagementClient from './UserManagementClient'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
    const supabase = await createClient()

    // Check auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login?redirect=/admin/users')

    // Check if admin
    const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') redirect('/')

    // 使用者列表改由 Client 端初次載入 (搭配分頁與搜尋)
    const users: any[] = []

    return <UserManagementClient initialUsers={users} />
}
