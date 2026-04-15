// Work Report List - Client Component
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { format, subDays } from 'date-fns'
import { motion } from 'framer-motion'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { ClipboardCheck, ArrowLeft, Search, ChevronLeft, ChevronRight, RefreshCw, Plus, Pencil, Trash2, Download, Filter, FileText } from 'lucide-react'
import { MobileTableCard } from '@/components/MobileTableCard'
import { EmptyState } from '@/components/EmptyState'
import { createClient } from '@/lib/supabase/client'
import { sendTelegramNotify, formatDeleteMessage, WORK_REPORT_LABELS } from '@/lib/telegram-notify'
import { logBatchDeleteRecords } from '@/lib/change-log'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataTablePagination } from '@/components/DataTablePagination'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { SkeletonTable } from '@/components/SkeletonTable'

interface WorkReportRecord {
    id: string; created_at: string; report_date: string; report_time: string | null; vendor_name: string
    work_location: string; engineering_contact: string; work_content: string; work_status: 'completed' | 'incomplete' | 'abnormal'; note: string | null
}

const statusLabels: Record<string, { text: string; variant: 'default' | 'secondary' | 'destructive' }> = {
    completed: { text: '完成', variant: 'default' },
    incomplete: { text: '未完成', variant: 'secondary' },
    abnormal: { text: '異常', variant: 'destructive' },
}

export default function WorkReportClient() {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()
    const [data, setData] = useState<WorkReportRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [totalCount, setTotalCount] = useState(0)
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [isFiltersOpen, setIsFiltersOpen] = useState(false)
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [keyword, setKeyword] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const totalPages = Math.ceil(totalCount / pageSize)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

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
            row.work_location?.toLowerCase().includes(kw) ||
            row.engineering_contact?.toLowerCase().includes(kw) ||
            row.note?.toLowerCase().includes(kw) ||
            statusLabels[row.work_status]?.text.toLowerCase().includes(kw)
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

    const toggleSelect = (id: string) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s) }
    const toggleSelectAll = () => { selected.size === data.length && data.length > 0 ? setSelected(new Set()) : setSelected(new Set(data.map(i => i.id))) }

    const fetchData = async () => {
        setLoading(true)
        let q = supabase.from('work_report').select('*', { count: 'exact' })
            .gte('report_date', startDate).lte('report_date', endDate)
            .order('report_date', { ascending: false }).order('created_at', { ascending: false })
            .range((page - 1) * pageSize, page * pageSize - 1)
        
        // 關鍵字搜尋改在前端處理，這裡不帶 or 條件
        if (statusFilter !== 'all') q = q.eq('work_status', statusFilter)
        
        const { data: records, count, error } = await q
        if (error) { toast({ title: '載入失敗', description: error.message, variant: 'destructive' }) }
        else { setData(records || []); setTotalCount(count || 0) }
        setSelected(new Set()); setLoading(false)
    }

    const handleDelete = async (id?: string) => {
        const ids = id ? [id] : Array.from(selected)
        if (ids.length === 0) return

        // 在刪除前收集被刪除項目的資料（供通知使用）
        const deletedItems = data.filter(item => ids.includes(item.id))

        const { error } = await supabase.from('work_report').delete().in('id', ids)
        if (error) {
            toast({ title: '刪除失敗', description: error.message, variant: 'destructive' })
        } else {
            // 發送 Telegram 刪除通知
            sendTelegramNotify(formatDeleteMessage('施工回報記錄', deletedItems, WORK_REPORT_LABELS))

            // 寫入系統異動紀錄
            logBatchDeleteRecords('work_report', deletedItems)

            toast({ title: '刪除成功' })
            fetchData()
        }
        setDeleteDialogOpen(false)
    }

    useEffect(() => { fetchData() }, [page, pageSize, startDate, endDate, statusFilter])

    const handleExport = async () => {
        let dataToExport: WorkReportRecord[] = []
        if (selected.size > 0) { dataToExport = data.filter(r => selected.has(r.id)) }
        else {
            let q = supabase.from('work_report').select('*').gte('report_date', startDate).lte('report_date', endDate).order('report_date', { ascending: false })
            if (keyword.trim()) q = q.or(`vendor_name.ilike.%${keyword}%,work_content.ilike.%${keyword}%,work_location.ilike.%${keyword}%,engineering_contact.ilike.%${keyword}%,work_status.ilike.%${keyword}%,note.ilike.%${keyword}%`)
            if (statusFilter !== 'all') q = q.eq('work_status', statusFilter)
            const { data: allData } = await q; dataToExport = allData || []
        }
        if (dataToExport.length === 0) { toast({ title: '無資料可匯出', variant: 'destructive' }); return }
        const sheetData = dataToExport.map((r, i) => ({ '#': i + 1, 'ID': r.id, '建立時間': r.created_at ? format(new Date(r.created_at), 'yyyy-MM-dd HH:mm:ss') : '', '日期': r.report_date, '時間': r.report_time || '', '廠商': r.vendor_name, '地點': r.work_location, '負責人': r.engineering_contact, '狀態': statusLabels[r.work_status]?.text || r.work_status, '施工內容': r.work_content || '', '備註': r.note || '' }))
        const wb = XLSX.utils.book_new(); const ws = XLSX.utils.json_to_sheet(sheetData)
        ws['!cols'] = Object.keys(sheetData[0] || {}).map(() => ({ wch: 15 }))
        ws['!cols'] = Object.keys(sheetData[0] || {}).map(() => ({ wch: 15 }))
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
        saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `施工回報_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`)

        toast({ title: '匯出成功', description: `已匯出 ${dataToExport.length} 筆資料` })
    }

    return (
        <div className="min-h-screen bg-muted">
            <header className="glass border-b border-border/50 px-6 py-4 flex justify-between items-center shadow-card sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.push('/')}><ArrowLeft className="w-4 h-4 mr-1" />返回首頁</Button>
                    <div className="h-6 w-px bg-border" />
                    <h1 className="text-lg font-black text-foreground flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-indigo-500" />施工回報管理</h1>
                </div>
                <Button onClick={() => router.push('/work-report/new')} className="bg-indigo-600 hover:bg-indigo-700"><Plus className="w-4 h-4 mr-1" />新增回報</Button>
            </header>
            <main className="p-6">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl shadow-card border border-border">
                    <div className="p-4 border-b border-border/50">
                        <div className="flex flex-wrap items-end gap-4">
                            {/* 手機版篩選切換 */}
                            <div className="flex w-full md:hidden justify-between items-center mb-2">
                                <Button size="sm" variant="outline" onClick={() => setIsFiltersOpen(!isFiltersOpen)} className="w-full">
                                    <Filter className="w-4 h-4 mr-2" />
                                    {isFiltersOpen ? '隱藏篩選' : '顯示篩選'}
                                </Button>
                            </div>
                            <div className={`flex-col md:flex-row flex-wrap items-stretch md:items-end gap-4 w-full md:w-auto ${isFiltersOpen ? 'flex' : 'hidden md:flex'}`}>
                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">開始日期</Label><Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className="w-full md:w-40" /></div>
                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">結束日期</Label><Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className="w-full md:w-40" /></div>
                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">狀態</Label><Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}><SelectTrigger className="w-full md:w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部</SelectItem><SelectItem value="completed">完成</SelectItem><SelectItem value="incomplete">未完成</SelectItem><SelectItem value="abnormal">異常</SelectItem></SelectContent></Select></div>
                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">關鍵字搜尋</Label><Input type="text" placeholder="廠商、地點、內容..." value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }} className="w-full md:w-52" /></div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                                <Button variant="outline" onClick={handleExport}><Download className="w-4 h-4 mr-1" />匯出</Button>
                                <Button size="sm" variant="outline" onClick={() => { const id = Array.from(selected)[0]; if (id) router.push(`/work-report/${id}/edit`) }} disabled={selected.size !== 1}><Pencil className="w-4 h-4 mr-1" />修改</Button>
                                <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setDeleteDialogOpen(true)} disabled={selected.size === 0}><Trash2 className="w-4 h-4 mr-1" />刪除</Button>
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
                                    <TableHeader><TableRow>
                                        <TableHead className="w-12 sticky left-0 bg-card z-20"><Checkbox checked={selected.size === data.length && data.length > 0} onCheckedChange={toggleSelectAll} /></TableHead>
                                        <TableHead className="w-12">#</TableHead>
                                        <SortableTableHead label="日期" sortKey="report_date" currentSort={sort} onSort={handleSort} />
                                        <SortableTableHead label="時間" sortKey="report_time" currentSort={sort} onSort={handleSort} />
                                        <SortableTableHead label="廠商" sortKey="vendor_name" currentSort={sort} onSort={handleSort} />
                                        <SortableTableHead label="地點" sortKey="work_location" currentSort={sort} onSort={handleSort} />
                                        <SortableTableHead label="負責人" sortKey="engineering_contact" currentSort={sort} onSort={handleSort} />
                                        <SortableTableHead label="狀態" sortKey="work_status" currentSort={sort} onSort={handleSort} />
                                        <TableHead>施工內容</TableHead><TableHead>備註</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>
                                        {sortedData.length === 0 ? <TableRow><TableCell colSpan={10} className="p-0"><EmptyState icon={FileText} title="尚無施工回報" description="目前沒有施工回報記錄，您可以點擊右上方新增。" /></TableCell></TableRow>
                                            : sortedData.map((row, index) => (
                                                <TableRow key={row.id} className={`hover:bg-indigo-50/50 dark:hover:bg-indigo-900/40 transition-colors even:bg-muted/20 ${selected.has(row.id) ? 'bg-indigo-100 dark:bg-indigo-900/40' : ''}`}>
                                                    <TableCell className={`sticky left-0 z-10 ${selected.has(row.id) ? 'bg-indigo-100 dark:bg-indigo-900/40' : 'bg-card group-hover:bg-indigo-50/50 dark:group-hover:bg-indigo-900/40'}`}>
                                                        <Checkbox checked={selected.has(row.id)} onCheckedChange={() => toggleSelect(row.id)} />
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-sm">{(page - 1) * pageSize + index + 1}</TableCell>
                                                    <TableCell className="font-mono">{row.report_date}</TableCell><TableCell className="font-mono">{row.report_time?.slice(0, 5) || '-'}</TableCell>
                                                    <TableCell className="font-bold text-indigo-600 dark:text-indigo-400">{row.vendor_name}</TableCell><TableCell>{row.work_location}</TableCell><TableCell>{row.engineering_contact}</TableCell>
                                                    <TableCell><Badge variant={statusLabels[row.work_status]?.variant || 'secondary'}>{statusLabels[row.work_status]?.text || row.work_status}</Badge></TableCell>
                                                    <TableCell className="max-w-xs truncate" title={row.work_content}>{row.work_content}</TableCell><TableCell className="text-muted-foreground text-xs max-w-32 truncate" title={row.note || ''}>{row.note || '-'}</TableCell>
                                                </TableRow>
                                            ))}
                                    </TableBody>
                                </Table>

                                {/* 手機版卡片列表 */}
                                <div className="md:hidden mt-4 space-y-4 px-1 pb-4">
                                    {sortedData.length === 0 ? (
                                        <EmptyState icon={FileText} title="尚無施工回報" description="目前沒有施工回報記錄，您可以點擊右上方新增。" />
                                    ) : (
                                        sortedData.map((row: WorkReportRecord, index) => (
                                            <MobileTableCard
                                                key={row.id}
                                                id={row.id}
                                                title={`#${(page - 1) * pageSize + index + 1} ${row.vendor_name}`}
                                                subtitle={row.engineering_contact}
                                                status={{
                                                    label: statusLabels[row.work_status]?.text || row.work_status,
                                                    variant: statusLabels[row.work_status]?.variant || 'secondary',
                                                }}
                                                date={row.report_date}
                                                time={row.report_time?.slice(0, 5) || '-'}
                                                isSelected={selected.has(row.id)}
                                                onSelect={() => toggleSelect(row.id)}
                                                onClick={() => router.push(`/work-report/${row.id}/edit`)}
                                                details={[
                                                    { label: '地點', value: row.work_location },
                                                    { label: '施工內容', value: row.work_content },
                                                    { label: '備註', value: row.note },
                                                ]}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
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
                        </>
                    )}
                </motion.div>
            </main>
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>確認刪除？</AlertDialogTitle>
                        <AlertDialogDescription>此操作無法復原，確定要刪除選取的 {selected.size} 筆資料嗎？</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete()} className="bg-red-600 hover:bg-red-700">刪除</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
