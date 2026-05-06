'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pencil, Image as ImageIcon, X, Loader2 } from 'lucide-react'
import SignatureDialog from './SignatureDialog'
import { Button } from '@/components/ui/button'

interface SignatureInputProps {
    value?: string // 圖片 URL 或 Base64
    onChange: (value: string) => void
    label?: string
    placeholder?: string
    error?: string
    disabled?: boolean
    onUpload?: (blob: Blob) => Promise<string> // 選填：上傳至雲端並回傳 URL
}

export default function SignatureInput({
    value,
    onChange,
    label,
    placeholder = '點擊進行手寫簽名',
    error,
    disabled = false,
    onUpload
}: SignatureInputProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isUploading, setIsUploading] = useState(false)

    const handleConfirm = async (dataUrl: string) => {
        if (onUpload) {
            try {
                setIsUploading(true)
                // 將 Base64 轉為 Blob
                const res = await fetch(dataUrl)
                const blob = await res.blob()
                const url = await onUpload(blob)
                onChange(url)
            } catch (err) {
                console.error('Signature upload failed:', err)
                // 失敗時退而求其次存 Base64，或通知使用者
                onChange(dataUrl)
            } finally {
                setIsUploading(false)
            }
        } else {
            onChange(dataUrl)
        }
    }

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation()
        onChange('')
    }

    return (
        <div className="space-y-2">
            <div 
                onClick={() => !disabled && !isUploading && setIsDialogOpen(true)}
                className={`
                    relative group cursor-pointer overflow-hidden rounded-xl border-2 transition-all duration-300
                    min-h-[120px] flex flex-col items-center justify-center bg-white dark:bg-slate-900
                    ${value ? 'border-blue-200 dark:border-blue-900/50 shadow-sm' : 'border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500'}
                    ${error ? 'border-red-400 ring-2 ring-red-100' : ''}
                    ${disabled || isUploading ? 'opacity-60 cursor-not-allowed' : ''}
                `}
            >
                <AnimatePresence mode="wait">
                    {isUploading ? (
                        <motion.div 
                            key="uploading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center gap-2"
                        >
                            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                            <span className="text-xs text-slate-500 font-medium">圖片上傳中...</span>
                        </motion.div>
                    ) : value ? (
                        <motion.div 
                            key="preview"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full h-full p-2 flex items-center justify-center relative"
                        >
                            <img 
                                src={value} 
                                alt="Signature" 
                                className="max-h-[100px] object-contain"
                            />
                            
                            {/* 懸浮工具列 */}
                            <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <Button 
                                    size="sm" 
                                    variant="secondary" 
                                    className="h-8 rounded-full shadow-lg"
                                >
                                    <Pencil className="w-3.5 h-3.5 mr-1.5" />
                                    重新簽名
                                </Button>
                            </div>

                            {/* 刪除按鈕 */}
                            <button 
                                onClick={handleClear}
                                className="absolute top-2 right-2 p-1.5 rounded-full bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 transition-colors z-10"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="placeholder"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center gap-3 text-slate-400 group-hover:text-blue-500 transition-colors"
                        >
                            <div className="p-3 rounded-full bg-slate-50 dark:bg-slate-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
                                <Pencil className="w-6 h-6" />
                            </div>
                            <span className="text-sm font-medium">{placeholder}</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <SignatureDialog 
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onConfirm={handleConfirm}
                title={label}
            />
        </div>
    )
}
