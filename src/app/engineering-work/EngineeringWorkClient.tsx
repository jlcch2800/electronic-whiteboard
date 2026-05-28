'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { exportToExcelFile, exportToPdfFile } from '@/lib/export-utils'
import { motion } from 'framer-motion'
import {
    HardHat, Plus, Edit, Trash2, Download, ArrowLeft, RefreshCw, Search
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { sendTelegramNotify, formatDeleteMessage, ENGINEERING_WORK_LABELS } from '@/lib/telegram-notify'
import { logBatchDeleteRecords } from '@/lib/change-log'
import { useAppStore } from '@/stores/useAppStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { DataTablePagination } from '@/components/DataTablePagination'
import { EmptyState } from '@/components/EmptyState'
import { useTableData } from '@/hooks/useTableData'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { MobileTableCard } from '@/components/MobileTableCard'
import { SkeletonTable } from '@/components/SkeletonTable'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel
} from "@/components/ui/dropdown-menu"

interface EngineeringWorkClientProps {
    initialData: any[]
}

export default function EngineeringWorkClient({ initialData }: EngineeringWorkClientProps) {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()
    const { profile } = useAppStore()
    const isLoggedIn = !!profile

    const [data, setData] = useState(initialData)
    const [loading, setLoading] = useState(false)
    const [selected, setSelected] = useState<Set<string>>(new Set())



    // Delete dialog
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean, ids: string[] }>({
        open: false, ids: []
    })

    const refreshData = async () => {
        setLoading(true)
        const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
        const { data: result } = await supabase
            .from('engineering_today_work')
            .select('*')
            .lte('start_date', today)
            .gte('end_date', today)
            .order('start_date', { ascending: false })

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
                .from('engineering_today_work')
                .delete()
                .in('id', deleteDialog.ids)

            if (error) throw error

            // 發送 Telegram 刪除通知
            sendTelegramNotify(formatDeleteMessage('工務今日施工項目', deletedItems, ENGINEERING_WORK_LABELS))

            // 寫入系統異動紀錄
            logBatchDeleteRecords('engineering_today_work', deletedItems)

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

        exportToExcelFile(sheetData, '工務今日施工')
        toast({ title: '匯出成功', description: `已匯出 ${dataToExport.length} 筆資料` })
    }

    const exportToPdf = async () => {
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
            '時間': item.time?.slice(0, 5) || '-',
            '廠商': item.vendor_name,
            '單位': item.unit || '',
            '負責人': item.engineering_contact || '',
            '內容': item.work_content || '',
            '備註': item.note || ''
        }))

        toast({ title: '正在準備匯出 PDF...', description: '正在載入中文字型，請稍候...' })

        try {
            await exportToPdfFile({
                title: '工務今日施工項目清單',
                sheetData,
                filenamePrefix: '工務今日施工',
                orientation: 'landscape',
                themeColor: [217, 119, 6] // 琥珀色品牌色
            })
            toast({ title: 'PDF 匯出成功', description: `已匯出 ${dataToExport.length} 筆資料` })
        } catch (error: any) {
            toast({ title: 'PDF 匯出失敗', description: error.message, variant: 'destructive' })
        }
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
                        <HardHat className="w-6 h-6 text-amber-500" />
                        工務今日施工項目
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

                        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                            <Button size="sm" onClick={() => router.push('/engineering-work/new')} className="bg-amber-600 hover:bg-amber-700">
                                <Plus className="w-4 h-4 mr-1" /> 新增
                            </Button>

                            <Button size="sm" variant="outline" onClick={() => {
                                const id = Array.from(selected)[0]
                                if (id) router.push(`/engineering-work/${id}/edit`)
                            }} disabled={selected.size !== 1}>
                                <Edit className="w-4 h-4 mr-1" /> 修改
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => setDeleteDialog({ open: true, ids: Array.from(selected) })}
                                disabled={selected.size === 0}>
                                <Trash2 className="w-4 h-4 mr-1" /> 刪除
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button size="sm" variant="outline">
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
                                                    checked={selected.size === tableData.paginatedData.length && tableData.paginatedData.length > 0}
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
                                                        title="查無工務施工項目"
                                                        description="目前沒有符合條件的工務施工資料。"
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            tableData.paginatedData.map((e: any, index: number) => {
                                                const actualIndex = (tableData.page - 1) * tableData.perPage + index + 1
                                                return (
                                                    <TableRow key={e.id} className={`hover:bg-amber-50/50 dark:hover:bg-amber-900/40 transition-colors even:bg-muted/20 ${selected.has(e.id) ? 'bg-amber-50 dark:bg-amber-900/40' : ''}`}>
                                                        <TableCell className={`sticky left-0 z-10 ${selected.has(e.id) ? 'bg-amber-50 dark:bg-amber-900/40' : 'bg-card group-hover:bg-amber-50/50 dark:group-hover:bg-amber-900/40'}`}>
                                                            <Checkbox checked={selected.has(e.id)} onCheckedChange={() => toggleSelect(e.id)} />
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground text-sm">{actualIndex}</TableCell>
                                                        <TableCell className="font-mono">{e.start_date}</TableCell>
                                                        <TableCell className="font-mono">{e.end_date}</TableCell>
                                                        <TableCell className="font-mono">{e.time?.slice(0, 5) || '-'}</TableCell>
                                                        <TableCell className="font-bold text-amber-600 dark:text-amber-500">{e.vendor_name}</TableCell>
                                                        <TableCell><Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 border-amber-200 dark:border-amber-800">{e.unit}</Badge></TableCell>
                                                        <TableCell>{e.engineering_contact}</TableCell>
                                                        <TableCell className="max-w-[200px] truncate" title={e.work_content}>{e.work_content}</TableCell>
                                                        <TableCell className="text-muted-foreground text-xs">{e.note || '-'}</TableCell>
                                                    </TableRow>
                                                )
                                            })
                                        )}
                                    </TableBody>
                                </Table>

                                {/* 手機版卡片列表 */}
                                <div className="md:hidden mt-4 space-y-4 px-1 pb-4">
                                    {tableData.paginatedData.length > 0 && (
                                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50 mb-3">
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="mobile-select-all"
                                                    checked={selected.size === tableData.paginatedData.length && tableData.paginatedData.length > 0}
                                                    onCheckedChange={toggleSelectAll}
                                                />
                                                <label
                                                    htmlFor="mobile-select-all"
                                                    className="text-sm font-medium leading-none cursor-pointer select-none"
                                                >
                                                    全選({selected.size}/{tableData.paginatedData.length})
                                                </label>
                                            </div>
                                            {selected.size > 0 && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setSelected(new Set())}
                                                    className="text-xs text-muted-foreground hover:text-foreground h-8 px-2"
                                                >
                                                    取消選擇
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                    {tableData.paginatedData.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            查無工務施工項目
                                        </div>
                                    ) : (
                                        tableData.paginatedData.map((e: any, index: number) => (
                                            <MobileTableCard
                                                key={e.id}
                                                id={e.id}
                                                title={`#${(tableData.page - 1) * tableData.perPage + index + 1} ${e.vendor_name}`}
                                                subtitle={e.unit || '無單位'}
                                                status={{
                                                    label: '工務',
                                                    variant: 'outline',
                                                    className: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                                }}
                                                date={e.start_date}
                                                endDate={e.end_date}
                                                time={e.time?.slice(0, 5) || '-'}
                                                isSelected={selected.has(e.id)}
                                                onSelect={() => toggleSelect(e.id)}
                                                onClick={() => router.push(`/engineering-work/${e.id}/edit`)}
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
