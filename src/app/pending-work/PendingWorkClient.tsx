'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, addDays } from 'date-fns'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { motion } from 'framer-motion'
import {
    FileClock, Plus, Search, Edit, Trash2, Download, ArrowLeft, RefreshCw, MoreHorizontal
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
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
            query = query.or(`vendor_name.ilike.%${search.keyword}%,work_content.ilike.%${search.keyword}%,note.ilike.%${search.keyword}%`)
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

        try {
            const { error } = await supabase
                .from('pending_work')
                .delete()
                .in('id', deleteDialog.ids)

            if (error) throw error

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
        <div className="min-h-screen bg-slate-100 flex flex-col">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        返回首頁
                    </Button>
                    <div className="h-6 w-px bg-slate-200" />
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
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
                    className="bg-white rounded-2xl shadow-sm border border-slate-200"
                >
                    <div className="p-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Input
                                type="date"
                                value={search.start}
                                onChange={(e) => setSearch(s => ({ ...s, start: e.target.value }))}
                                className="w-36"
                            />
                            <span className="text-slate-400">~</span>
                            <Input
                                type="date"
                                value={search.end}
                                onChange={(e) => setSearch(s => ({ ...s, end: e.target.value }))}
                                className="w-36"
                            />
                            <Input
                                placeholder="搜尋關鍵字..."
                                value={search.keyword}
                                onChange={(e) => setSearch(s => ({ ...s, keyword: e.target.value }))}
                                className="w-40"
                            />
                            <Button size="sm" onClick={handleSearch} disabled={loading}>
                                <Search className="w-4 h-4 mr-1" /> 搜尋
                            </Button>
                        </div>

                        <div className="flex items-center gap-2">
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

                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">
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
                                    <TableHead>單位</TableHead>
                                    <TableHead>負責人</TableHead>
                                    <TableHead>內容</TableHead>
                                    <TableHead>備註</TableHead>

                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tableData.paginatedData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={11} className="text-center py-8 text-slate-400">
                                            <EmptyState
                                                icon={Search}
                                                title="查無待處理工作"
                                                description="目前沒有符合條件的待處理工作資料。"
                                            />
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    tableData.paginatedData.map((p: any, index: number) => (
                                        <TableRow key={p.id} className={`hover:bg-purple-50/50 ${selected.has(p.id) ? 'bg-purple-100' : ''}`}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={selected.has(p.id)}
                                                    onCheckedChange={() => toggleSelect(p.id)}
                                                />
                                            </TableCell>
                                            <TableCell className="text-slate-400 text-sm">{(tableData.page - 1) * tableData.perPage + index + 1}</TableCell>
                                            <TableCell className="font-mono">{p.start_date}</TableCell>
                                            <TableCell className="font-mono">{p.end_date}</TableCell>
                                            <TableCell className="font-mono">{p.time?.slice(0, 5) || '-'}</TableCell>
                                            <TableCell className="font-bold">{p.vendor_name}</TableCell>
                                            <TableCell><Badge variant="outline">{p.unit}</Badge></TableCell>
                                            <TableCell>{p.engineering_contact}</TableCell>
                                            <TableCell className="max-w-xs truncate" title={p.work_content}>{p.work_content}</TableCell>
                                            <TableCell className="text-slate-400 text-xs">{p.note || '-'}</TableCell>

                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="p-4 border-t border-slate-100">
                        <DataTablePagination
                            currentPage={tableData.page} totalPages={tableData.totalPages}
                            totalItems={tableData.totalItems} itemsPerPage={tableData.perPage}
                            onPageChange={tableData.setPage} onItemsPerPageChange={tableData.setPerPage}
                            selectedCount={selected.size}
                        />
                    </div>
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
