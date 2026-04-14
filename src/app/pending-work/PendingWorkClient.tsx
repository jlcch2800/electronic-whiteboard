'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, addDays } from 'date-fns'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { motion } from 'framer-motion'
import {
    FileClock, Plus, Search, Edit, Trash2, Download, ArrowLeft, RefreshCw, MoreHorizontal, Filter
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { sendTelegramNotify, formatDeleteMessage, PENDING_WORK_LABELS } from '@/lib/telegram-notify'
import { logBatchDeleteRecords } from '@/lib/change-log'
import { useAppStore } from '@/stores/useAppStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel
} from "@/components/ui/dropdown-menu"
import { useToast } from '@/hooks/use-toast'
import { DataTablePagination } from '@/components/DataTablePagination'
import { EmptyState } from '@/components/EmptyState'
import { useTableData } from '@/hooks/useTableData'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { MobileTableCard } from '@/components/MobileTableCard'
import { SkeletonTable } from '@/components/SkeletonTable'

interface PendingWorkClientProps {
    initialData: any[]
}

export default function PendingWorkClient({ initialData }: PendingWorkClientProps) {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()
    const { profile } = useAppStore()
    const isLoggedIn = !!profile

    const [data, setData] = useState(initialData)
    const [loading, setLoading] = useState(false)
    const [selected, setSelected] = useState<Set<string>>(new Set())

    // Search state (default 6 months range)
    const [search, setSearch] = useState({
        start: format(new Date(), 'yyyy-MM-dd'),
        end: format(addDays(new Date(), 180), 'yyyy-MM-dd'),
        keyword: ''
    })
    const [isFiltersOpen, setIsFiltersOpen] = useState(false)

    // Delete dialog
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean, ids: string[] }>({
        open: false, ids: []
    })

    const refreshData = async () => {
        setLoading(true)
        const { data: result } = await supabase
            .from('pending_work')
            .select('*')
            .lte('start_date', search.end)
            .gte('end_date', search.start)
            .order('start_date', { ascending: false })

        setData(result || [])
        setSelected(new Set())
        setLoading(false)
    }

    const handleSearch = async () => {
        setLoading(true)
        let query = supabase
            .from('pending_work')
            .select('*')
            .lte('start_date', search.end)
            .gte('end_date', search.start)

        if (search.keyword) {
            query = query.or(`vendor_name.ilike.%${search.keyword}%,work_content.ilike.%${search.keyword}%,note.ilike.%${search.keyword}%,unit.ilike.%${search.keyword}%,engineering_contact.ilike.%${search.keyword}%`)
        }

        const { data: result } = await query.order('start_date', { ascending: false })
        setData(result || [])
        setSelected(new Set())
        setLoading(false)
    }

    const toggleSelect = (id: string) => {
        const newSet = new Set(selected)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setSelected(newSet)
    }

    const toggleSelectAll = () => {
        if (selected.size === data.length) setSelected(new Set())
        else setSelected(new Set(data.map(i => i.id)))
    }

    const handleDelete = async () => {
        if (deleteDialog.ids.length === 0) return

        // 在刪除前收集被刪除項目的資料（供通知使用）
        const deletedItems = data.filter(item => deleteDialog.ids.includes(item.id))

        try {
            const { error } = await supabase
                .from('pending_work')
                .delete()
                .in('id', deleteDialog.ids)

            if (error) throw error

            // 發送 Telegram 刪除通知
            sendTelegramNotify(formatDeleteMessage('待處理工作項目', deletedItems, PENDING_WORK_LABELS))

            // 寫入系統異動紀錄
            logBatchDeleteRecords('pending_work', deletedItems)

            toast({ title: '刪除成功', description: `已刪除 ${deleteDialog.ids.length} 筆資料` })
            setData(data.filter(item => !deleteDialog.ids.includes(item.id)))
            setSelected(new Set())
        } catch (error: any) {
            toast({ title: '刪除失敗', description: error.message, variant: 'destructive' })
        }

        setDeleteDialog({ open: false, ids: [] })
    }

    const exportToExcel = () => {
        const dataToExport = selected.size > 0 ? data.filter(i => selected.has(i.id)) : data

        if (dataToExport.length === 0) {
            toast({ title: '無資料可匯出', variant: 'destructive' })
            return
        }

        const sheetData = dataToExport.map((item, index) => ({
            '#': index + 1,
            'ID': item.id,
            '建立時間': item.created_at ? format(new Date(item.created_at), 'yyyy-MM-dd HH:mm:ss') : '',
            '開始日期': item.start_date,
            '結束日期': item.end_date,
            '時間': item.time || '',
            '廠商': item.vendor_name,
            '單位': item.unit || '',
            '負責人': item.engineering_contact || '',
            '內容': item.work_content || '',
            '備註': item.note || ''
        }))

        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.json_to_sheet(sheetData)

        // 設定欄寬
        const wscols = Object.keys(sheetData[0] || {}).map(() => ({ wch: 15 }))
        ws['!cols'] = wscols

        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
        saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `待處理工作_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`)

        toast({ title: '匯出成功', description: `已匯出 ${dataToExport.length} 筆資料` })
    }

    const tableData = useTableData(data, 'start_date')

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <header className="glass border-b border-border/50 px-6 py-4 flex justify-between items-center shadow-card sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        返回首頁
                    </Button>
                    <div className="h-6 w-px bg-border" />
                    <h1 className="text-xl font-black text-foreground flex items-center gap-2">
                        <FileClock className="w-6 h-6 text-purple-500" />
                        待處理工作項目
                    </h1>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-6 overflow-auto">
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card rounded-2xl shadow-card border border-border"
                >
                    <div className="p-4 border-b border-border/50 flex flex-wrap justify-between items-center gap-4">
                        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 w-full md:w-auto">
                            <div className="flex w-full md:hidden justify-between items-center mb-2">
                                <Button size="sm" variant="outline" onClick={() => setIsFiltersOpen(!isFiltersOpen)} className="w-full">
                                    <Filter className="w-4 h-4 mr-2" />
                                    {isFiltersOpen ? '隱藏篩選' : '顯示篩選'}
                                </Button>
                            </div>

                            <div className={`flex-col md:flex-row items-stretch md:items-center gap-2 ${isFiltersOpen ? 'flex' : 'hidden md:flex'}`}>
                                <Input
                                    type="date"
                                    value={search.start}
                                    onChange={(e) => setSearch(s => ({ ...s, start: e.target.value }))}
                                    className="w-full md:w-36"
                                />
                                <span className="text-muted-foreground hidden md:inline">~</span>
                                <Input
                                    type="date"
                                    value={search.end}
                                    onChange={(e) => setSearch(s => ({ ...s, end: e.target.value }))}
                                    className="w-full md:w-36"
                                />
                                <Input
                                    placeholder="搜尋關鍵字..."
                                    value={search.keyword}
                                    onChange={(e) => setSearch(s => ({ ...s, keyword: e.target.value }))}
                                    className="w-full md:w-40"
                                />
                                <Button size="sm" onClick={handleSearch} disabled={loading} className="w-full md:w-auto">
                                    <Search className="w-4 h-4 mr-1" /> 搜尋
                                </Button>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                            <Button size="sm" onClick={() => router.push('/pending-work/new')} className="bg-purple-600 hover:bg-purple-700">
                                <Plus className="w-4 h-4 mr-1" /> 新增
                            </Button>

                            <Button size="sm" variant="outline" onClick={() => {
                                const id = Array.from(selected)[0]
                                if (id) router.push(`/pending-work/${id}/edit`)
                            }} disabled={selected.size !== 1}>
                                <Edit className="w-4 h-4 mr-1" /> 修改
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => setDeleteDialog({ open: true, ids: Array.from(selected) })}
                                disabled={selected.size === 0}>
                                <Trash2 className="w-4 h-4 mr-1" /> 刪除
                            </Button>
                            <Button size="sm" variant="outline" onClick={exportToExcel}>
                                <Download className="w-4 h-4 mr-1" /> 匯出
                            </Button>
                            <Button variant="outline" size="sm" onClick={refreshData} disabled={loading}>
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
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
                                            <TableHead className="w-12 sticky left-0 bg-card z-20">
                                                <Checkbox
                                                    checked={selected.size === data.length && data.length > 0}
                                                    onCheckedChange={toggleSelectAll}
                                                />
                                            </TableHead>
                                            <TableHead className="w-12">#</TableHead>
                                            <SortableTableHead label="開始日期" sortKey="start_date" currentSort={tableData.sort} onSort={tableData.handleSort} />
                                            <SortableTableHead label="結束日期" sortKey="end_date" currentSort={tableData.sort} onSort={tableData.handleSort} />
                                            <SortableTableHead label="時間" sortKey="time" currentSort={tableData.sort} onSort={tableData.handleSort} />
                                            <SortableTableHead label="廠商" sortKey="vendor_name" currentSort={tableData.sort} onSort={tableData.handleSort} />
                                            <SortableTableHead label="單位" sortKey="unit" currentSort={tableData.sort} onSort={tableData.handleSort} />
                                            <SortableTableHead label="負責人" sortKey="engineering_contact" currentSort={tableData.sort} onSort={tableData.handleSort} />
                                            <TableHead>內容</TableHead>
                                            <TableHead>備註</TableHead>

                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {tableData.paginatedData.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                                                    <EmptyState
                                                        icon={Search}
                                                        title="查無待處理工作"
                                                        description="目前沒有符合條件的待處理工作資料。"
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            tableData.paginatedData.map((e: any, index: number) => {
                                                const actualIndex = (tableData.page - 1) * tableData.perPage + index + 1
                                                return (
                                                    <TableRow key={e.id} className={`hover:bg-purple-50/50 dark:hover:bg-purple-900/40 transition-colors even:bg-muted/20 ${selected.has(e.id) ? 'bg-purple-50 dark:bg-purple-900/40' : ''}`}>
                                                        <TableCell className={`sticky left-0 z-10 ${selected.has(e.id) ? 'bg-purple-50 dark:bg-purple-900/40' : 'bg-card group-hover:bg-purple-50/50 dark:group-hover:bg-purple-900/40'}`}>
                                                            <Checkbox checked={selected.has(e.id)} onCheckedChange={() => toggleSelect(e.id)} />
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground text-sm">{actualIndex}</TableCell>
                                                        <TableCell className="font-mono">{e.start_date}</TableCell>
                                                        <TableCell className="font-mono">{e.end_date}</TableCell>
                                                        <TableCell className="font-mono">{e.time?.slice(0, 5) || '-'}</TableCell>
                                                        <TableCell className="font-bold">{e.vendor_name}</TableCell>
                                                        <TableCell><Badge variant="outline">{e.unit}</Badge></TableCell>
                                                        <TableCell>{e.engineering_contact}</TableCell>
                                                        <TableCell className="max-w-xs truncate" title={e.work_content}>{e.work_content}</TableCell>
                                                        <TableCell className="text-muted-foreground text-xs">{e.note || '-'}</TableCell>
                                                    </TableRow>
                                                )
                                            })
                                        )}
                                    </TableBody>
                                </Table>

                                {/* 手機版卡片列表 */}
                                <div className="md:hidden mt-4 space-y-4 px-1 pb-4">
                                    {tableData.paginatedData.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            查無待處理工作
                                        </div>
                                    ) : (
                                        tableData.paginatedData.map((e: any) => (
                                            <MobileTableCard
                                                key={e.id}
                                                id={e.id}
                                                title={e.vendor_name}
                                                subtitle={e.engineering_contact || '無負責人'}
                                                status={e.status === '待處理' ? {
                                                    label: '待處理',
                                                    variant: 'outline',
                                                    className: 'bg-purple-50 text-purple-700 border-purple-200'
                                                } : e.status === '進行中' ? {
                                                    label: '進行中',
                                                    variant: 'outline',
                                                    className: 'bg-blue-50 text-blue-700 border-blue-200'
                                                } : {
                                                    label: e.status || '待處理',
                                                    variant: 'outline',
                                                    className: 'bg-green-50 text-green-700 border-green-200'
                                                }}
                                                date={e.start_date}
                                                endDate={e.end_date}
                                                time={e.time?.slice(0, 5) || '-'}
                                                isSelected={selected.has(e.id)}
                                                onSelect={() => toggleSelect(e.id)}
                                                onClick={() => router.push(`/pending-work/${e.id}/edit`)}
                                                details={[
                                                    { label: "廠商", value: e.vendor_name },
                                                    { label: "單位", value: e.unit },
                                                    { label: "負責人", value: e.engineering_contact },
                                                    { label: "內容", value: e.work_content },
                                                    { label: "備註", value: e.note }
                                                ]}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="p-4 border-t border-border/50">
                                <DataTablePagination
                                    currentPage={tableData.page} totalPages={tableData.totalPages}
                                    totalItems={tableData.totalItems} itemsPerPage={tableData.perPage}
                                    onPageChange={tableData.setPage} onItemsPerPageChange={tableData.setPerPage}
                                    selectedCount={selected.size}
                                />
                            </div>
                        </>
                    )}
                </motion.section>
            </main>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>確認刪除</AlertDialogTitle>
                        <AlertDialogDescription>
                            確定要刪除選取的 <strong>{deleteDialog.ids.length}</strong> 筆資料嗎？
                            <br />此操作無法復原。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                            確認刪除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
