/**
 * 系統異動紀錄 API Route
 * POST /api/change-log
 * 
 * 接收前端傳入的異動資訊，結合當前登入使用者資訊後寫入 system_change_log
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
    try {
        const { action_type, modify_table, modify_record_id, old_data, new_data } = await req.json()

        // 驗證必要欄位
        if (!action_type || !modify_table || !modify_record_id) {
            return NextResponse.json(
                { error: '缺少必要參數 (action_type, modify_table, modify_record_id)' },
                { status: 400 }
            )
        }

        const supabase = await createClient()

        // 取得當前登入使用者
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: '未登入' }, { status: 401 })
        }

        // 查詢使用者 profile（取得 user_name, user_account, unit）
        const { data: profile } = await supabase
            .from('users')
            .select('user_name, user_account, unit')
            .eq('id', user.id)
            .single()

        // 取得台灣時間日期
        const dateStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })

        // 寫入 system_change_log
        const { error: insertError } = await supabase.from('system_change_log').insert({
            date: dateStr,
            action_type,
            user_name: profile?.user_name || user.email || 'Unknown',
            user_account: profile?.user_account || user.email || 'Unknown',
            user_unit: profile?.unit || null,
            modify_table,
            modify_record_id,
            old_data: old_data || null,
            new_data: new_data || null,
        })

        if (insertError) {
            console.error('[API /change-log] 寫入失敗:', insertError)
            return NextResponse.json({ error: insertError.message, success: false }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[API /change-log] 錯誤:', error)
        return NextResponse.json(
            { error: '內部錯誤', success: false },
            { status: 500 }
        )
    }
}
