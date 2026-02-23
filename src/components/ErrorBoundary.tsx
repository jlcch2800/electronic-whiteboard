/**
 * ErrorBoundary 元件
 * 需求 H6：捕獲未處理的渲染錯誤並寫入 ScriptErrors
 */
'use client'

import React from 'react'
import { logScriptError } from '@/lib/error-logger'

interface ErrorBoundaryProps {
    children: React.ReactNode
    /** 元件名稱，用於錯誤來源標識 */
    source?: string
}

interface ErrorBoundaryState {
    hasError: boolean
    error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // 將錯誤寫入 ScriptErrors（Server Action）
        logScriptError({
            message: error.message,
            stack: error.stack,
            context: errorInfo.componentStack || undefined,
            source: this.props.source || 'ErrorBoundary',
        })
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                    <div className="text-center space-y-4">
                        <div className="mx-auto w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center">
                            <span className="text-3xl">⚠️</span>
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">發生錯誤</h2>
                        <p className="text-slate-500 text-sm">
                            系統已自動記錄錯誤資訊，請重新整理頁面或聯繫管理員
                        </p>
                        <button
                            onClick={() => {
                                this.setState({ hasError: false, error: null })
                                window.location.reload()
                            }}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            重新整理
                        </button>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
