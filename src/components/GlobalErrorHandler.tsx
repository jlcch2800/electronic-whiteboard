/**
 * 全域錯誤處理器（Client Component）
 * 需求 H6：捕獲 window.onerror 和 unhandledrejection，寫入 ScriptErrors
 */
'use client'

import { useEffect } from 'react'
import { logScriptError } from '@/lib/error-logger'

export function GlobalErrorHandler() {
    useEffect(() => {
        // 捕獲未處理的 JS 錯誤
        const handleError = (event: ErrorEvent) => {
            logScriptError({
                message: event.message,
                stack: event.error?.stack,
                context: `${event.filename}:${event.lineno}:${event.colno}`,
                source: 'window.onerror',
            })
        }

        // 捕獲未處理的 Promise rejection
        const handleRejection = (event: PromiseRejectionEvent) => {
            const reason = event.reason
            logScriptError({
                message: reason?.message || String(reason),
                stack: reason?.stack,
                source: 'unhandledrejection',
            })
        }

        window.addEventListener('error', handleError)
        window.addEventListener('unhandledrejection', handleRejection)

        return () => {
            window.removeEventListener('error', handleError)
            window.removeEventListener('unhandledrejection', handleRejection)
        }
    }, [])

    return null // 不渲染任何 UI
}
