// FormField — 包裝 Label + Input + 即時驗證狀態的通用欄位元件
'use client'

import { ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, Info } from 'lucide-react'
import { Label } from '@/components/ui/label'

interface FormFieldProps {
    /** 欄位標籤 */
    label: string
    /** 是否為必填欄位 */
    required?: boolean
    /** 自訂 tooltip 文字（預設「此欄位為必填」） */
    tooltip?: string
    /** react-hook-form 的 error message */
    error?: string
    /** 是否已被觸碰（onBlur 後設為 true） */
    touched?: boolean
    /** 子元素（Input, Textarea, Select 等） */
    children: ReactNode
    /** 額外 className */
    className?: string
}

export default function FormField({
    label,
    required = false,
    tooltip,
    error,
    touched = false,
    children,
    className = '',
}: FormFieldProps) {
    // 判斷驗證狀態：touched 後才顯示
    const showValidation = touched
    const isValid = showValidation && !error
    const isInvalid = showValidation && !!error

    return (
        <div className={`space-y-2 ${className}`}>
            {/* Label 區域 */}
            <Label className="flex items-center gap-1.5 text-sm font-medium">
                {label}
                {required && (
                    <span className="relative group">
                        <span className="text-red-500 font-bold">*</span>
                        {/* Tooltip */}
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 shadow-lg z-50">
                            {tooltip || '此欄位為必填'}
                            <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                        </span>
                    </span>
                )}
                {/* 驗證狀態圖示 */}
                <AnimatePresence mode="wait">
                    {isValid && (
                        <motion.span
                            key="valid"
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            transition={{ duration: 0.2 }}
                        >
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                        </motion.span>
                    )}
                    {isInvalid && (
                        <motion.span
                            key="invalid"
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            transition={{ duration: 0.2 }}
                        >
                            <XCircle className="w-4 h-4 text-red-500" />
                        </motion.span>
                    )}
                </AnimatePresence>
            </Label>

            {/* 子元素（Input 等） */}
            <div className={`relative transition-all duration-200 ${isInvalid ? '[&>input]:border-red-400 [&>input]:ring-red-100 [&>input]:ring-2 [&>textarea]:border-red-400 [&>textarea]:ring-red-100 [&>textarea]:ring-2' : isValid ? '[&>input]:border-green-400 [&>input]:ring-green-100 [&>input]:ring-2 [&>textarea]:border-green-400 [&>textarea]:ring-green-100 [&>textarea]:ring-2' : ''}`}>
                {children}
            </div>

            {/* 錯誤訊息 */}
            <AnimatePresence>
                {isInvalid && error && (
                    <motion.p
                        initial={{ opacity: 0, y: -4, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -4, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-red-500 text-xs flex items-center gap-1"
                    >
                        <Info className="w-3 h-3" />
                        {error}
                    </motion.p>
                )}
            </AnimatePresence>
        </div>
    )
}
