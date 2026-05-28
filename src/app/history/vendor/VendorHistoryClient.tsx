// Vendor Work History Page - Client Component
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { format, subDays } from 'date-fns'
import { motion } from 'framer-motion'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import {
    Users, ArrowLeft, Search, ChevronLeft, ChevronRight,
    RefreshCw, Download, Filter
} from 'lucide-react'
import { MobileTableCard } from '@/components/MobileTableCard'
import { EmptyState } from '@/components/EmptyState'
import { SkeletonTable } from '@/components/SkeletonTable'
import { exportToExcelFile, exportToPdfFile } from '@/lib/export-utils'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"

import { createClient } from '@/lib/supabase/client'
import { formatItemsDisplay } from '@/lib/utils'
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

interface VendorHistoryRecord {
    id: string
    created_at: string
    entry_status: 'arrival' | 'departure'
    work_date: string
    arrival_time: string | null
    departure_time: string | null
    location: string | null
    vendor_badge_id: number | null
    head_count: number | null
    vendor_name: string
    vendor_contact: string | null
    vendor_contact_phone: string | null
    work_content: string | null
    note: string | null
    borrow_action?: 'none' | 'borrow' | 'return' | 'partial_return' | null
    borrowed_items?: string | null
    lender_name?: string | null
    returned_items?: string | null
    receiver_name?: string | null
}

const formatItems = (data: any): string => {
    if (!data) return ''
    if (typeof data === 'string') return data
    return formatItemsDisplay(data.items, data.other_text)
}

export default function VendorHistoryClient() {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()

    // Data state
    const [data, setData] = useState<VendorHistoryRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [totalCount, setTotalCount] = useState(0)

    // 選取狀態
    const [selected, setSelected] = useState<Set<string>>(new Set())

    // Filter state
    const [isFiltersOpen, setIsFiltersOpen] = useState(false)
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [keyword, setKeyword] = useState('')

    // Pagination state
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
            row.note?.toLowerCase().includes(kw) ||
            row.vendor_contact?.toLowerCase().includes(kw) ||
            row.vendor_contact_phone?.toLowerCase().includes(kw) ||
            row.location?.toLowerCase().includes(kw) ||
            (row.entry_status === 'arrival' ? '到院' : '離院').includes(kw)
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

    // Fetch data
    const fetchData = async () => {
        setLoading(true)

        let query = supabase
            .from('vendor_today_work_history')
            .select('*', { count: 'exact' })
            .gte('work_date', startDate)
            .lte('work_date', endDate)
            .order('work_date', { ascending: false })
            .order('created_at', { ascending: false })
            .range((page - 1) * pageSize, page * pageSize - 1)

        // 關鍵字搜尋改在前端處理，這裡不帶 or 條件以便維持分頁的一致性
        // (或者若要完全即時，可不設 range 抓取全部，但歷史紀錄考量效能暫維持分頁+前端過濾當前頁)
        // 註：若使用者需要過濾全部，則必須加大 pageSize 或移除 range。
        // 為對齊「異動紀錄(大資料量前端過濾)」模式，我們移除 range 或是抓取較大的 chunk

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

    // Initial fetch
    useEffect(() => {
        fetchData()
    }, [page, pageSize, startDate, endDate])

    // handleSearch 已經不需要，改為偵測關鍵字變動

    // 匯出 Excel
    const exportToExcel = async () => {
        let dataToExport: VendorHistoryRecord[] = []

        if (selected.size > 0) {
            dataToExport = data.filter(r => selected.has(r.id))
        } else {
            // Fetch all data for export
            let query = supabase
                .from('vendor_today_work_history')
                .select('*')
                .gte('work_date', startDate)
                .lte('work_date', endDate)
                .order('work_date', { ascending: false })

            if (keyword.trim()) {
                query = query.or(`vendor_name.ilike.%${keyword}%,work_content.ilike.%${keyword}%,note.ilike.%${keyword}%,entry_status.ilike.%${keyword}%,location.ilike.%${keyword}%,vendor_badge_id.ilike.%${keyword}%,vendor_phone.ilike.%${keyword}%`)
            }

            const { data: allData } = await query
            dataToExport = allData || []
        }

        if (dataToExport.length === 0) {
            toast({ title: '無資料可匯出', variant: 'destructive' })
            return
        }

        // 轉換為 Excel 格式
        const sheetData = dataToExport.map((row, index) => ({
            '#': index + 1,
            'ID': row.id,
            '建立時間': row.created_at ? format(new Date(row.created_at), 'yyyy-MM-dd HH:mm:ss') : '',
            '到院或離院': row.entry_status === 'arrival' ? '到院' : '離院',
            '施工日期': row.work_date,
            '到院時間': row.arrival_time || '',
            '離院時間': row.departure_time || '',
            '廠商名稱': row.vendor_name,
            '廠商工作證號': row.vendor_badge_id || '',
            '廠商負責人員姓名': row.vendor_contact || '',
            '廠商負責人員電話': row.vendor_contact_phone || '',
            '施工地點': row.location || '',
            '施工人數': row.head_count || '',
            '施工內容': row.work_content || '',
            '備註': row.note || '',
            '借用動作': row.borrow_action === 'borrow' ? '借物中' : row.borrow_action === 'return' ? '已歸還' : row.borrow_action === 'partial_return' ? '部份未歸還' : '未借物',
            '借出項目': formatItems(row.borrowed_items),
            '借出人員': row.lender_name || '',
            '歸還項目': formatItems(row.returned_items),
            '歸還人員': row.receiver_name || ''
        }))

        exportToExcelFile(sheetData, '廠商施工歷史')
        toast({ title: '匯出成功', description: `已匯出 ${dataToExport.length} 筆資料` })
    }

    // 匯出 PDF
    const exportToPdf = async () => {
        let dataToExport: VendorHistoryRecord[] = []

        if (selected.size > 0) {
            dataToExport = data.filter(r => selected.has(r.id))
        } else {
            // Fetch all data for export
            let query = supabase
                .from('vendor_today_work_history')
                .select('*')
                .gte('work_date', startDate)
                .lte('work_date', endDate)
                .order('work_date', { ascending: false })

            if (keyword.trim()) {
                query = query.or(`vendor_name.ilike.%${keyword}%,work_content.ilike.%${keyword}%,note.ilike.%${keyword}%,entry_status.ilike.%${keyword}%,location.ilike.%${keyword}%,vendor_badge_id.ilike.%${keyword}%,vendor_phone.ilike.%${keyword}%`)
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
            '狀態': row.entry_status === 'arrival' ? '到院' : '離院',
            '施工日期': row.work_date,
            '到院時間': row.arrival_time || '',
            '離院時間': row.departure_time || '',
            '廠商名稱': row.vendor_name,
            '廠商工作證號': row.vendor_badge_id || '',
            '廠商負責人員姓名': row.vendor_contact || '',
            '廠商負責人員電話': row.vendor_contact_phone || '',
            '施工地點': row.location || '',
            '施工人數': row.head_count || '',
            '施工內容': row.work_content || '',
            '備註': row.note || '',
            '借用動作': row.borrow_action === 'borrow' ? '借物中' : row.borrow_action === 'return' ? '已歸還' : row.borrow_action === 'partial_return' ? '部份未歸還' : '未借物',
            '借出項目': formatItems(row.borrowed_items),
            '借出人員': row.lender_name || '',
            '歸還項目': formatItems(row.returned_items),
            '歸還人員': row.receiver_name || ''
        }))

        toast({ title: '正在準備匯出 PDF...', description: '正在載入中文字型，請稍候...' })

        try {
            await exportToPdfFile({
                title: '廠商施工歷史記錄列表',
                sheetData,
                filenamePrefix: '廠商施工歷史',
                orientation: 'landscape',
                themeColor: [37, 99, 235], // 藍色品牌色
                excludeColumns: []
            })
            toast({ title: 'PDF 匯出成功', description: `已匯出 ${dataToExport.length} 筆資料` })
        } catch (error: any) {
            toast({ title: 'PDF 匯出失敗', description: error.message, variant: 'destructive' })
        }
    }

    return (
        <div className="min-h-screen bg-muted">
            {/* Header */}
            <header className="glass border-b border-border/50 px-6 py-4 flex justify-between items-center shadow-card sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        返回首頁
                    </Button>
                    <div className="h-6 w-px bg-border" />
                    <h1 className="text-lg font-black text-foreground flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-500" />
                        廠商施工歷史記錄
                    </h1>
                </div>
            </header>

            {/* Main Content */}
            <main className="p-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card rounded-2xl shadow-card border border-border"
                >
                    {/* Filter Bar */}
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
                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">關鍵字搜尋</Label><Input type="text" placeholder="廠商名稱、施工內容..." value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }} className="w-full md:w-60" /></div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm">
                                            <Download className="w-4 h-4 mr-1" /> 匯出
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={exportToExcel}>
                                            匯出 Excel
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={exportToPdf}>
                                            匯出 PDF
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <Badge variant="outline">{totalCount} 筆</Badge>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
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
                                            <SortableTableHead label="狀態" sortKey="entry_status" currentSort={sort} onSort={handleSort} />
                                            <SortableTableHead label="日期" sortKey="work_date" currentSort={sort} onSort={handleSort} />
                                            <SortableTableHead label="到院時間" sortKey="arrival_time" currentSort={sort} onSort={handleSort} />
                                            <SortableTableHead label="離院時間" sortKey="departure_time" currentSort={sort} onSort={handleSort} />
                                            <SortableTableHead label="廠商名稱" sortKey="vendor_name" currentSort={sort} onSort={handleSort} />
                                            <SortableTableHead label="廠商工作證號" sortKey="vendor_badge_id" currentSort={sort} onSort={handleSort} />
                                            <SortableTableHead label="廠商負責人員姓名" sortKey="vendor_contact" currentSort={sort} onSort={handleSort} />
                                            <TableHead>廠商負責人員電話</TableHead>
                                            <SortableTableHead label="施工地點" sortKey="location" currentSort={sort} onSort={handleSort} />
                                            <SortableTableHead label="施工人數" sortKey="head_count" currentSort={sort} onSort={handleSort} />
                                            <TableHead>施工內容</TableHead>
                                            <TableHead>備註</TableHead>
                                            <TableHead>借用動作</TableHead>
                                            <TableHead>借出項目</TableHead>
                                            <TableHead>借出人員</TableHead>
                                            <TableHead>歸還項目</TableHead>
                                            <TableHead>歸還人員</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedData.length === 0 ? (
                                            <TableRow><TableCell colSpan={20} className="p-0"><EmptyState icon={Users} title="查無歷史紀錄" description="在選定的日期範圍內沒有找到相關歷史紀錄。" /></TableCell></TableRow>
                                        ) : (
                                            sortedData.map((row, index) => (
                                                <TableRow key={row.id} className={`hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors even:bg-muted/20 dark:even:bg-muted/10 ${selected.has(row.id) ? 'bg-blue-100 dark:bg-blue-900/40' : ''}`}>
                                                    <TableCell><Checkbox checked={selected.has(row.id)} onCheckedChange={() => toggleSelect(row.id)} /></TableCell>
                                                    <TableCell className="text-muted-foreground dark:text-muted-foreground/70 text-sm">{(page - 1) * pageSize + index + 1}</TableCell>
                                                    <TableCell className="font-mono text-xs text-muted-foreground dark:text-gray-300 whitespace-nowrap relative pl-6">
                                                        <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-400 ring-4 ring-blue-50 dark:ring-blue-950" />
                                                        {row.created_at ? format(new Date(row.created_at), 'yyyy-MM-dd HH:mm') : '-'}
                                                    </TableCell>
                                                    <TableCell><Badge variant={row.entry_status === 'arrival' ? 'default' : 'secondary'} className={row.entry_status === 'arrival' ? 'dark:bg-blue-600 dark:text-white' : 'dark:bg-gray-800 dark:text-gray-300'}>{row.entry_status === 'arrival' ? '到院' : '離院'}</Badge></TableCell>
                                                    <TableCell className="font-mono dark:text-gray-200">{row.work_date}</TableCell>
                                                    <TableCell className="font-mono dark:text-gray-200">{row.arrival_time?.slice(0, 5) || '-'}</TableCell>
                                                    <TableCell className="font-mono dark:text-gray-200">{row.departure_time?.slice(0, 5) || '-'}</TableCell>
                                                    <TableCell className="font-bold dark:text-gray-100">{row.vendor_name}</TableCell>
                                                    <TableCell className="font-mono dark:text-gray-200">{row.vendor_badge_id || '-'}</TableCell>
                                                    <TableCell className="dark:text-gray-200">{row.vendor_contact || '-'}</TableCell>
                                                    <TableCell className="font-mono dark:text-gray-200">{row.vendor_contact_phone || '-'}</TableCell>
                                                    <TableCell className="dark:text-gray-200">{row.location || '-'}</TableCell>
                                                    <TableCell className="dark:text-gray-200">{row.head_count || '-'}</TableCell>
                                                    <TableCell className="max-w-xs truncate dark:text-gray-200" title={row.work_content || ''}>{row.work_content || '-'}</TableCell>
                                                    <TableCell className="text-muted-foreground dark:text-gray-400 text-xs max-w-32 truncate" title={row.note || ''}>{row.note || '-'}</TableCell>
                                                    <TableCell>
                                                        {row.borrow_action === 'borrow' && <Badge className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300">借物中</Badge>}
                                                        {row.borrow_action === 'return' && <Badge className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-300">已歸還</Badge>}
                                                        {row.borrow_action === 'partial_return' && <Badge className="bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/40 dark:text-orange-300">部份未歸還</Badge>}
                                                        {(!row.borrow_action || row.borrow_action === 'none') && <Badge variant="outline" className="text-muted-foreground dark:text-gray-400">未借物</Badge>}
                                                    </TableCell>
                                                    <TableCell className="max-w-32 truncate dark:text-gray-200" title={formatItems(row.borrowed_items)}>{formatItems(row.borrowed_items) || '-'}</TableCell>
                                                    <TableCell className="dark:text-gray-200">{row.lender_name || '-'}</TableCell>
                                                    <TableCell className="max-w-32 truncate dark:text-gray-200" title={formatItems(row.returned_items)}>{formatItems(row.returned_items) || '-'}</TableCell>
                                                    <TableCell className="dark:text-gray-200">{row.receiver_name || '-'}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>

                                {/* 手機版卡片列表 */}
                                <div className="md:hidden mt-4 space-y-4 px-1 pb-4 relative before:absolute before:inset-y-0 before:left-4 before:w-0.5 before:bg-border">
                                    {sortedData.length > 0 && (
                                        <div className="flex items-center justify-between bg-card p-3 rounded-xl border border-border/80 shadow-sm mb-3">
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    id="mobile-select-all"
                                                    checked={selected.size === sortedData.length && sortedData.length > 0}
                                                    onCheckedChange={toggleSelectAll}
                                                />
                                                <Label htmlFor="mobile-select-all" className="text-sm font-medium cursor-pointer select-none">
                                                    全選({selected.size}/{sortedData.length})
                                                </Label>
                                            </div>
                                            {selected.size > 0 && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setSelected(new Set())}
                                                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                                                >
                                                    取消選擇
                                                </Button>
                                            )}
                                        </div>
                                    )}

                                    {sortedData.length === 0 ? (
                                        <EmptyState icon={Users} title="查無歷史紀錄" description="在選定的日期範圍內沒有找到相關歷史紀錄。" />
                                    ) : (
                                        sortedData.map((row: VendorHistoryRecord, index) => (
                                            <MobileTableCard
                                                key={row.id}
                                                id={row.id}
                                                title={`#${(page - 1) * pageSize + index + 1} ${row.vendor_name}`}
                                                subtitle={row.vendor_contact || undefined}
                                                status={{
                                                    label: row.entry_status === 'arrival' ? '到院' : '離院',
                                                    variant: row.entry_status === 'arrival' ? 'default' : 'secondary',
                                                }}
                                                date={row.work_date}
                                                time={row.arrival_time?.slice(0, 5) || '-'}
                                                isSelected={selected.has(row.id)}
                                                onSelect={() => toggleSelect(row.id)}
                                                details={[
                                                    { label: '建立時間', value: row.created_at ? format(new Date(row.created_at), 'yyyy-MM-dd HH:mm') : '-' },
                                                    { label: '離院時間', value: row.departure_time?.slice(0, 5) || '-' },
                                                    { label: '工作證號', value: row.vendor_badge_id?.toString() || '-' },
                                                    { label: '聯絡人', value: row.vendor_contact },
                                                    { label: '聯絡電話', value: row.vendor_contact_phone },
                                                    { label: '地點', value: row.location },
                                                    { label: '人數', value: row.head_count?.toString() || '-' },
                                                    { label: '內容', value: row.work_content },
                                                    { label: '備註', value: row.note },
                                                    {
                                                        label: '借用動作',
                                                        value: (
                                                            <div className="flex gap-1">
                                                                {row.borrow_action === 'borrow' && <Badge className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300">借物中</Badge>}
                                                                {row.borrow_action === 'return' && <Badge className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-300">已歸還</Badge>}
                                                                {row.borrow_action === 'partial_return' && <Badge className="bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/40 dark:text-orange-300">部份未歸還</Badge>}
                                                                {(!row.borrow_action || row.borrow_action === 'none') && <Badge variant="outline" className="text-muted-foreground dark:text-gray-400">未借物</Badge>}
                                                            </div>
                                                        )
                                                    },
                                                    { label: '借出項目', value: formatItems(row.borrowed_items) },
                                                    { label: '借出人員', value: row.lender_name },
                                                    { label: '歸還項目', value: formatItems(row.returned_items) },
                                                    { label: '歸還人員', value: row.receiver_name },
                                                ]}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Pagination */}
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
