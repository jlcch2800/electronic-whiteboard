// Work File List - Client Component
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { format, subDays } from 'date-fns'
import { motion } from 'framer-motion'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { FileText, ArrowLeft, Search, ChevronLeft, ChevronRight, RefreshCw, Plus, Pencil, Trash2, ExternalLink, Video, Download, Filter, FolderOpen } from 'lucide-react'
import { MobileTableCard } from '@/components/MobileTableCard'
import { EmptyState } from '@/components/EmptyState'
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
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { SkeletonTable } from '@/components/SkeletonTable'

interface WorkFileRecord {
    id: string; created_at: string; date: string; vendor_name: string | null; work_item: string | null
    uploader_name: string; description: string | null; file_url: string; image_url: string; video_url: string | null; note: string | null
}

export default function WorkFileClient() {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()
    const [data, setData] = useState<WorkFileRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [totalCount, setTotalCount] = useState(0)
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [keyword, setKeyword] = useState('')
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const totalPages = Math.ceil(totalCount / pageSize)
    const [isFiltersOpen, setIsFiltersOpen] = useState(false)
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
    const sortedData = useMemo(() => {
        if (!sort) return data
        return [...data].sort((a, b) => {
            const valA = (a as any)[sort.key] ?? ''
            const valB = (b as any)[sort.key] ?? ''
            if (valA < valB) return sort.direction === 'asc' ? -1 : 1
            if (valA > valB) return sort.direction === 'asc' ? 1 : -1
            return 0
        })
    }, [data, sort])

    const toggleSelect = (id: string) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s) }
    const toggleSelectAll = () => { selected.size === data.length && data.length > 0 ? setSelected(new Set()) : setSelected(new Set(data.map(i => i.id))) }

    const fetchData = async () => {
        setLoading(true)
        let q = supabase.from('work_file').select('*', { count: 'exact' })
            .gte('date', startDate).lte('date', endDate)
            .order('date', { ascending: false }).order('created_at', { ascending: false })
            .range((page - 1) * pageSize, page * pageSize - 1)
        if (keyword.trim()) q = q.or(`vendor_name.ilike.%${keyword}%,work_item.ilike.%${keyword}%,uploader_name.ilike.%${keyword}%,description.ilike.%${keyword}%,note.ilike.%${keyword}%`)
        const { data: records, count, error } = await q
        if (error) { toast({ title: '載入失敗', description: error.message, variant: 'destructive' }) }
        else { setData(records || []); setTotalCount(count || 0) }
        setSelected(new Set()); setLoading(false)
    }

    const handleDelete = async (id?: string) => {
        const ids = id ? [id] : Array.from(selected)
        if (ids.length === 0) return
        const { error } = await supabase.from('work_file').delete().in('id', ids)
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

    const shortenUrl = (url: string | null) => {
        if (!url) return null
        try { const u = new URL(url); return u.hostname + (u.pathname.length > 15 ? u.pathname.slice(0, 15) + '...' : u.pathname) }
        catch { return url.slice(0, 25) + '...' }
    }

    const handleExport = async () => {
        let dataToExport: WorkFileRecord[] = []
        if (selected.size > 0) { dataToExport = data.filter(r => selected.has(r.id)) }
        else {
            let q = supabase.from('work_file').select('*').gte('date', startDate).lte('date', endDate).order('date', { ascending: false })
            if (keyword.trim()) q = q.or(`vendor_name.ilike.%${keyword}%,work_item.ilike.%${keyword}%,uploader_name.ilike.%${keyword}%,description.ilike.%${keyword}%,note.ilike.%${keyword}%`)
            const { data: allData } = await q; dataToExport = allData || []
        }
        if (dataToExport.length === 0) { toast({ title: '無資料可匯出', variant: 'destructive' }); return }
        const sheetData = dataToExport.map((r, i) => ({ '#': i + 1, 'ID': r.id, '建立時間': r.created_at ? format(new Date(r.created_at), 'yyyy-MM-dd HH:mm:ss') : '', '日期': r.date, '廠商': r.vendor_name || '', '施工項目': r.work_item || '', '上傳人員': r.uploader_name, '說明': r.description || '', '文件連結': r.file_url || '', '照片連結': r.image_url || '', '影片連結': r.video_url || '', '備註': r.note || '' }))
        const wb = XLSX.utils.book_new(); const ws = XLSX.utils.json_to_sheet(sheetData)
        ws['!cols'] = Object.keys(sheetData[0] || {}).map(() => ({ wch: 15 }))
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
        saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `施工文件_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`)
        toast({ title: '匯出成功', description: `已匯出 ${dataToExport.length} 筆資料` })
    }

    return (
        <div className="min-h-screen bg-muted">
            <header className="glass border-b border-border/50 px-6 py-4 flex justify-between items-center shadow-card sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.push('/')}><ArrowLeft className="w-4 h-4 mr-1" />返回首頁</Button>
                    <div className="h-6 w-px bg-border" />
                    <h1 className="text-lg font-black text-foreground flex items-center gap-2"><FileText className="w-5 h-5 text-teal-500" />施工文件管理</h1>
                </div>
                <Button onClick={() => router.push('/work-file/new')} className="bg-teal-600 hover:bg-teal-700"><Plus className="w-4 h-4 mr-1" />新增文件</Button>
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
                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">開始日期</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full md:w-40" /></div>
                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">結束日期</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full md:w-40" /></div>
                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">關鍵字搜尋</Label><Input type="text" placeholder="廠商、項目、上傳人..." value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="w-full md:w-52" /></div>
                                <Button onClick={handleSearch} disabled={loading} className="w-full md:w-auto"><Search className="w-4 h-4 mr-1" />搜尋</Button>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                                <Button variant="outline" onClick={handleExport}><Download className="w-4 h-4 mr-1" />匯出</Button>
                                <Button size="sm" variant="outline" onClick={() => { const id = Array.from(selected)[0]; if (id) router.push(`/work-file/${id}/edit`) }} disabled={selected.size !== 1}><Pencil className="w-4 h-4 mr-1" />修改</Button>
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
                                        <TableHead className="w-12"><Checkbox checked={selected.size === data.length && data.length > 0} onCheckedChange={toggleSelectAll} /></TableHead>
                                        <TableHead className="w-12">#</TableHead>
                                        <SortableTableHead label="日期" sortKey="date" currentSort={sort} onSort={handleSort} />
                                        <SortableTableHead label="廠商" sortKey="vendor_name" currentSort={sort} onSort={handleSort} />
                                        <SortableTableHead label="施工項目" sortKey="work_item" currentSort={sort} onSort={handleSort} />
                                        <SortableTableHead label="上傳人員" sortKey="uploader_name" currentSort={sort} onSort={handleSort} />
                                        <TableHead>說明</TableHead><TableHead>文件</TableHead><TableHead>照片</TableHead><TableHead>影片</TableHead><TableHead>備註</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>
                                        {sortedData.length === 0 ? <TableRow><TableCell colSpan={11} className="p-0"><EmptyState icon={FolderOpen} title="尚無施工檔案" description="目前沒有施工檔案記錄，您可以點擊右上方新增。" /></TableCell></TableRow>
                                            : sortedData.map((row, index) => (
                                                <TableRow key={row.id} className={`hover:bg-teal-50/50 dark:hover:bg-teal-900/30 transition-colors even:bg-muted/20 ${selected.has(row.id) ? 'bg-teal-100 dark:bg-teal-900/40' : ''}`}>
                                                    <TableCell><Checkbox checked={selected.has(row.id)} onCheckedChange={() => toggleSelect(row.id)} /></TableCell>
                                                    <TableCell className="text-muted-foreground text-sm">{(page - 1) * pageSize + index + 1}</TableCell>
                                                    <TableCell className="font-mono">{row.date}</TableCell><TableCell className="font-bold">{row.vendor_name || '-'}</TableCell><TableCell>{row.work_item || '-'}</TableCell><TableCell>{row.uploader_name}</TableCell>
                                                    <TableCell className="max-w-32 truncate" title={row.description || ''}>{row.description || '-'}</TableCell>
                                                    <TableCell>{row.file_url ? <a href={row.file_url} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" /><span className="text-xs">{shortenUrl(row.file_url)}</span></a> : '-'}</TableCell>
                                                    <TableCell>{row.image_url ? <a href={row.image_url} target="_blank" rel="noopener noreferrer" className="block w-12 h-12"><img src={row.image_url} alt="Photo" className="w-full h-full object-cover rounded-md shadow-sm border border-border hover:scale-[2.5] hover:z-50 hover:shadow-xl transition-all duration-200 origin-center bg-white" onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/100?text=Error' }} /></a> : <span className="text-muted-foreground/50">-</span>}</TableCell>
                                                    <TableCell>{row.video_url ? <a href={row.video_url} target="_blank" rel="noopener noreferrer" className="block w-12 h-12 relative group"><img src={row.video_url.replace(/\.[^/.]+$/, ".jpg")} alt="Video" className="w-full h-full object-cover rounded-md shadow-sm border border-border group-hover:scale-[2.5] group-hover:z-50 group-hover:shadow-xl transition-all duration-200 origin-center bg-black" onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/100?text=Video' }} /><div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="bg-black/50 rounded-full p-1 group-hover:hidden"><Video className="w-3 h-3 text-white" /></div></div></a> : <span className="text-muted-foreground/50">-</span>}</TableCell>
                                                    <TableCell className="text-muted-foreground text-xs max-w-24 truncate" title={row.note || ''}>{row.note || '-'}</TableCell>
                                                </TableRow>
                                            ))}
                                    </TableBody>
                                </Table>

                                {/* 手機版卡片列表 */}
                                <div className="md:hidden mt-4 space-y-4 px-1 pb-4">
                                    {sortedData.length === 0 ? (
                                        <EmptyState icon={FolderOpen} title="尚無施工檔案" description="目前沒有施工檔案記錄，您可以點擊右上方新增。" />
                                    ) : (
                                        sortedData.map((row: WorkFileRecord) => (
                                            <MobileTableCard
                                                key={row.id}
                                                id={row.id}
                                                title={row.vendor_name || '未指定廠商'}
                                                subtitle={row.uploader_name}
                                                status={{
                                                    label: '文件',
                                                    variant: 'outline' as const,
                                                    className: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100'
                                                }}
                                                date={row.date}
                                                isSelected={selected.has(row.id)}
                                                onSelect={() => toggleSelect(row.id)}
                                                onClick={() => router.push(`/work-file/${row.id}/edit`)}
                                                details={[
                                                    { label: '施工項目', value: row.work_item },
                                                    { label: '說明', value: row.description },
                                                    { label: '文件', value: row.file_url ? <a href={row.file_url} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline" onClick={(e) => e.stopPropagation()}>查看文件</a> : null },
                                                    { label: '照片', value: row.image_url ? <a href={row.image_url} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline" onClick={(e) => e.stopPropagation()}>查看照片</a> : null },
                                                    { label: '影片', value: row.video_url ? <a href={row.video_url} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline" onClick={(e) => e.stopPropagation()}>查看影片</a> : null },
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
