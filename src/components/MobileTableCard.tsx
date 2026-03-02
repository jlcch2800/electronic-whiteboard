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
                bg-white p-4 rounded-xl shadow-sm border mb-3 relative transition-colors
                ${isSelected ? 'border-primary bg-primary/5' : 'border-slate-200'}
            `}
            onClick={() => onClick && onClick()}
        >
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                    <div onClick={(e) => e.stopPropagation()} className="mt-1">
                        <Checkbox checked={isSelected} onCheckedChange={() => onSelect(id)} />
                    </div>
                    <div className="w-full">
                        <h3 className="font-bold text-slate-800 text-base mb-1">{title}</h3>
                        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
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

            <div className={`grid ${endDate ? 'grid-cols-3' : 'grid-cols-2'} gap-2 mb-3 bg-slate-50 p-3 rounded-lg`}>
                <div className="text-xs">
                    <span className="text-slate-400 block mb-0.5">{endDate ? '開始日期' : '日期'}</span>
                    <span className="font-mono text-slate-700">{date}</span>
                </div>
                {endDate && (
                    <div className="text-xs">
                        <span className="text-slate-400 block mb-0.5">結束日期</span>
                        <span className="font-mono text-slate-700">{endDate}</span>
                    </div>
                )}
                {time && (
                    <div className="text-xs">
                        <span className="text-slate-400 block mb-0.5">時間</span>
                        <span className="font-mono text-slate-700">{time}</span>
                    </div>
                )}
            </div>

            <div className="space-y-2 text-sm text-slate-600">
                {details.map((detail, index) => (
                    <div key={index} className="flex items-start gap-2">
                        <span className="text-slate-400 min-w-[60px]">{detail.label}：</span>
                        <span className="flex-1 {detail.label === '內容' ? 'line-clamp-2' : ''}">{detail.value || '-'}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
