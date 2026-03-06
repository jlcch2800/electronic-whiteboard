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
        <div className={`flex flex-col items-center justify-center p-12 text-center bg-muted/30 border-2 border-dashed border-border/60 rounded-xl transition-all hover:bg-muted/50 hover:border-border/80 ${className}`}>
            <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center shadow-sm border border-border/50 mb-5 animate-in fade-in slide-in-from-bottom-4 duration-500 float">
                <Icon className="w-8 h-8 text-muted-foreground/50 transition-transform duration-500 hover:scale-110 hover:text-primary/70" />
            </div>
            <h3 className="text-lg font-bold text-foreground/80 mb-2 animate-in fade-in duration-700 delay-150 fill-mode-both">{title}</h3>
            {description && (
                <p className="text-sm text-muted-foreground mb-6 max-w-sm leading-relaxed">{description}</p>
            )}
            {actionLabel && onAction && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 delay-300 fill-mode-both">
                    <Button onClick={onAction} variant="outline" size="sm" className="bg-background hover:bg-muted shadow-sm transition-all hover:scale-105 active:scale-95 group">
                        {actionLabel}
                        <span className="ml-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                            →
                        </span>
                    </Button>
                </div>
            )}
        </div>
    )
}
