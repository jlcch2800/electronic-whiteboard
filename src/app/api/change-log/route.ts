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
        const body = await req.json()
        const { action_type, modify_table, modify_record_id, old_data, new_data } = body

        console.log('[API /change-log] 收到請求:', {
            action_type,
            modify_table,
            modify_record_id,
            has_old_data: !!old_data,
            has_new_data: !!new_data,
        })

        // 驗證必要欄位
        if (!action_type || !modify_table || !modify_record_id) {
            console.error('[API /change-log] 缺少必要參數')
            return NextResponse.json(
                { error: '缺少必要參數 (action_type, modify_table, modify_record_id)' },
                { status: 400 }
            )
        }

        const supabase = await createClient()

        // 取得當前登入使用者
        const { data: { user } } = await supabase.auth.getUser()

        let user_name = '免登入'
        let user_account = 'guest'
        let user_unit = '外部人員'

        if (user) {
            console.log('[API /change-log] 認證成功, user:', user.id)
            // 查詢使用者 profile（取得 user_name, user_account, unit）
            const { data: profile } = await supabase
                .from('users')
                .select('user_name, user_account, unit')
                .eq('id', user.id)
                .single()

            user_name = profile?.user_name || user.email || 'Unknown'
            user_account = profile?.user_account || user.email || 'Unknown'
            user_unit = profile?.unit || null
        } else {
            console.log('[API /change-log] 無登入使用者，將以特定人員(免登入)身份紀錄')
        }

        // 取得台灣時間日期
        const dateStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })

        const insertPayload = {
            date: dateStr,
            action_type,
            user_name,
            user_account,
            user_unit,
            modify_table,
            modify_record_id,
            old_data: old_data || null,
            new_data: new_data || null,
        }

        console.log('[API /change-log] 準備寫入:', {
            ...insertPayload,
            old_data: old_data ? '(有資料)' : null,
            new_data: new_data ? '(有資料)' : null,
        })

        // 寫入 system_change_log
        const { error: insertError } = await supabase.from('system_change_log').insert(insertPayload)

        if (insertError) {
            console.error('[API /change-log] 寫入失敗:', insertError)
            return NextResponse.json({ error: insertError.message, success: false }, { status: 500 })
        }

        console.log('[API /change-log] ✅ 寫入成功!')
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[API /change-log] 錯誤:', error)
        return NextResponse.json(
            { error: '內部錯誤', success: false },
            { status: 500 }
        )
    }
}
