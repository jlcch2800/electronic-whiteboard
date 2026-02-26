// FormHeader — 表單進度指示 Header 元件
'use client'

import { motion } from 'framer-motion'

interface FormHeaderProps {
    /** 表單標題 */
    title: string
    /** 當前步驟（1-based） */
    currentStep: number
    /** 總步驟數 */
    totalSteps: number
    /** 主題色 class（如 'bg-blue-600'） */
    themeColor?: string
    /** 進度條顏色 class */
    progressColor?: string
    /** children — 通常放 BackButton */
    children?: React.ReactNode
}

export default function FormHeader({
    title,
    currentStep,
    totalSteps,
    themeColor = 'bg-blue-600',
    progressColor = 'bg-white',
    children,
}: FormHeaderProps) {
    const progress = (currentStep / totalSteps) * 100

    return (
        <header className={`sticky top-0 z-10 ${themeColor} text-white shadow-lg`}>
            <div className="max-w-3xl mx-auto px-6 py-4">
                <div className="flex items-center gap-4">
                    {/* 返回按鈕區域 */}
                    {children}
                    <div className="flex-1">
                        <h1 className="text-lg font-bold">{title}</h1>
                        <p className="text-sm opacity-80 mt-0.5">
                            步驟 {currentStep} / {totalSteps}
                        </p>
                    </div>
                </div>
                {/* 進度條 */}
                <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <motion.div
                        className={`h-full ${progressColor} rounded-full`}
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                    />
                </div>
            </div>
        </header>
    )
}
