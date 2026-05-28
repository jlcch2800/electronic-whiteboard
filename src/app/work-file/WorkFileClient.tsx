// Work File List - Client Component
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { format, subDays } from 'date-fns'
import { motion } from 'framer-motion'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { FileText, ArrowLeft, Search, ChevronLeft, ChevronRight, RefreshCw, Plus, Pencil, Trash2, ExternalLink, Video, Download, Filter, FolderOpen, FileIcon } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { exportToExcelFile, exportToPdfFile } from '@/lib/export-utils'
import Lightbox from "yet-another-react-lightbox"
import "yet-another-react-lightbox/styles.css"
import { MobileTableCard } from '@/components/MobileTableCard'
import { EmptyState } from '@/components/EmptyState'
import { createClient } from '@/lib/supabase/client'
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

    // Lightbox states
    const [lightboxOpen, setLightboxOpen] = useState(false)
    const [lightboxIndex, setLightboxIndex] = useState(0)
    const [lightboxSlides, setLightboxSlides] = useState<{ src: string }[]>([])

    // Parse array URLs helper
    const parseUrls = (val: string | null | undefined): string[] => {
        if (!val) return []
        if (val.startsWith('[')) {
            try { return JSON.parse(val) } catch { return [val] }
        }
        return [val]
    }

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
            row.work_item?.toLowerCase().includes(kw) ||
            row.uploader_name?.toLowerCase().includes(kw) ||
            row.description?.toLowerCase().includes(kw) ||
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

    const toggleSelect = (id: string) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s) }
    const toggleSelectAll = () => { selected.size === data.length && data.length > 0 ? setSelected(new Set()) : setSelected(new Set(data.map(i => i.id))) }

    const fetchData = async () => {
        setLoading(true)
        // 為了支援即時過濾，我們抓取該日期區間的所有資料 (或較大的數量)
        // 注意：不帶關鍵字查詢，因為關鍵字過濾改在前端處理
        let q = supabase.from('work_file').select('*', { count: 'exact' })
            .gte('date', startDate).lte('date', endDate)
            .order('date', { ascending: false }).order('created_at', { ascending: false })
            // 如果資料量非常大，才需要分頁。這裡先配合即時化，若要搜尋全部則不設 range 或設大一點
            // 但考量原本就有對齊分頁邏輯，這裡維持日期內的分頁或直接抓取分頁量
            .range((page - 1) * pageSize, page * pageSize - 1)
            
        const { data: records, count, error } = await q
        if (error) { toast({ title: '載入失敗', description: error.message, variant: 'destructive' }) }
        else { setData(records || []); setTotalCount(count || 0) }
        setSelected(new Set()); setLoading(false)
    }

    const handleDelete = async (id?: string) => {
        const ids = id ? [id] : Array.from(selected)
        if (ids.length === 0) return

        // 收集被刪除項目的資料以供紀錄與檔案清理
        const deletedItems = data.filter(item => ids.includes(item.id))
        
        // 1. 蒐集所有相關檔案的網址與資料夾
        const allUrls: string[] = []
        const uniqueFolders = new Set<string>()

        deletedItems.forEach(item => {
            const itemUrls = [
                ...parseUrls(item.file_url),
                ...parseUrls(item.image_url),
                ...parseUrls(item.video_url)
            ]
            allUrls.push(...itemUrls)

            // 從網址中解析資料夾路徑 (例如: work-report/2026-04-28_Test)
            itemUrls.forEach(url => {
                try {
                    const decoded = decodeURIComponent(url)
                    const parts = decoded.split('/')
                    const uploadIndex = parts.indexOf('upload')
                    if (uploadIndex !== -1) {
                        // 取 upload/vXXXX/ 之後到檔名之前的部分
                        const folderPath = parts.slice(uploadIndex + 2, parts.length - 1).join('/')
                        if (folderPath) uniqueFolders.add(folderPath)
                    }
                } catch (e) {}
            })
        })

        // 使用 .select() 來確認到底有沒有刪除成功
        const { data: deletedData, error } = await supabase.from('work_file').delete().in('id', ids).select('id')
        
        if (error) {
            toast({ title: '刪除失敗', description: error.message, variant: 'destructive' })
        } else if (!deletedData || deletedData.length === 0) {
            toast({ 
                title: '刪除未生效', 
                description: '您可能沒有權限刪除此資料，或該資料已被他人刪除。', 
                variant: 'destructive' 
            })
        } else {
            // 2. 資料庫刪除成功後，背景執行 Cloudinary 清理
            if (allUrls.length > 0 || uniqueFolders.size > 0) {
                // 先刪除檔案
                if (allUrls.length > 0) {
                    fetch('/api/cloudinary/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ urls: allUrls })
                    }).catch(e => console.error('Cloudinary files cleanup error:', e))
                }

                // 再嘗試刪除資料夾 (逐一刪除收集到的資料夾)
                uniqueFolders.forEach(folder => {
                    fetch('/api/cloudinary/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ folder })
                    }).catch(e => console.error('Cloudinary folder cleanup error:', e))
                })
            }

            // 寫入系統異動紀錄
            logBatchDeleteRecords('work_file', deletedItems)

            toast({ title: '刪除成功', description: `已刪除 ${deletedData.length} 筆資料 (雲端檔案同步清理中)` })
            
            // 手動過濾本地資料，確保介面立即更新
            setData(prev => prev.filter(item => !ids.includes(item.id)))
            fetchData()
        }
        setDeleteDialogOpen(false)
        setSelected(new Set())
    }

    useEffect(() => { fetchData() }, [page, pageSize, startDate, endDate])

    // 輔助函式：從網址提取檔名
    const getFileName = (url: string | null) => {
        if (!url) return ''
        try {
            const decoded = decodeURIComponent(url)
            const parts = decoded.split('/')
            return parts[parts.length - 1]
        } catch { return url?.split('/').pop() || '' }
    }

    const exportToExcel = async () => {
        let dataToExport: WorkFileRecord[] = []
        if (selected.size > 0) { dataToExport = data.filter(r => selected.has(r.id)) }
        else {
            let q = supabase.from('work_file').select('*').gte('date', startDate).lte('date', endDate).order('date', { ascending: false })
            if (keyword.trim()) q = q.or(`vendor_name.ilike.%${keyword}%,work_item.ilike.%${keyword}%,uploader_name.ilike.%${keyword}%,description.ilike.%${keyword}%,note.ilike.%${keyword}%`)
            const { data: allData } = await q; dataToExport = allData || []
        }
        if (dataToExport.length === 0) { toast({ title: '無資料可匯出', variant: 'destructive' }); return }
        const sheetData = dataToExport.map((r, i) => ({ '#': i + 1, 'ID': r.id, '建立時間': r.created_at ? format(new Date(r.created_at), 'yyyy-MM-dd HH:mm:ss') : '', '日期': r.date, '廠商': r.vendor_name || '', '施工項目': r.work_item || '', '上傳人員': r.uploader_name, '說明': r.description || '', '文件連結': r.file_url || '', '照片連結': r.image_url || '', '影片連結': r.video_url || '', '備註': r.note || '' }))
        
        exportToExcelFile(sheetData, '施工文件')
        toast({ title: '匯出成功', description: `已匯出 ${dataToExport.length} 筆資料` })
    }

    const exportToPdf = async () => {
        let dataToExport: WorkFileRecord[] = []
        if (selected.size > 0) { dataToExport = data.filter(r => selected.has(r.id)) }
        else {
            let q = supabase.from('work_file').select('*').gte('date', startDate).lte('date', endDate).order('date', { ascending: false })
            if (keyword.trim()) q = q.or(`vendor_name.ilike.%${keyword}%,work_item.ilike.%${keyword}%,uploader_name.ilike.%${keyword}%,description.ilike.%${keyword}%,note.ilike.%${keyword}%`)
            const { data: allData } = await q; dataToExport = allData || []
        }
        if (dataToExport.length === 0) { toast({ title: '無資料可匯出', variant: 'destructive' }); return }
        
        // 排除冗長欄位，PDF 只展示最重要核心的資訊
        const sheetData = dataToExport.map((r, i) => ({
            '#': i + 1,
            'ID': r.id,
            '建立時間': r.created_at ? format(new Date(r.created_at), 'yyyy-MM-dd HH:mm:ss') : '',
            '日期': r.date,
            '廠商': r.vendor_name || '-',
            '施工項目': r.work_item || '-',
            '上傳人員': r.uploader_name,
            '說明': r.description || '-',
            '文件連結': r.file_url ? '有' : '無',
            '照片連結': r.image_url ? '有' : '無',
            '影片連結': r.video_url ? '有' : '無',
            '備註': r.note || '-'
        }))

        toast({ title: '正在準備匯出 PDF...', description: '正在載入中文字型，請稍候...' })

        try {
            await exportToPdfFile({
                title: '施工文件記錄清單',
                sheetData,
                filenamePrefix: '施工文件',
                orientation: 'landscape',
                themeColor: [79, 70, 229], // 靛藍色品牌色
                excludeColumns: ['ID', '建立時間']
            })
            toast({ title: 'PDF 匯出成功', description: `已匯出 ${dataToExport.length} 筆資料` })
        } catch (error: any) {
            toast({ title: 'PDF 匯出失敗', description: error.message, variant: 'destructive' })
        }
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
                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">開始日期</Label><Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className="w-full md:w-40" /></div>
                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">結束日期</Label><Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className="w-full md:w-40" /></div>
                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">關鍵字搜尋</Label><Input type="text" placeholder="廠商、項目、上傳人..." value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }} className="w-full md:w-52" /></div>
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
                                            匯出 Excel (.xlsx)
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={exportToPdf}>
                                            匯出 PDF (.pdf)
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
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
                                                    <TableCell>
                                                        {(() => {
                                                            const urls = parseUrls(row.file_url)
                                                            if (urls.length === 0) return '-'
                                                            if (urls.length === 1) {
                                                                return (
                                                                    <a href={urls[0]} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline flex items-center gap-1.5 group max-w-[150px]">
                                                                        <FileIcon className="w-3.5 h-3.5 shrink-0 text-teal-500" />
                                                                        <span className="text-[11px] truncate font-medium">{getFileName(urls[0])}</span>
                                                                    </a>
                                                                )
                                                            }
                                                            return (
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <button className="text-teal-600 hover:bg-teal-50 px-2 py-1 rounded-md border border-teal-100 flex items-center gap-1.5 transition-colors focus:outline-none">
                                                                            <FileText className="w-3.5 h-3.5" />
                                                                            <span className="text-[11px] font-bold">{urls.length} 份文件</span>
                                                                        </button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent className="w-64 p-1">
                                                                        <div className="text-[10px] font-bold text-muted-foreground px-2 py-1.5 border-b border-border mb-1">點擊以下檔案查看:</div>
                                                                        {urls.map((url, i) => (
                                                                            <DropdownMenuItem key={i} asChild>
                                                                                <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 cursor-pointer group">
                                                                                    <FileIcon className="w-4 h-4 text-teal-500" />
                                                                                    <span className="text-xs truncate flex-1">{getFileName(url)}</span>
                                                                                    <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                                                                                </a>
                                                                            </DropdownMenuItem>
                                                                        ))}
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            )
                                                        })()}
                                                    </TableCell>
                                                    <TableCell>
                                                        {(() => {
                                                            const urls = parseUrls(row.image_url)
                                                            if (urls.length === 0) return <span className="text-muted-foreground/50">-</span>
                                                            return (
                                                                <div className="relative inline-block">
                                                                    <img 
                                                                        src={urls[0]} 
                                                                        alt="Photo" 
                                                                        className="w-12 h-12 object-cover rounded-md shadow-sm border border-border cursor-pointer hover:opacity-80 transition-opacity bg-white" 
                                                                        onClick={() => {
                                                                            setLightboxSlides(urls.map(src => ({ src })))
                                                                            setLightboxIndex(0)
                                                                            setLightboxOpen(true)
                                                                        }}
                                                                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/100?text=Error' }} 
                                                                    />
                                                                    {urls.length > 1 && (
                                                                        <div className="absolute -bottom-1 -right-1 bg-black/70 text-white text-[10px] px-1 rounded shadow-sm pointer-events-none">
                                                                            +{urls.length - 1}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )
                                                        })()}
                                                    </TableCell>
                                                    <TableCell>
                                                        {(() => {
                                                            const urls = parseUrls(row.video_url)
                                                            if (urls.length === 0) return <span className="text-muted-foreground/50">-</span>
                                                            if (urls.length === 1) {
                                                                return (
                                                                    <a href={urls[0]} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline flex items-center gap-1.5 group max-w-[150px]">
                                                                        <Video className="w-3.5 h-3.5 shrink-0 text-purple-500" />
                                                                        <span className="text-[11px] truncate font-medium">{getFileName(urls[0])}</span>
                                                                    </a>
                                                                )
                                                            }
                                                            return (
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <button className="text-purple-600 hover:bg-purple-50 px-2 py-1 rounded-md border border-purple-100 flex items-center gap-1.5 transition-colors focus:outline-none">
                                                                            <Video className="w-3.5 h-3.5" />
                                                                            <span className="text-[11px] font-bold">{urls.length} 部影片</span>
                                                                        </button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent className="w-64 p-1">
                                                                        <div className="text-[10px] font-bold text-muted-foreground px-2 py-1.5 border-b border-border mb-1">點擊以下影片觀看:</div>
                                                                        {urls.map((url, i) => (
                                                                            <DropdownMenuItem key={i} asChild>
                                                                                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 cursor-pointer group">
                                                                                    <Video className="w-4 h-4 text-purple-500" />
                                                                                    <span className="text-xs truncate flex-1">{getFileName(url)}</span>
                                                                                    <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                                                                                </a>
                                                                            </DropdownMenuItem>
                                                                        ))}
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            )
                                                        })()}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-xs max-w-24 truncate" title={row.note || ''}>{row.note || '-'}</TableCell>
                                                </TableRow>
                                            ))}
                                    </TableBody>
                                </Table>

                                {/* 手機版卡片列表 */}
                                <div className="md:hidden mt-4 space-y-4 px-1 pb-4">
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
                                        <EmptyState icon={FolderOpen} title="尚無施工檔案" description="目前沒有施工檔案記錄，您可以點擊右上方新增。" />
                                    ) : (
                                        sortedData.map((row: WorkFileRecord, index) => (
                                            <MobileTableCard
                                                key={row.id}
                                                id={row.id}
                                                title={`#${(page - 1) * pageSize + index + 1} ${row.vendor_name || '未指定廠商'}`}
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
                                                    { label: '文件', value: (() => {
                                                        const urls = parseUrls(row.file_url)
                                                        if (urls.length === 0) return null
                                                        return (
                                                            <div className="flex flex-wrap gap-2 mt-1">
                                                                {urls.map((url, i) => (
                                                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-[11px] bg-teal-50 text-teal-700 px-2 py-1 rounded border border-teal-100 truncate max-w-[120px]" onClick={(e) => e.stopPropagation()}>
                                                                        {getFileName(url)}
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        )
                                                    })() },
                                                    { label: '照片', value: (() => {
                                                        const urls = parseUrls(row.image_url)
                                                        if (urls.length === 0) return null
                                                        return (
                                                            <button type="button" onClick={(e) => {
                                                                e.stopPropagation()
                                                                setLightboxSlides(urls.map(src => ({ src })))
                                                                setLightboxIndex(0)
                                                                setLightboxOpen(true)
                                                            }} className="text-teal-600 hover:underline flex items-center gap-1 text-sm font-medium">
                                                                查看照片 ({urls.length} 張)
                                                            </button>
                                                        )
                                                    })() },
                                                    { label: '影片', value: (() => {
                                                        const urls = parseUrls(row.video_url)
                                                        if (urls.length === 0) return null
                                                        return (
                                                            <div className="flex flex-wrap gap-2 mt-1">
                                                                {urls.map((url, i) => (
                                                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-[11px] bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-100 truncate max-w-[120px]" onClick={(e) => e.stopPropagation()}>
                                                                        {getFileName(url)}
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        )
                                                    })() },
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

            <Lightbox
                open={lightboxOpen}
                close={() => setLightboxOpen(false)}
                index={lightboxIndex}
                slides={lightboxSlides}
                carousel={{ finite: false }}
                styles={{ container: { backgroundColor: "rgba(0, 0, 0, .8)" } }}
            />
        </div>
    )
}
