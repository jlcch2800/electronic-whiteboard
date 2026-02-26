// SubmitButton — 帶三態動畫（一般 → loading → 成功打勾）的提交按鈕
'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Check, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SubmitButtonProps {
    /** 是否提交中 */
    isSubmitting: boolean
    /** 是否提交成功 */
    isSuccess: boolean
    /** 按鈕文字（預設「提交資料」） */
    label?: string
    /** 額外 className */
    className?: string
    /** 是否禁用 */
    disabled?: boolean
}

export default function SubmitButton({
    isSubmitting,
    isSuccess,
    label = '提交資料',
    className = '',
    disabled = false,
}: SubmitButtonProps) {
    return (
        <Button
            type="submit"
            disabled={isSubmitting || isSuccess || disabled}
            className={`w-full py-6 text-lg font-bold shadow-lg transition-all duration-300 ${isSuccess
                    ? 'bg-green-500 hover:bg-green-500 scale-[1.02]'
                    : ''
                } ${className}`}
        >
            <AnimatePresence mode="wait">
                {isSuccess ? (
                    <motion.span
                        key="success"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                            type: 'spring',
                            stiffness: 300,
                            damping: 15,
                        }}
                        className="flex items-center gap-2"
                    >
                        <motion.span
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{
                                type: 'spring',
                                stiffness: 400,
                                damping: 12,
                                delay: 0.1,
                            }}
                        >
                            <Check className="w-6 h-6" strokeWidth={3} />
                        </motion.span>
                        提交成功！
                    </motion.span>
                ) : isSubmitting ? (
                    <motion.span
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2"
                    >
                        <Loader2 className="w-5 h-5 animate-spin" />
                        處理中...
                    </motion.span>
                ) : (
                    <motion.span
                        key="idle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2"
                    >
                        <Send className="w-5 h-5" />
                        {label}
                    </motion.span>
                )}
            </AnimatePresence>
        </Button>
    )
}
