/**
 * ScriptErrors 異常記錄機制
 * 需求 H6：把 exception 與偵錯資訊寫入 ScriptErrors
 * 寫入 system_execution_log 表，log_level = 'Error'
 */
'use server'

import { createAdminClient } from '@/lib/supabase/server'

interface ScriptErrorPayload {
    /** 錯誤訊息 */
    message: string
    /** 錯誤堆疊 */
    stack?: string
    /** 發生位置或上下文 */
    context?: string
    /** 觸發來源（如元件名或 URL） */
    source?: string
}

/**
 * 將前端或後端例外寫入 system_execution_log
 * 作為 Server Action 供前端直接呼叫
 */
export async function logScriptError(payload: ScriptErrorPayload) {
    try {
        const supabase = createAdminClient()

        await supabase.from('system_execution_log').insert({
            log_level: 'Error',
            event_type: 'ScriptError',
            event_source: payload.source || 'unknown',
            description: payload.message,
            details: JSON.stringify({
                stack: payload.stack,
                context: payload.context,
                timestamp: new Date().toISOString(),
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
            }),
        })
    } catch (err) {
        // 記錄失敗時 fallback 到 console
        console.error('[ScriptErrors] 寫入失敗:', err)
    }
}
