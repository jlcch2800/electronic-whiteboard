// Work Report List - Client Component
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format, subDays } from 'date-fns'
import { motion } from 'framer-motion'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { ClipboardCheck, ArrowLeft, Search, ChevronLeft, ChevronRight, RefreshCw, Plus, Pencil, Trash2, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
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
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [keyword, setKeyword] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const totalPages = Math.ceil(totalCount / pageSize)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

    const toggleSelect = (id: string) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s) }
    const toggleSelectAll = () => { selected.size === data.length && data.length > 0 ? setSelected(new Set()) : setSelected(new Set(data.map(i => i.id))) }

    const fetchData = async () => {
        setLoading(true)
        let q = supabase.from('work_report').select('*', { count: 'exact' })
            .gte('report_date', startDate).lte('report_date', endDate)
            .order('report_date', { ascending: false }).order('created_at', { ascending: false })
            .range((page - 1) * pageSize, page * pageSize - 1)
        if (keyword.trim()) q = q.or(`vendor_name.ilike.%${keyword}%,work_content.ilike.%${keyword}%,work_location.ilike.%${keyword}%`)
        if (statusFilter !== 'all') q = q.eq('work_status', statusFilter)
        const { data: records, count, error } = await q
        if (error) { toast({ title: '載入失敗', description: error.message, variant: 'destructive' }) }
        else { setData(records || []); setTotalCount(count || 0) }
        setSelected(new Set()); setLoading(false)
    }

    const handleDelete = async (id?: string) => {
        const ids = id ? [id] : Array.from(selected)
        if (ids.length === 0) return
        const { error } = await supabase.from('work_report').delete().in('id', ids)
        if (error) {
            toast({ title: '刪除失敗', description: error.message, variant: 'destructive' })
        } else {
            toast({ title: '刪除成功' })
            fetchData()
        }
        setDeleteDialogOpen(false)
    }

    useEffect(() => { fetchData() }, [page, pageSize])
    const handleSearch = () => { setPage(1); fetchData() }

    const handleExport = async () => {
        let dataToExport: WorkReportRecord[] = []
        if (selected.size > 0) { dataToExport = data.filter(r => selected.has(r.id)) }
        else {
            let q = supabase.from('work_report').select('*').gte('report_date', startDate).lte('report_date', endDate).order('report_date', { ascending: false })
            if (keyword.trim()) q = q.or(`vendor_name.ilike.%${keyword}%,work_content.ilike.%${keyword}%,work_location.ilike.%${keyword}%`)
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
        <div className="min-h-screen bg-slate-100">
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.push('/')}><ArrowLeft className="w-4 h-4 mr-1" />返回首頁</Button>
                    <div className="h-6 w-px bg-slate-200" />
                    <h1 className="text-lg font-black text-slate-800 flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-indigo-500" />施工回報管理</h1>
                </div>
                <Button onClick={() => router.push('/work-report/new')} className="bg-indigo-600 hover:bg-indigo-700"><Plus className="w-4 h-4 mr-1" />新增回報</Button>
            </header>
            <main className="p-6">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-sm border border-slate-200">
                    <div className="p-4 border-b border-slate-100">
                        <div className="flex flex-wrap items-end gap-4">
                            <div className="space-y-1"><Label className="text-xs text-slate-500">開始日期</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" /></div>
                            <div className="space-y-1"><Label className="text-xs text-slate-500">結束日期</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" /></div>
                            <div className="space-y-1"><Label className="text-xs text-slate-500">狀態</Label><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部</SelectItem><SelectItem value="completed">完成</SelectItem><SelectItem value="incomplete">未完成</SelectItem><SelectItem value="abnormal">異常</SelectItem></SelectContent></Select></div>
                            <div className="space-y-1"><Label className="text-xs text-slate-500">關鍵字搜尋</Label><Input type="text" placeholder="廠商、地點、內容..." value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="w-52" /></div>
                            <Button onClick={handleSearch} disabled={loading}><Search className="w-4 h-4 mr-1" />搜尋</Button>
                            <Button variant="outline" onClick={handleExport}><Download className="w-4 h-4 mr-1" />匯出</Button>
                            <Button size="sm" variant="outline" onClick={() => { const id = Array.from(selected)[0]; if (id) router.push(`/work-report/${id}/edit`) }} disabled={selected.size !== 1}><Pencil className="w-4 h-4 mr-1" />修改</Button>
                            <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setDeleteDialogOpen(true)} disabled={selected.size === 0}><Trash2 className="w-4 h-4 mr-1" />刪除</Button>
                            <div className="flex-1" />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader><TableRow>
                                <TableHead className="w-12"><Checkbox checked={selected.size === data.length && data.length > 0} onCheckedChange={toggleSelectAll} /></TableHead>
                                <TableHead className="w-12">#</TableHead><TableHead>日期</TableHead><TableHead>時間</TableHead><TableHead>廠商</TableHead><TableHead>地點</TableHead><TableHead>負責人</TableHead><TableHead>狀態</TableHead><TableHead>施工內容</TableHead><TableHead>備註</TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                                {loading ? <TableRow><TableCell colSpan={10} className="text-center py-8"><RefreshCw className="w-5 h-5 animate-spin mx-auto text-slate-400" /></TableCell></TableRow>
                                    : data.length === 0 ? <TableRow><TableCell colSpan={10} className="text-center py-8 text-slate-400">查無資料</TableCell></TableRow>
                                        : data.map((row, index) => (
                                            <TableRow key={row.id} className={`hover:bg-indigo-50/50 ${selected.has(row.id) ? 'bg-indigo-100' : ''}`}>
                                                <TableCell><Checkbox checked={selected.has(row.id)} onCheckedChange={() => toggleSelect(row.id)} /></TableCell>
                                                <TableCell className="text-slate-400 text-sm">{index + 1}</TableCell>
                                                <TableCell className="font-mono">{row.report_date}</TableCell><TableCell className="font-mono">{row.report_time?.slice(0, 5) || '-'}</TableCell>
                                                <TableCell className="font-bold">{row.vendor_name}</TableCell><TableCell>{row.work_location}</TableCell><TableCell>{row.engineering_contact}</TableCell>
                                                <TableCell><Badge variant={statusLabels[row.work_status]?.variant || 'secondary'}>{statusLabels[row.work_status]?.text || row.work_status}</Badge></TableCell>
                                                <TableCell className="max-w-xs truncate" title={row.work_content}>{row.work_content}</TableCell><TableCell className="text-slate-400 text-xs max-w-32 truncate" title={row.note || ''}>{row.note || '-'}</TableCell>
                                            </TableRow>
                                        ))}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="p-4 border-t border-slate-100">
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
