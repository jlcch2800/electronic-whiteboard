import { TableHead } from "@/components/ui/table"
import { ArrowUpDown, ArrowDown, ArrowUp } from "lucide-react"

interface SortableTableHeadProps {
    label: string
    sortKey: string
    currentSort: { key: string; direction: 'asc' | 'desc' } | null
    onSort: (key: string) => void
    className?: string
}

export function SortableTableHead({ label, sortKey, currentSort, onSort, className = '' }: SortableTableHeadProps) {
    const isSorted = currentSort?.key === sortKey
    return (
        <TableHead className={`${className} cursor-pointer hover:bg-muted/50 transition-colors group select-none`} onClick={() => onSort(sortKey)}>
            <div className="flex items-center gap-1">
                {label}
                {isSorted ? (
                    currentSort.direction === 'desc' ? <ArrowDown className="w-3.5 h-3.5 text-blue-600" /> : <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                ) : (
                    <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
            </div>
        </TableHead>
    )
}
