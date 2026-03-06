import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { MoreHorizontal } from "lucide-react"

interface MobileTableCardProps {
    id: string
    title: string
    subtitle?: string
    status?: {
        label: string
        variant?: "default" | "secondary" | "destructive" | "outline"
        className?: string
    }
    date: string
    endDate?: string  // 結束日期（工務/待處理用）
    time?: string
    details: { label: string; value: React.ReactNode }[]
    isSelected: boolean
    onSelect: (id: string) => void
    onClick?: () => void
    actionNode?: React.ReactNode
}

export function MobileTableCard({
    id,
    title,
    subtitle,
    status,
    date,
    endDate,
    time,
    details,
    isSelected,
    onSelect,
    onClick,
    actionNode
}: MobileTableCardProps) {
    return (
        <div
            className={`
                bg-card p-4 rounded-xl shadow-card mb-3 relative transition-all duration-200 active:scale-[0.98] select-none
                ${isSelected
                    ? 'shadow-glow-primary border-transparent'
                    : 'border border-border cursor-pointer hover:shadow-elevated hover:border-primary/30'}
                overflow-hidden
            `}
            onClick={() => onClick && onClick()}
        >
            {/* 左側狀態色條 */}
            <div
                className={`absolute left-0 top-0 bottom-0 w-1.5 transition-all duration-300 ${isSelected ? 'bg-primary scale-y-100' : 'bg-transparent scale-y-0'}`}
            />
            {/* 卡片背景 (Selected 疊加) */}
            <div className={`absolute inset-0 transition-opacity duration-300 pointer-events-none ${isSelected ? 'bg-primary/5 opacity-100' : 'opacity-0'}`} />

            <div className="flex items-start justify-between mb-3 relative z-10">
                <div className="flex items-start gap-3">
                    <div onClick={(e) => e.stopPropagation()} className="mt-1">
                        <Checkbox checked={isSelected} onCheckedChange={() => onSelect(id)} />
                    </div>
                    <div className="w-full">
                        <h3 className="font-bold text-foreground text-base mb-1">{title}</h3>
                        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {status && (
                        <Badge variant={status.variant || "default"} className={status.className}>
                            {status.label}
                        </Badge>
                    )}
                    {actionNode && (
                        <div onClick={(e) => e.stopPropagation()}>
                            {actionNode}
                        </div>
                    )}
                </div>
            </div>

            <div className={`grid ${endDate ? 'grid-cols-3' : 'grid-cols-2'} gap-2 mb-3 bg-muted/60 p-3 rounded-lg relative z-10`}>
                <div className="text-xs">
                    <span className="text-muted-foreground block mb-0.5">{endDate ? '開始日期' : '日期'}</span>
                    <span className="font-mono text-foreground/80">{date}</span>
                </div>
                {endDate && (
                    <div className="text-xs">
                        <span className="text-muted-foreground block mb-0.5">結束日期</span>
                        <span className="font-mono text-foreground/80">{endDate}</span>
                    </div>
                )}
                {time && (
                    <div className="text-xs">
                        <span className="text-muted-foreground block mb-0.5">時間</span>
                        <span className="font-mono text-foreground/80">{time}</span>
                    </div>
                )}
            </div>

            <div className="space-y-2 text-sm text-foreground/70 relative z-10">
                {details.map((detail, index) => (
                    <div key={index} className="flex items-start gap-2">
                        <span className="text-muted-foreground min-w-[60px]">{detail.label}：</span>
                        <span className="flex-1">{detail.value || '-'}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
