// API Route: POST /api/register
// 使用 Service Role Key 繞過 RLS，將新用戶資料寫入 public.users
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
    try {
        const { id, unit, user_name, user_account, email, password_hash } = await req.json()

        // 基本驗證
        if (!id || !email) {
            return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
        }

        // 使用 Admin Client（Service Role Key）繞過 RLS
        const adminClient = createAdminClient()

        const { error } = await adminClient.from('users').upsert({
            id,
            unit: unit || '待補建',
            user_name: user_name || '新進人員',
            user_account: user_account || email.split('@')[0],
            email,
            password_hash: password_hash || 'MANAGED_BY_SUPABASE_AUTH',
            role: 'staff',
            is_active: true,
            failed_attempts: 0,  // 正確欄位名（非 failed_login_attempts）
        }, { onConflict: 'id' })

        if (error) {
            console.error('[register API] upsert error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('[register API] unexpected error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
