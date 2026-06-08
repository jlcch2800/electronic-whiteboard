'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    Activity, ArrowLeft, Download, Plus, Search, Trash2,
    RefreshCcw, CheckCircle2, MoreHorizontal, Edit2, Eye
} from 'lucide-react'
import { Label } from '@/components/ui/label'

import { createClient } from '@/lib/supabase/client'
import { logBatchDeleteRecords } from '@/lib/change-log'
import { useAuth } from '@/components/providers/AuthProvider'
import { useAppStore } from '@/stores/useAppStore'
import Navbar from '@/components/Navbar'
import { STATUS_COLORS } from '@/lib/maintenance-constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { DataTablePagination } from '@/components/DataTablePagination'
import { MobileTableCard } from '@/components/MobileTableCard'
import { EmptyState } from '@/components/EmptyState'
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { exportToExcelFile, exportToPdfFile } from '@/lib/export-utils'
import { format } from 'date-fns'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel
} from "@/components/ui/dropdown-menu"

// 完整的欄位中文對照表（供 Excel 匯出用）
const EXPORT_LABELS: Record<string, string> = {
    'id': 'ID',
    'created_at': '建立時間',
    'status': '狀態',
    // 步驟 1
    'request_date': '開單日',
    'cost_center': '成本中心',
    'maintain_content': '維修內容',
    'requester_name': '開單人',
    'work_order_id': '工單編號',
    'handler_name': '承辦人',
    'work_order_date': '接單日期',
    'maint_mgr_name': '工務單位主管',
    'maint_mgr_date': '工務單位主管日期',
    'printer_name': '印單人',
    'submit_date': '送呈日期',
    // 步驟 2
    'req_dept_mgr_name': '開單主管姓名',
    'req_dept_mgr_date': '開單主管日期',
    // 步驟 3
    'quote_user_name': '報價承辦人',
    'quote_user_date': '報價承辦人日期',
    // 步驟 4
    'vendor_name': '廠商',
    'amount': '金額',
    'dispatch_mgr_name': '發包單位主管',
    'dispatch_mgr_date': '發包單位主管日期',
    'dispatch_director_name': '發包部門主管',
    'dispatch_director_date': '發包部門主管日期',
    // 步驟 6
    'vice_dean_name': '副院長姓名',
    'vice_dean_date': '副院長日期',
    'dean_name': '院長姓名',
    'dean_date': '院長日期',
    // 步驟 7
    'project_order_id': '工程單編號',
    'plan_start_date': '施工預計開始日期',
    'plan_end_date': '施工預計結束日期',
    'procurement_name': '採購組姓名',
    'procurement_date': '採購組日期',
    'material_name': '資材室姓名',
    'material_date': '資材室日期',
    'rev_vice_dean_name': '審查-副院長姓名',
    'rev_vice_dean_date': '審查-副院長日期',
    'rev_dean_name': '審查-院長姓名',
    'rev_dean_date': '審查-院長日期',
    // 步驟 8 & 廠商施工中
    'construct_end_date': '施工完成日期',
    // 步驟 9
    'accept_dept_mgr_name': '驗收-開單主管姓名',
    'accept_dept_mgr_date': '驗收-開單主管日期',
    // 步驟 10
    'installment_count': '分期',
    'installment_note': '分期說明',
    'accept_handler_name': '驗收-承辦人',
    'accept_handler_date': '驗收-承辦人日期',
    'accept_mgr_name': '驗收單位主管',
    'accept_mgr_date': '驗收單位主管日期',
    'accept_director_name': '驗收部門主管',
    'accept_director_date': '驗收部門主管日期',
}

interface ExtraColumn {
    key: string;
    label: string;
}

const getExtraColumns = (status: string): ExtraColumn[] => {
    switch (status) {
        case '已轉維修單':
            return [
                { key: 'work_order_date', label: '接單日期' },
                { key: 'maint_mgr_name', label: '工務單位主管' },
                { key: 'maint_mgr_date', label: '工務單位主管日期' }
            ];
        case '開單主管簽核完成':
            return [
                { key: 'req_dept_mgr_name', label: '開單主管姓名' },
                { key: 'req_dept_mgr_date', label: '開單主管日期' }
            ];
        case '工務部門報價，主管簽核中':
            return [
                { key: 'quote_user_name', label: '報價承辦人' },
                { key: 'quote_user_date', label: '報價承辦人日期' }
            ];
        case '工務已發包':
        case '採購已發包':
            return [
                { key: 'project_order_id', label: '工程單編號' },
                { key: 'plan_start_date', label: '施工預計開始日期' },
                { key: 'plan_end_date', label: '施工預計結束日期' }
            ];
        case '廠商施工中':
            return [
                { key: 'project_order_id', label: '工程單編號' },
                { key: 'plan_start_date', label: '施工預計開始日期' },
                { key: 'plan_end_date', label: '施工預計結束日期' },
                { key: 'construct_end_date', label: '施工完成日期' }
            ];
        case '院長室簽核中':
            return [
                { key: 'dispatch_director_name', label: '發包部門主管' },
                { key: 'dispatch_director_date', label: '發包部門主管日期' }
            ];
        case '採購發包簽核中':
            return [
                { key: 'dean_name', label: '院長姓名' },
                { key: 'dean_date', label: '院長日期' }
            ];
        case '施工完成，開單單位驗收中':
            return [
                { key: 'project_order_id', label: '工程單編號' },
                { key: 'construct_end_date', label: '施工完成日期' }
            ];
        case '維修部門驗收中':
            return [
                { key: 'project_order_id', label: '工程單編號' },
                { key: 'construct_end_date', label: '施工完成日期' },
                { key: 'installment_count', label: '分期' },
                { key: 'installment_note', label: '分期說明' },
                { key: 'accept_dept_mgr_name', label: '驗收-開單主管' },
                { key: 'accept_dept_mgr_date', label: '驗收-開單主管日期' }
            ];
        case '已驗收':
            return [
                { key: 'project_order_id', label: '工程單編號' },
                { key: 'installment_count', label: '分期' },
                { key: 'installment_note', label: '分期說明' },
                { key: 'accept_handler_name', label: '驗收-承辦人' },
                { key: 'accept_handler_date', label: '驗收-承辦人日期' },
                { key: 'accept_mgr_name', label: '驗收單位主管' },
                { key: 'accept_mgr_date', label: '驗收單位主管日期' },
                { key: 'accept_director_name', label: '驗收部門主管' },
                { key: 'accept_director_date', label: '驗收部門主管日期' }
            ];
        default:
            return [];
    }
}

// 顏色對應表 (中飽和度漸層設計)
const COLOR_MAP: Record<string, { bg: string; text: string; border: string; topBar: string }> = {
    'Pastel blue': { bg: 'bg-sky-50/80 dark:bg-sky-950/20', text: 'text-sky-700 dark:text-sky-400', border: 'border-sky-200/60 dark:border-sky-800/40', topBar: 'bg-sky-400' },
    'Dusty rose': { bg: 'bg-rose-50/80 dark:bg-rose-950/20', text: 'text-rose-700 dark:text-rose-400', border: 'border-rose-200/60 dark:border-rose-800/40', topBar: 'bg-rose-400' },
    'Dusty Lavender': { bg: 'bg-violet-50/80 dark:bg-violet-950/20', text: 'text-violet-700 dark:text-violet-400', border: 'border-violet-200/60 dark:border-violet-800/40', topBar: 'bg-violet-400' },
    'Pink': { bg: 'bg-pink-50/80 dark:bg-pink-950/20', text: 'text-pink-700 dark:text-pink-400', border: 'border-pink-200/60 dark:border-pink-800/40', topBar: 'bg-pink-400' },
    'blue': { bg: 'bg-blue-50/80 dark:bg-blue-950/20', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-200/60 dark:border-blue-800/40', topBar: 'bg-blue-500' },
    'cinnamon': { bg: 'bg-amber-50/80 dark:bg-amber-950/20', text: 'text-amber-800 dark:text-amber-400', border: 'border-amber-200/50 dark:border-amber-800/40', topBar: 'bg-amber-700' },
    'yellow': { bg: 'bg-yellow-50/80 dark:bg-yellow-950/20', text: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-200/60 dark:border-yellow-800/40', topBar: 'bg-yellow-400' },
    'olive': { bg: 'bg-lime-50/80 dark:bg-lime-950/20', text: 'text-lime-800 dark:text-lime-400', border: 'border-lime-200/60 dark:border-lime-800/40', topBar: 'bg-lime-600' },
    'Peach': { bg: 'bg-orange-50/80 dark:bg-orange-950/20', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-200/60 dark:border-orange-800/40', topBar: 'bg-orange-400' },
    'Sage Green': { bg: 'bg-emerald-50/80 dark:bg-emerald-950/20', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200/60 dark:border-emerald-800/40', topBar: 'bg-emerald-400' },
}

export default function StatusDetailPageClient({ status }: { status: string }) {
    const router = useRouter()
    const { user } = useAuth()
    const { profile } = useAppStore()
    const supabase = createClient()
    const isAdmin = profile?.role === 'admin'

    const colorName = STATUS_COLORS[status] || 'Pastel blue'
    const c = COLOR_MAP[colorName] || COLOR_MAP['Pastel blue']

    const extraCols = getExtraColumns(status)

    // 資料狀態
    const [data, setData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [selected, setSelected] = useState<Set<string>>(new Set())

    // 檢視明細對話框狀態
    const [viewDialogOpen, setViewDialogOpen] = useState(false)
    const [viewingItem, setViewingItem] = useState<any>(null)

    const handleViewDetails = () => {
        if (selected.size !== 1) return
        const targetId = Array.from(selected)[0]
        const item = data.find(i => i.id === targetId)
        if (item) {
            setViewingItem(item)
            setViewDialogOpen(true)
        }
    }

    // 分頁與排序
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)
    const [totalItems, setTotalItems] = useState(0)
    const [sort, setSort] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'request_date', direction: 'desc' })

    // 刪除對話框
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean, ids: string[] }>({ open: false, ids: [] })

    const refreshData = async () => {
        setLoading(true)
        try {
            let query = supabase
                .from('maintenance_work_orders')
                .select('*', { count: 'exact' })
                .eq('status', status)

            if (searchTerm) {
                query = query.or(`work_order_id.ilike.%${searchTerm}%,maintain_content.ilike.%${searchTerm}%,printer_name.ilike.%${searchTerm}%,handler_name.ilike.%${searchTerm}%`)
            }

            if (sort) {
                query = query.order(sort.key, { ascending: sort.direction === 'asc' })
            }

            const { count, error: countError } = await query
            if (countError) throw countError
            setTotalItems(count || 0)

            const { data: result, error } = await query.range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1)
            if (error) throw error

            setData(result || [])
            setSelected(new Set())
        } catch (error: any) {
            console.error('Error fetching data:', error)
            toast({ title: '載入失敗', description: error.message, variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        refreshData()
    }, [currentPage, itemsPerPage, sort, searchTerm])

    const handleSort = (key: string) => {
        setSort(prev => {
            if (prev?.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
            }
            return { key, direction: 'desc' }
        })
    }

    const toggleSelect = (id: string) => {
        const next = new Set(selected)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelected(next)
    }

    const toggleSelectAll = () => {
        if (selected.size === data.length) setSelected(new Set())
        else setSelected(new Set(data.map(i => i.id)))
    }

    const handleDelete = async () => {
        if (deleteDialog.ids.length === 0) return
        try {
            const deletedItems = data.filter(item => deleteDialog.ids.includes(item.id))
            const { error } = await supabase.from('maintenance_work_orders').delete().in('id', deleteDialog.ids)
            if (error) throw error

            // 寫入系統異動紀錄（使用 await 確保發送成功）
            await logBatchDeleteRecords('maintenance_work_orders', deletedItems)

            toast({ title: '刪除成功', description: `已刪除 ${deleteDialog.ids.length} 筆紀錄` })
            refreshData()
        } catch (error: any) {
            toast({ title: '刪除失敗', description: error.message, variant: 'destructive' })
        } finally {
            setDeleteDialog({ open: false, ids: [] })
        }
    }

    // 取得匯出用資料集
    const getExportData = async (): Promise<any[] | null> => {
        let dataToExport = []
        if (selected.size > 0) {
            dataToExport = data.filter(item => selected.has(item.id))
        } else {
            try {
                let query = supabase
                    .from('maintenance_work_orders')
                    .select('*')
                    .eq('status', status)

                if (searchTerm) {
                    query = query.or(`work_order_id.ilike.%${searchTerm}%,maintain_content.ilike.%${searchTerm}%,printer_name.ilike.%${searchTerm}%,handler_name.ilike.%${searchTerm}%`)
                }

                if (sort) {
                    query = query.order(sort.key, { ascending: sort.direction === 'asc' })
                } else {
                    query = query.order('created_at', { ascending: false })
                }

                const { data: allResult, error } = await query
                if (error) throw error
                dataToExport = allResult || []
            } catch (err: any) {
                toast({ title: '取得匯出資料失敗', description: err.message, variant: 'destructive' })
                return null
            }
        }

        if (dataToExport.length === 0) {
            toast({ title: '無資料可匯出', variant: 'destructive' })
            return null
        }
        return dataToExport
    }

    const exportToExcel = async () => {
        setLoading(true)
        const dataToExport = await getExportData()
        if (!dataToExport) {
            setLoading(false)
            return
        }

        const sheetData = dataToExport.map((v: any, index: number) => {
            const row: any = { '#': index + 1 }
            for (const key of Object.keys(EXPORT_LABELS)) {
                let cellValue = v[key]
                if (key === 'created_at' && cellValue) {
                    try {
                        cellValue = format(new Date(cellValue), 'yyyy-MM-dd HH:mm:ss')
                    } catch (e) {
                        cellValue = String(cellValue)
                    }
                }
                row[EXPORT_LABELS[key]] = cellValue || ''
            }
            return row
        })

        exportToExcelFile(sheetData, '維修單明細')
        toast({ title: '匯出成功', description: `已匯出 ${dataToExport.length} 筆資料` })
        setLoading(false)
    }

    const exportToPdf = async () => {
        setLoading(true)
        const dataToExport = await getExportData()
        if (!dataToExport) {
            setLoading(false)
            return
        }

        const sheetData = dataToExport.map((v: any, index: number) => {
            const row: any = { '#': index + 1 }
            for (const key of Object.keys(EXPORT_LABELS)) {
                let cellValue = v[key]
                if (key === 'created_at' && cellValue) {
                    try {
                        cellValue = format(new Date(cellValue), 'yyyy-MM-dd HH:mm:ss')
                    } catch (e) {
                        cellValue = String(cellValue)
                    }
                } else if (key === 'amount' && cellValue) {
                    cellValue = `$${Number(cellValue).toLocaleString()}`
                }
                row[EXPORT_LABELS[key]] = cellValue || ''
            }
            return row
        })

        toast({ title: '正在準備匯出 PDF...', description: '正在載入中文字型，請稍候...' })

        try {
            await exportToPdfFile({
                title: `工務維修單明細清單 (${status})`,
                sheetData,
                filenamePrefix: `維修單明細_${status}`,
                orientation: 'landscape',
                themeColor: [234, 88, 12], // 橘色 brand color
                excludeColumns: []
            })
            toast({ title: 'PDF 匯出成功', description: `已匯出 ${dataToExport.length} 筆資料` })
        } catch (error: any) {
            toast({ title: 'PDF 匯出失敗', description: error.message, variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 flex flex-col">
            <Navbar onRefresh={refreshData} />

            <header className="bg-background/95 backdrop-blur-md border-b border-border/50 px-4 sm:px-6 py-3 sm:py-4 flex flex-col md:flex-row md:justify-between md:items-center gap-3 sticky top-0 z-50">
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full md:w-auto">
                    <Button variant="ghost" size="sm" onClick={() => router.push('/maintenance-work/status')} className="px-2 h-9 shrink-0">
                        <ArrowLeft className="w-4 h-4 mr-1 shrink-0" />返回儀表板
                    </Button>
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden xs:block" />
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <h1 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 whitespace-nowrap">
                            明細列表
                        </h1>
                        <Badge className={`${c.bg} ${c.text} ${c.border} border text-xs py-1 px-2.5 font-bold tracking-wide whitespace-nowrap flex-shrink-0`}>
                            {status}
                        </Badge>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap md:flex-nowrap w-full md:w-auto">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleViewDetails}
                        disabled={selected.size !== 1 || loading}
                        className="px-2 sm:px-4 border-blue-600 text-blue-600 hover:bg-blue-50/50 disabled:opacity-50 h-9 flex-1 sm:flex-initial justify-center"
                    >
                        <Eye className="w-4 h-4 sm:mr-2 shrink-0" />
                        <span className="hidden sm:inline">檢視明細</span>
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" disabled={loading} className="px-2 sm:px-4 h-9 flex-1 sm:flex-initial justify-center">
                                <Download className="w-4 h-4 sm:mr-2 shrink-0" />
                                <span className="hidden sm:inline">匯出</span>
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
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/maintenance-work/edit/${Array.from(selected)[0]}`)}
                        disabled={selected.size !== 1 || loading}
                        className="px-2 sm:px-4 border-primary text-primary hover:bg-primary/5 disabled:opacity-50 h-9 flex-1 sm:flex-initial justify-center"
                    >
                        <Edit2 className="w-4 h-4 sm:mr-2 shrink-0" />
                        <span className="hidden sm:inline">修改</span>
                    </Button>
                    {isAdmin && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteDialog({ open: true, ids: Array.from(selected) })}
                            disabled={selected.size === 0 || loading}
                            className="px-2 sm:px-4 h-9 flex-1 sm:flex-initial justify-center"
                        >
                            <Trash2 className="w-4 h-4 sm:mr-2 shrink-0" />
                            <span className="hidden sm:inline">刪除 {selected.size > 0 ? `(${selected.size})` : ''}</span>
                            <span className="sm:hidden">{selected.size > 0 ? selected.size : ''}</span>
                        </Button>
                    )}
                    <Button className="bg-orange-600 hover:bg-orange-700 text-white px-2 sm:px-4 h-9 flex-1 sm:flex-initial justify-center shrink-0" size="sm" onClick={() => router.push('/maintenance-work/new')}>
                        <Plus className="w-4 h-4 sm:mr-2 shrink-0" />
                        <span className="hidden sm:inline">新增維修單</span>
                    </Button>
                </div>
            </header>

            <main className="flex-1 p-6 max-w-[1600px] mx-auto w-full">
                <div className="mb-6 flex justify-between items-center">
                    <div className="relative w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="搜尋工單、印單人、承辦人..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-white dark:bg-slate-900"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : data.length === 0 ? (
                    <EmptyState
                        icon={CheckCircle2}
                        title="目前無此狀態的維修單"
                        description="該階段的所有維修單皆已處理完成或尚未進入此階段。"
                    />
                ) : (
                    <div className="space-y-4">
                        <div className={`hidden md:block rounded-xl border bg-white dark:bg-slate-950 shadow-sm overflow-hidden relative pt-1 ${c.border}`}>
                            <div className={`absolute top-0 left-0 right-0 h-1 ${c.topBar}`} />
                            <Table>
                                <TableHeader className={`${c.bg} border-b ${c.border}`}>
                                    <TableRow>
                                        <TableHead className="w-[40px] px-4">
                                            <Checkbox
                                                checked={selected.size === data.length && data.length > 0}
                                                onCheckedChange={toggleSelectAll}
                                            />
                                        </TableHead>
                                        <SortableTableHead sortKey="work_order_id" currentSort={sort} onSort={handleSort} label="工單編號" />
                                        <SortableTableHead sortKey="request_date" currentSort={sort} onSort={handleSort} label="開單日" />
                                        <SortableTableHead sortKey="cost_center" currentSort={sort} onSort={handleSort} label="成本中心" />
                                        <SortableTableHead sortKey="requester_name" currentSort={sort} onSort={handleSort} label="開單人" />
                                        <SortableTableHead sortKey="printer_name" currentSort={sort} onSort={handleSort} label="印單人" />
                                        <SortableTableHead sortKey="submit_date" currentSort={sort} onSort={handleSort} label="送呈日期" />
                                        <TableHead>維修內容</TableHead>
                                        <SortableTableHead sortKey="handler_name" currentSort={sort} onSort={handleSort} label="承辦人" />
                                        {extraCols.map((col) => (
                                            <SortableTableHead
                                                key={col.key}
                                                sortKey={col.key}
                                                currentSort={sort}
                                                onSort={handleSort}
                                                label={col.label}
                                            />
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.map((item) => (
                                        <TableRow key={item.id} className={`hover:bg-slate-50/50 transition-colors ${selected.has(item.id) ? c.bg : ''}`}>
                                            <TableCell className="px-4">
                                                <Checkbox
                                                    checked={selected.has(item.id)}
                                                    onCheckedChange={() => toggleSelect(item.id)}
                                                />
                                            </TableCell>
                                            <TableCell className="font-mono font-bold text-slate-700 dark:text-slate-200">{item.work_order_id}</TableCell>
                                            <TableCell className="text-slate-500 dark:text-slate-400">{item.request_date}</TableCell>
                                            <TableCell>{item.cost_center}</TableCell>
                                            <TableCell>{item.requester_name}</TableCell>
                                            <TableCell>{item.printer_name || '-'}</TableCell>
                                            <TableCell>{item.submit_date || '-'}</TableCell>
                                            <TableCell className="max-w-xs truncate" title={item.maintain_content}>
                                                {item.maintain_content}
                                            </TableCell>
                                            <TableCell>{item.handler_name}</TableCell>
                                            {extraCols.map((col) => {
                                                const rawValue = item[col.key];
                                                let displayValue = rawValue || '-';
                                                if (col.key === 'installment_count' && rawValue !== null && rawValue !== undefined) {
                                                    displayValue = `${rawValue} 期`;
                                                }
                                                return (
                                                    <TableCell key={col.key} className="text-slate-600 dark:text-slate-300">
                                                        {displayValue}
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {/* 行動版 */}
                        <div className="grid grid-cols-1 gap-4 md:hidden">
                            {data.length > 0 && (
                                <div className="flex items-center justify-between bg-card p-3 rounded-xl border border-border/80 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id="mobile-select-all"
                                            checked={selected.size === data.length && data.length > 0}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                        <Label htmlFor="mobile-select-all" className="text-sm font-medium cursor-pointer select-none">
                                            全選({selected.size}/{data.length})
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

                            {data.map((item) => (
                                <MobileTableCard
                                    key={item.id}
                                    id={item.id}
                                    title={item.work_order_id}
                                    subtitle={item.cost_center}
                                    status={{ 
                                        label: item.status, 
                                        className: `${c.bg} ${c.text} ${c.border} border font-bold text-[10px]` 
                                    }}
                                    date={item.request_date}
                                    dateLabel="開單日"
                                    details={[
                                        { label: '印單人', value: item.printer_name || '-' },
                                        { label: '送呈日期', value: item.submit_date || '-' },
                                        { label: '承辦人', value: item.handler_name },
                                        { label: '內容', value: item.maintain_content },
                                        ...extraCols.map((col) => {
                                            let val = item[col.key] || '-';
                                            if (col.key === 'installment_count' && item[col.key] !== null && item[col.key] !== undefined) {
                                                val = `${item[col.key]} 期`;
                                            }
                                            return {
                                                label: col.label,
                                                value: val,
                                            };
                                        }),
                                    ]}
                                    isSelected={selected.has(item.id)}
                                    onSelect={() => toggleSelect(item.id)}
                                />
                            ))}
                        </div>

                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={Math.ceil(totalItems / itemsPerPage)}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
                            itemsPerPage={itemsPerPage}
                            totalItems={totalItems}
                            selectedCount={selected.size}
                        />
                    </div>
                )}
            </main>

            <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, ids: [] })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>確認刪除</AlertDialogTitle>
                        <AlertDialogDescription>您確定要刪除這筆維修單紀錄嗎？此動作無法復原。</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">確認刪除</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* 醫療風格 - 檢視明細對話框 */}
            <AlertDialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
                <AlertDialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-2 border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
                    {/* 醫療卡片 Header */}
                    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0 relative pt-5">
                        <div className={`absolute top-0 left-0 right-0 h-1.5 ${c.topBar}`} />
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm shrink-0 border border-white/20">
                                <Activity className="w-6 h-6 text-teal-300 animate-pulse" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold tracking-wider">工務維修單單筆記錄明細</h2>
                            </div>
                        </div>
                        {viewingItem && (
                            <div className="text-right hidden sm:block font-mono">
                                <span className="text-[10px] text-teal-200 block">SYSTEM ID</span>
                                <span className="text-xs text-slate-300 tracking-tighter opacity-90">{viewingItem.id}</span>
                            </div>
                        )}
                    </div>

                    {/* 卡片主體 */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30 dark:bg-slate-900/10">
                        {viewingItem && (
                            <div className="space-y-6">
                                {[
                                    {
                                        title: "📋 設備開單基本資訊",
                                        iconColor: "text-blue-600 dark:text-blue-400",
                                        bgColor: "bg-blue-50/50 dark:bg-blue-950/20",
                                        borderColor: "border-blue-100 dark:border-blue-900/40",
                                        fields: ['work_order_id', 'status', 'request_date', 'cost_center', 'requester_name', 'printer_name', 'submit_date', 'created_at']
                                    },
                                    {
                                        title: "🔧 故障描述與承辦接單",
                                        iconColor: "text-amber-600 dark:text-amber-400",
                                        bgColor: "bg-amber-50/50 dark:bg-amber-950/20",
                                        borderColor: "border-amber-100 dark:border-amber-900/40",
                                        fields: ['maintain_content', 'handler_name', 'work_order_date', 'maint_mgr_name', 'maint_mgr_date', 'req_dept_mgr_name', 'req_dept_mgr_date']
                                    },
                                    {
                                        title: "💰 報價發包與行政簽核",
                                        iconColor: "text-emerald-600 dark:text-emerald-400",
                                        bgColor: "bg-emerald-50/50 dark:bg-emerald-950/20",
                                        borderColor: "border-emerald-100 dark:border-emerald-900/40",
                                        fields: ['quote_user_name', 'quote_user_date', 'vendor_name', 'amount', 'dispatch_mgr_name', 'dispatch_mgr_date', 'dispatch_director_name', 'dispatch_director_date', 'vice_dean_name', 'vice_dean_date', 'dean_name', 'dean_date']
                                    },
                                    {
                                        title: "🏗️ 採購招標與工程審查",
                                        iconColor: "text-indigo-600 dark:text-indigo-400",
                                        bgColor: "bg-indigo-50/50 dark:bg-indigo-950/20",
                                        borderColor: "border-indigo-100 dark:border-indigo-900/40",
                                        fields: ['project_order_id', 'plan_start_date', 'plan_end_date', 'procurement_name', 'procurement_date', 'material_name', 'material_date', 'rev_vice_dean_name', 'rev_vice_dean_date', 'rev_dean_name', 'rev_dean_date']
                                    },
                                    {
                                        title: "✅ 施工完工與驗收簽章",
                                        iconColor: "text-teal-600 dark:text-teal-400",
                                        bgColor: "bg-teal-50/50 dark:bg-teal-950/20",
                                        borderColor: "border-teal-100 dark:border-teal-900/40",
                                        fields: ['construct_end_date', 'installment_count', 'installment_note', 'accept_dept_mgr_name', 'accept_dept_mgr_date', 'accept_handler_name', 'accept_handler_date', 'accept_mgr_name', 'accept_mgr_date', 'accept_director_name', 'accept_director_date']
                                    }
                                ].map((group, gIdx) => (
                                    <div
                                        key={gIdx}
                                        className={`rounded-xl border ${group.borderColor} ${group.bgColor} p-4 shadow-sm space-y-4 backdrop-blur-[2px] transition-all hover:shadow-md`}
                                    >
                                        <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
                                            <span className={`text-base font-bold ${group.iconColor} tracking-wide`}>
                                                {group.title}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3.5">
                                            {group.fields.map((key) => {
                                                const label = EXPORT_LABELS[key] || key;
                                                let rawVal = viewingItem[key];
                                                let isPending = false;
                                                let formattedVal = "";

                                                if (rawVal === null || rawVal === undefined || String(rawVal).trim() === "" || rawVal === "-") {
                                                    isPending = true;
                                                    formattedVal = "待簽核 / 未填寫";
                                                } else {
                                                    if (key === 'amount') {
                                                        formattedVal = `$${Number(rawVal).toLocaleString()}`;
                                                    } else if (key === 'created_at') {
                                                        try {
                                                            formattedVal = format(new Date(rawVal), 'yyyy-MM-dd HH:mm:ss');
                                                        } catch (e) {
                                                            formattedVal = String(rawVal);
                                                        }
                                                    } else if (key === 'installment_count') {
                                                        formattedVal = `${rawVal} 期`;
                                                    } else {
                                                        formattedVal = String(rawVal);
                                                    }
                                                }

                                                return (
                                                    <div
                                                        key={key}
                                                        className={`flex flex-col gap-1 pb-2 border-b border-dashed border-slate-200/50 dark:border-slate-800/40 last:border-b-0 ${key === 'maintain_content' ? 'sm:col-span-2 md:col-span-3' : ''
                                                            }`}
                                                    >
                                                        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                                            {label}
                                                        </span>
                                                        {key === 'status' ? (
                                                            <div className="pt-0.5">
                                                                <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-0.5 px-2 tracking-wide rounded-md">
                                                                    {formattedVal}
                                                                </Badge>
                                                            </div>
                                                        ) : isPending ? (
                                                            <span className="text-xs text-slate-400/80 italic font-medium tracking-tight">
                                                                {formattedVal}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 break-all leading-relaxed font-mono">
                                                                {formattedVal}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 卡片 Footer */}
                    <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 flex items-center justify-end border-t border-slate-200/60 dark:border-slate-800/80 shrink-0">
                        <AlertDialogAction
                            onClick={() => setViewDialogOpen(false)}
                            className="bg-gradient-to-r from-blue-800 to-blue-900 hover:from-blue-900 hover:to-blue-950 text-white text-xs font-bold tracking-wider px-6 py-2 rounded-xl transition-all shadow-md active:scale-95"
                        >
                            離開
                        </AlertDialogAction>
                    </div>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
