import { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
    icon: LucideIcon
    title: string
    description?: string
    actionLabel?: string
    onAction?: () => void
    className?: string
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, className = '' }: EmptyStateProps) {
    return (
        <div className={`flex flex-col items-center justify-center p-12 text-center bg-slate-50/50 border-2 border-dashed border-slate-200/60 rounded-xl ${className}`}>
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-5 animate-in fade-in zoom-in duration-500">
                <Icon className="w-7 h-7 text-slate-300" />
            </div>
            <h3 className="text-base font-bold text-slate-700 mb-2">{title}</h3>
            {description && (
                <p className="text-sm text-slate-500 mb-6 max-w-sm leading-relaxed">{description}</p>
            )}
            {actionLabel && onAction && (
                <Button onClick={onAction} variant="outline" size="sm" className="bg-white hover:bg-slate-50 shadow-sm transition-all hover:scale-105 active:scale-95">
                    {actionLabel}
                </Button>
            )}
        </div>
    )
}
