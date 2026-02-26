// BackButton — 帶 hover 滑動動畫的返回按鈕
'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BackButtonProps {
    /** 按鈕文字（預設「返回」） */
    label?: string
    /** 額外 className */
    className?: string
}

export default function BackButton({
    label = '返回',
    className = '',
}: BackButtonProps) {
    const router = useRouter()

    return (
        <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            className={`group flex items-center gap-2 text-white hover:bg-white/10 transition-all duration-200 ${className}`}
        >
            <ArrowLeft className="w-5 h-5 transition-transform duration-200 group-hover:-translate-x-1" />
            <span className="text-sm font-medium">{label}</span>
        </Button>
    )
}
