// Engineering Work History Page - Client Component
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { format, subDays } from 'date-fns'
import { motion } from 'framer-motion'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import {
    HardHat, ArrowLeft, Search, ChevronLeft, ChevronRight,
    RefreshCw, Download, Filter
} from 'lucide-react'
import { MobileTableCard } from '@/components/MobileTableCard'
import { EmptyState } from '@/components/EmptyState'
import { SkeletonTable } from '@/components/SkeletonTable'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { DataTablePagination } from '@/components/DataTablePagination'
import { useToast } from '@/hooks/use-toast'
import { SortableTableHead } from '@/components/ui/sortable-table-head'

interface EngineeringHistoryRecord {
    id: string
    created_at: string
    start_date: string
    end_date: string
    time: string | null
    vendor_name: string
    work_content: string
    unit: string
    engineering_contact: string
    note: string | null
}

export default function EngineeringHistoryClient() {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()

    const [data, setData] = useState<EngineeringHistoryRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [totalCount, setTotalCount] = useState(0)

    // 選取狀態
    const [selected, setSelected] = useState<Set<string>>(new Set())

    const [isFiltersOpen, setIsFiltersOpen] = useState(false)
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [keyword, setKeyword] = useState('')

    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)

    const totalPages = Math.ceil(totalCount / pageSize)

    // 排序狀態
    const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
    const handleSort = (key: string) => {
        setSort(prev => {
            if (prev?.key === key && prev.direction === 'asc') return { key, direction: 'desc' }
            if (prev?.key === key && prev.direction === 'desc') return null
            return { key, direction: 'asc' }
        })
    }
    // 即時過濾資料
    const filteredData = useMemo(() => {
        const kw = keyword.toLowerCase().trim()
        if (!kw) return data
        return data.filter(row => 
            row.vendor_name?.toLowerCase().includes(kw) ||
            row.work_content?.toLowerCase().includes(kw) ||
            row.unit?.toLowerCase().includes(kw) ||
            row.engineering_contact?.toLowerCase().includes(kw) ||
            row.note?.toLowerCase().includes(kw)
        )
    }, [data, keyword])

    const sortedData = useMemo(() => {
        const source = filteredData
        if (!sort) return source
        return [...source].sort((a, b) => {
            const valA = (a as any)[sort.key] ?? ''
            const valB = (b as any)[sort.key] ?? ''
            if (valA < valB) return sort.direction === 'asc' ? -1 : 1
            if (valA > valB) return sort.direction === 'asc' ? 1 : -1
            return 0
        })
    }, [filteredData, sort])

    // 選取功能
    const toggleSelect = (id: string) => {
        const newSet = new Set(selected)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setSelected(newSet)
    }

    const toggleSelectAll = () => {
        if (selected.size === data.length && data.length > 0) {
            setSelected(new Set())
        } else {
            setSelected(new Set(data.map(i => i.id)))
        }
    }

    const fetchData = async () => {
        setLoading(true)

        let query = supabase
            .from('engineering_work_history')
            .select('*', { count: 'exact' })
            .gte('start_date', startDate)
            .lte('start_date', endDate)
            .order('start_date', { ascending: false })
            .order('created_at', { ascending: false })
            .range((page - 1) * pageSize, page * pageSize - 1)

        // 關鍵字搜尋改在前端處理，這裡不帶 or 條件
        const { data: records, count, error } = await query

        if (error) {
            console.error('Fetch error:', error)
        } else {
            setData(records || [])
            setTotalCount(count || 0)
        }

        setSelected(new Set())
        setLoading(false)
    }

    useEffect(() => {
        fetchData()
    }, [page, pageSize, startDate, endDate])

    // handleSearch 已經不需要，改為偵測關鍵字變動

    // 匯出 Excel
    const handleExport = async () => {
        let dataToExport: EngineeringHistoryRecord[] = []

        if (selected.size > 0) {
            dataToExport = data.filter(r => selected.has(r.id))
        } else {
            let query = supabase
                .from('engineering_work_history')
                .select('*')
                .gte('start_date', startDate)
                .lte('start_date', endDate)
                .order('start_date', { ascending: false })

            if (keyword.trim()) {
                query = query.or(`vendor_name.ilike.%${keyword}%,work_content.ilike.%${keyword}%,unit.ilike.%${keyword}%,engineering_contact.ilike.%${keyword}%,note.ilike.%${keyword}%`)
            }

            const { data: allData } = await query
            dataToExport = allData || []
        }

        if (dataToExport.length === 0) {
            toast({ title: '無資料可匯出', variant: 'destructive' })
            return
        }

        const sheetData = dataToExport.map((row, index) => ({
            '#': index + 1,
            'ID': row.id,
            '建立時間': row.created_at ? format(new Date(row.created_at), 'yyyy-MM-dd HH:mm:ss') : '',
            '開始日期': row.start_date,
            '結束日期': row.end_date,
            '時間': row.time || '',
            '廠商': row.vendor_name,
            '單位': row.unit,
            '負責人': row.engineering_contact,
            '施工內容': row.work_content || '',
            '備註': row.note || ''
        }))

        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.json_to_sheet(sheetData)
        const wscols = Object.keys(sheetData[0] || {}).map(() => ({ wch: 15 }))
        ws['!cols'] = wscols
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
        saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `工務施工歷史_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`)


        toast({ title: '匯出成功', description: `已匯出 ${dataToExport.length} 筆資料` })
    }

    return (
        <div className="min-h-screen bg-muted">
            <header className="glass border-b border-border/50 px-6 py-4 flex justify-between items-center shadow-card sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        返回首頁
                    </Button>
                    <div className="h-6 w-px bg-border" />
                    <h1 className="text-lg font-black text-foreground flex items-center gap-2">
                        <HardHat className="w-5 h-5 text-amber-500" />
                        工務施工歷史記錄
                    </h1>
                </div>
            </header>

            <main className="p-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card rounded-2xl shadow-card border border-border"
                >
                    <div className="p-4 border-b border-border/50">
                        <div className="flex flex-wrap items-end gap-4">
                            <div className="flex w-full md:hidden justify-between items-center mb-2">
                                <Button size="sm" variant="outline" onClick={() => setIsFiltersOpen(!isFiltersOpen)} className="w-full">
                                    <Filter className="w-4 h-4 mr-2" />
                                    {isFiltersOpen ? '隱藏篩選' : '顯示篩選'}
                                </Button>
                            </div>
                            <div className={`flex-col md:flex-row flex-wrap items-stretch md:items-end gap-4 w-full md:w-auto ${isFiltersOpen ? 'flex' : 'hidden md:flex'}`}>
                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">開始日期</Label><Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className="w-full md:w-40" /></div>
                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">結束日期</Label><Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className="w-full md:w-40" /></div>
                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">關鍵字搜尋</Label><Input type="text" placeholder="廠商、單位、施工內容..." value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }} className="w-full md:w-60" /></div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                                <Button variant="outline" onClick={handleExport}><Download className="w-4 h-4 mr-1" />匯出</Button>
                                <Badge variant="outline">{totalCount} 筆</Badge>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <SkeletonTable />
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <Table className="hidden md:table">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-12"><Checkbox checked={selected.size === data.length && data.length > 0} onCheckedChange={toggleSelectAll} /></TableHead>
                                            <TableHead className="w-12">#</TableHead>
                                            <SortableTableHead label="建立時間" sortKey="created_at" currentSort={sort} onSort={handleSort} />
                                            <SortableTableHead label="開始日期" sortKey="start_date" currentSort={sort} onSort={handleSort} />
                                            <SortableTableHead label="結束日期" sortKey="end_date" currentSort={sort} onSort={handleSort} />
                                            <SortableTableHead label="時間" sortKey="time" currentSort={sort} onSort={handleSort} />
                                            <SortableTableHead label="廠商" sortKey="vendor_name" currentSort={sort} onSort={handleSort} />
                                            <SortableTableHead label="單位" sortKey="unit" currentSort={sort} onSort={handleSort} />
                                            <SortableTableHead label="負責人" sortKey="engineering_contact" currentSort={sort} onSort={handleSort} />
                                            <TableHead>施工內容</TableHead>
                                            <TableHead>備註</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedData.length === 0 ? (
                                            <TableRow><TableCell colSpan={11} className="p-0"><EmptyState icon={HardHat} title="查無歷史紀錄" description="在選定的日期範圍內沒有找到相關歷史紀錄。" /></TableCell></TableRow>
                                        ) : (
                                            sortedData.map((row, index) => (
                                                <TableRow key={row.id} className={`hover:bg-amber-50/50 dark:hover:bg-amber-900/20 transition-colors even:bg-muted/20 dark:even:bg-muted/10 ${selected.has(row.id) ? 'bg-amber-100 dark:bg-amber-900/40' : ''}`}>
                                                    <TableCell><Checkbox checked={selected.has(row.id)} onCheckedChange={() => toggleSelect(row.id)} /></TableCell>
                                                    <TableCell className="text-muted-foreground dark:text-muted-foreground/70 text-sm">{(page - 1) * pageSize + index + 1}</TableCell>
                                                    <TableCell className="font-mono text-xs text-muted-foreground dark:text-gray-300 whitespace-nowrap relative pl-6">
                                                        <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-400 ring-4 ring-amber-50 dark:ring-amber-950" />
                                                        {row.created_at ? format(new Date(row.created_at), 'yyyy-MM-dd HH:mm') : '-'}
                                                    </TableCell>
                                                    <TableCell className="font-mono dark:text-gray-200">{row.start_date}</TableCell>
                                                    <TableCell className="font-mono dark:text-gray-200">{row.end_date}</TableCell>
                                                    <TableCell className="font-mono dark:text-gray-200">{row.time?.slice(0, 5) || '-'}</TableCell>
                                                    <TableCell className="font-bold dark:text-gray-100">{row.vendor_name}</TableCell>
                                                    <TableCell><Badge variant="outline" className="dark:border-amber-700 dark:text-amber-400">{row.unit}</Badge></TableCell>
                                                    <TableCell className="dark:text-gray-200">{row.engineering_contact}</TableCell>
                                                    <TableCell className="max-w-xs truncate dark:text-gray-200" title={row.work_content}>{row.work_content}</TableCell>
                                                    <TableCell className="text-muted-foreground dark:text-gray-400 text-xs max-w-32 truncate" title={row.note || ''}>{row.note || '-'}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>

                                {/* 手機版卡片列表 */}
                                <div className="md:hidden mt-4 space-y-4 px-1 pb-4 relative before:absolute before:inset-y-0 before:left-4 before:w-0.5 before:bg-border">
                                    {sortedData.length === 0 ? (
                                        <EmptyState icon={HardHat} title="查無歷史紀錄" description="在選定的日期範圍內沒有找到相關歷史紀錄。" />
                                    ) : (
                                        sortedData.map((row: EngineeringHistoryRecord) => (
                                            <MobileTableCard
                                                key={row.id}
                                                id={row.id}
                                                title={row.vendor_name}
                                                subtitle={row.engineering_contact}
                                                status={{
                                                    label: row.unit,
                                                    variant: 'outline' as const,
                                                    className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800'
                                                }}
                                                date={row.start_date}
                                                endDate={row.end_date}
                                                time={row.time?.slice(0, 5) || '-'}
                                                isSelected={selected.has(row.id)}
                                                onSelect={() => toggleSelect(row.id)}
                                                details={[
                                                    { label: '建立時間', value: row.created_at ? format(new Date(row.created_at), 'yyyy-MM-dd HH:mm') : '-' },
                                                    { label: '施工內容', value: row.work_content },
                                                    { label: '備註', value: row.note },
                                                ]}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    <div className="p-4 border-t border-border/50">
                        <DataTablePagination
                            currentPage={page}
                            totalPages={totalPages}
                            totalItems={totalCount}
                            itemsPerPage={pageSize}
                            onPageChange={setPage}
                            onItemsPerPageChange={(size) => {
                                setPageSize(size)
                                setPage(1)
                            }}
                            selectedCount={selected.size}
                        />
                    </div>
                </motion.div>
            </main>
        </div>
    )
}
