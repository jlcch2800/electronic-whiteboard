import { LucideIcon } from 'lucide-react'
import { ReactNode } from 'react'

interface PageHeaderProps {
    title: string
    description?: string
    icon?: LucideIcon
    children?: ReactNode
    className?: string
}

export function PageHeader({ title, description, icon: Icon, children, className = '' }: PageHeaderProps) {
    return (
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8 animate-in fade-in slide-in-from-top-4 duration-500 ${className}`}>
            <div className="flex items-center gap-3">
                {Icon && (
                    <div className="p-2.5 bg-primary/10 rounded-xl shadow-glow-primary">
                        <Icon className="w-6 h-6 text-primary" />
                    </div>
                )}
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">{title}</h1>
                    {description && (
                        <p className="text-muted-foreground mt-1 text-sm sm:text-base">{description}</p>
                    )}
                </div>
            </div>

            {/* 這裡通常放搜尋列或新增按鈕等 actions */}
            {children && (
                <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                    {children}
                </div>
            )}
        </div>
    )
}
