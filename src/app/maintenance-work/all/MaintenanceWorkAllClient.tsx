'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { exportToExcelFile, exportToPdfFile } from '@/lib/export-utils'
import { motion } from 'framer-motion'
import { History, Download, ArrowLeft, Search, CheckCircle2, ChevronDown, ChevronUp, RotateCcw, Activity, Plus, Trash2, Edit2, Eye } from 'lucide-react'
import { AdvancedSearchFilter, SearchFilters, defaultFilters } from '@/components/AdvancedSearchFilter'
import { MaintenanceDetailDialog } from '@/components/maintenance-work/MaintenanceDetailDialog'

import { createClient } from '@/lib/supabase/client'
import { logBatchDeleteRecords } from '@/lib/change-log'
import { useAppStore } from '@/stores/useAppStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { MobileTableCard } from '@/components/MobileTableCard'
import { DataTablePagination } from '@/components/DataTablePagination'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { EmptyState } from '@/components/EmptyState'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel
} from "@/components/ui/dropdown-menu"

// EXPORT_LABELS: 完整的欄位中文對照表（供 Excel 匯出用）
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
    'is_contract': '是否為合約維修單',
    'contract_received_date': '紙本合約收到日期',
}

// STATUS_BADGE_CLASSES: 定義維修流程各狀態所對應的 Tailwind 顏色類別 (比照儀表板與流程配色風格)
const STATUS_BADGE_CLASSES: Record<string, string> = {
    '已轉維修單': 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-800/40',
    '開單主管簽核完成': 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-800/40',
    '工務部門報價，主管簽核中': 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/20 dark:text-violet-400 dark:border-violet-800/40',
    '工務已發包': 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/20 dark:text-pink-400 dark:border-pink-800/40',
    '院長室簽核中': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800/40',
    '採購發包簽核中': 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800/40',
    '採購已發包': 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-800/40',
    '廠商施工中': 'bg-lime-50 text-lime-800 border-lime-200 dark:bg-lime-950/20 dark:text-lime-400 dark:border-lime-800/40',
    '施工完成，開單單位驗收中': 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-800/40',
    '維修部門驗收中': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800/40',
    '已驗收': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800/40',
}

interface MaintenanceWorkAllClientProps {
    initialData: any[]
}

export default function MaintenanceWorkAllClient({ initialData }: MaintenanceWorkAllClientProps) {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()
    const { profile } = useAppStore()
    const isAdmin = profile?.role === 'admin'

    const [data, setData] = useState(initialData)
    const [loading, setLoading] = useState(false)
    const [selected, setSelected] = useState<Set<string>>(new Set())

    // 分頁
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)
    const [totalItems, setTotalItems] = useState(initialData.length)

    // 排序
    const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'created_at', direction: 'desc' })

    // 搜尋過濾器
    const [activeFilters, setActiveFilters] = useState<SearchFilters>(defaultFilters)

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

    // 取得資料
    const refreshData = async () => {
        setLoading(true)
        try {
            let query = supabase.from('maintenance_work_orders').select('*', { count: 'exact' })

            if (activeFilters.customSearch && activeFilters.customSearch.trim()) {
                const keywords = activeFilters.customSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
                for (const kw of keywords) {
                    let orConditions = `work_order_id.ilike.%${kw}%,maintain_content.ilike.%${kw}%,handler_name.ilike.%${kw}%,cost_center.ilike.%${kw}%,requester_name.ilike.%${kw}%,vendor_name.ilike.%${kw}%,project_order_id.ilike.%${kw}%,procurement_name.ilike.%${kw}%,status.ilike.%${kw}%`;
                    if (kw === '合約' || kw === '合約維修單') {
                        orConditions += `,is_contract.eq.true`;
                    } else if (kw === '非合約' || kw === '非合約維修單') {
                        orConditions += `,is_contract.eq.false,is_contract.is.null`;
                    }
                    query = query.or(orConditions);
                }
            }
            if (activeFilters.startDate) query = query.gte('request_date', activeFilters.startDate)
            if (activeFilters.endDate) query = query.lte('request_date', activeFilters.endDate)
            if (activeFilters.status) query = query.ilike('status', `%${activeFilters.status}%`)

            if (activeFilters.planStartDate) query = query.gte('plan_start_date', activeFilters.planStartDate)
            if (activeFilters.planEndDate) query = query.lte('plan_end_date', activeFilters.planEndDate)
            if (activeFilters.installmentCountGte !== undefined && activeFilters.installmentCountGte !== null && activeFilters.installmentCountGte !== '') query = query.gte('installment_count', activeFilters.installmentCountGte)
            if (activeFilters.installmentCountLte !== undefined && activeFilters.installmentCountLte !== null && activeFilters.installmentCountLte !== '') query = query.lte('installment_count', activeFilters.installmentCountLte)

            if (activeFilters.isContract === 'yes') {
                query = query.eq('is_contract', true)
            } else if (activeFilters.isContract === 'no') {
                query = query.or('is_contract.eq.false,is_contract.is.null')
            }

            if (activeFilters.amount === 'lte20k') {
                query = query.lte('amount', 20000)
            } else if (activeFilters.amount === 'gt20k') {
                query = query.gt('amount', 20000)
            }

            if (sort) {
                query = query.order(sort.key, { ascending: sort.direction === 'asc' })
            } else {
                query = query.order('created_at', { ascending: false })
            }

            const { count, error: countError } = await query
            if (countError) throw countError
            setTotalItems(count || 0)

            const { data: result, error } = await query.range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1)
            if (error) throw error

            setData(result || [])
            setSelected(new Set())
        } catch (error: any) {
            console.error('Error fetching maintenance data:', error)
            toast({ title: '載入失敗', description: error.message, variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        refreshData()
    }, [currentPage, itemsPerPage, sort, activeFilters])

    // 全選/取消全選
    const toggleSelectAll = () => {
        if (selected.size === data.length) {
            setSelected(new Set())
        } else {
            setSelected(new Set(data.map(item => item.id)))
        }
    }

    // 單選/取消單選
    const toggleSelect = (id: string) => {
        const newSelected = new Set(selected)
        if (newSelected.has(id)) {
            newSelected.delete(id)
        } else {
            newSelected.add(id)
        }
        setSelected(newSelected)
    }

    // 排序處理
    const handleSort = (key: string) => {
        setSort(prev => {
            if (prev?.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
            }
            return { key, direction: 'desc' }
        })
    }

    // 刪除相關
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean, ids: string[] }>({
        open: false, ids: []
    })

    const onPreDelete = (ids: string[]) => {
        if (ids.length === 0) {
            toast({
                title: '請先選擇項目',
                description: '請勾選要刪除的維修單',
                variant: 'destructive'
            })
            return
        }
        setDeleteDialog({ open: true, ids })
    }

    const handleDelete = async () => {
        if (deleteDialog.ids.length === 0) return
        setLoading(true)
        try {
            const deletedItems = data.filter(item => deleteDialog.ids.includes(item.id))
            const { error } = await supabase.from('maintenance_work_orders').delete().in('id', deleteDialog.ids)
            if (error) throw error

            // 寫入系統異動紀錄（使用 await 確保發送成功）
            await logBatchDeleteRecords('maintenance_work_orders', deletedItems)

            toast({ title: '刪除成功', description: `已刪除 ${deleteDialog.ids.length} 筆資料` })
            setDeleteDialog({ open: false, ids: [] })
            setSelected(new Set())
            refreshData()
        } catch (error: any) {
            toast({ title: '刪除失敗', description: error.message, variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }

    // 取得匯出用資料集
    const getExportData = async (): Promise<any[] | null> => {
        let dataToExport = []
        if (selected.size > 0) {
            dataToExport = data.filter(item => selected.has(item.id))
        } else {
            try {
                let query = supabase.from('maintenance_work_orders').select('*')
                if (activeFilters.customSearch && activeFilters.customSearch.trim()) {
                    const keywords = activeFilters.customSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
                    for (const kw of keywords) {
                        query = query.or(`work_order_id.ilike.%${kw}%,maintain_content.ilike.%${kw}%,handler_name.ilike.%${kw}%,cost_center.ilike.%${kw}%,requester_name.ilike.%${kw}%,vendor_name.ilike.%${kw}%,project_order_id.ilike.%${kw}%,procurement_name.ilike.%${kw}%,status.ilike.%${kw}%`);
                    }
                }
                if (activeFilters.startDate) query = query.gte('request_date', activeFilters.startDate)
                if (activeFilters.endDate) query = query.lte('request_date', activeFilters.endDate)
                if (activeFilters.status) query = query.ilike('status', `%${activeFilters.status}%`)
                
                if (activeFilters.planStartDate) query = query.gte('plan_start_date', activeFilters.planStartDate)
                if (activeFilters.planEndDate) query = query.lte('plan_end_date', activeFilters.planEndDate)
                if (activeFilters.installmentCountGte !== undefined && activeFilters.installmentCountGte !== null && activeFilters.installmentCountGte !== '') query = query.gte('installment_count', activeFilters.installmentCountGte)
                if (activeFilters.installmentCountLte !== undefined && activeFilters.installmentCountLte !== null && activeFilters.installmentCountLte !== '') query = query.lte('installment_count', activeFilters.installmentCountLte)

                if (activeFilters.amount === 'lte20k') query = query.lte('amount', 20000)
                else if (activeFilters.amount === 'gt20k') query = query.gt('amount', 20000)
                if (sort) query = query.order(sort.key, { ascending: sort.direction === 'asc' })
                else query = query.order('created_at', { ascending: false })

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

    // 匯出 Excel
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
                if (key === 'is_contract') {
                    cellValue = cellValue === true ? '合約' : '非合約'
                } else if (key === 'created_at' && cellValue) {
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

        exportToExcelFile(sheetData, '維修單總表')
        toast({ title: '匯出成功', description: `已匯出 ${dataToExport.length} 筆資料` })
        setLoading(false)
    }

    // 匯出 PDF
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
                if (key === 'is_contract') {
                    cellValue = cellValue === true ? '合約' : '非合約'
                } else if (key === 'created_at' && cellValue) {
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
                title: '工務維修單總表記錄清單',
                sheetData,
                filenamePrefix: '維修單總表',
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
        <div className="min-h-screen bg-slate-50/50 dark:bg-slate-900/50 flex flex-col">
            {/* 響應式 Header：手機版下改為垂直堆疊並支援折行，避免撐爆畫面寬度 */}
            <header className="bg-background/95 backdrop-blur-md border-b border-border/50 px-4 sm:px-6 py-3 sm:py-4 flex flex-col md:flex-row md:justify-between md:items-center gap-3 sticky top-0 z-50">
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full md:w-auto">
                    <Button variant="ghost" size="sm" onClick={() => router.push('/')} className="px-2 h-9 shrink-0">
                        <ArrowLeft className="w-4 h-4 mr-1 shrink-0" />返回首頁
                    </Button>
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden xs:block" />
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <h1 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 whitespace-nowrap flex items-center gap-2">
                            <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500 shrink-0" />
                            維修單總表
                        </h1>
                    </div>
                </div>
                {/* 手機版按鈕群自動折行並均分空間 */}
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
                            onClick={() => onPreDelete(Array.from(selected))}
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
                        <span className="sm:hidden">新增</span>
                    </Button>
                </div>
            </header>

            <main className="flex-1 p-6 max-w-[1600px] mx-auto w-full">
                <AdvancedSearchFilter
                    onSearch={(f) => { setActiveFilters(f); setCurrentPage(1); }}
                    onReset={() => { setActiveFilters(defaultFilters); setCurrentPage(1); }}
                />

                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : data.length === 0 ? (
                    <EmptyState
                        icon={CheckCircle2}
                        title="查無維修單資料"
                        description={activeFilters.customSearch ? `沒有找到符合 "${activeFilters.customSearch}" 的維修單` : "目前系統中沒有任何維修單"}
                    />
                ) : (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                        <div className="hidden md:block rounded-xl border bg-card shadow-sm overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="w-[40px] px-4">
                                            <Checkbox
                                                checked={selected.size === data.length && data.length > 0}
                                                onCheckedChange={toggleSelectAll}
                                                aria-label="Select all"
                                            />
                                        </TableHead>
                                        <SortableTableHead sortKey="work_order_id" currentSort={sort} onSort={handleSort} label="工單編號" />
                                        <SortableTableHead sortKey="status" currentSort={sort} onSort={handleSort} label="狀態" />
                                        <SortableTableHead sortKey="request_date" currentSort={sort} onSort={handleSort} label="開單日" />
                                        <SortableTableHead sortKey="cost_center" currentSort={sort} onSort={handleSort} label="成本中心" />
                                        <SortableTableHead sortKey="requester_name" currentSort={sort} onSort={handleSort} label="開單人" />
                                        <SortableTableHead sortKey="project_order_id" currentSort={sort} onSort={handleSort} label="工程單編號" />
                                        <SortableTableHead sortKey="installment_count" currentSort={sort} onSort={handleSort} label="期數" />
                                        <TableHead>維修內容</TableHead>
                                        <SortableTableHead sortKey="handler_name" currentSort={sort} onSort={handleSort} label="承辦人" />
                                        <SortableTableHead sortKey="amount" currentSort={sort} onSort={handleSort} label="金額" />
                                        <SortableTableHead sortKey="vendor_name" currentSort={sort} onSort={handleSort} label="廠商" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.map((item) => (
                                        <TableRow key={item.id} className="group hover:bg-muted/30">
                                            <TableCell className="px-4" onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={selected.has(item.id)}
                                                    onCheckedChange={() => toggleSelect(item.id)}
                                                />
                                            </TableCell>
                                            <TableCell className="font-mono font-medium">
                                                 <div className="flex items-center gap-2">
                                                     {item.work_order_id}
                                                     {item.is_contract && (
                                                         <Badge className="bg-purple-100 hover:bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800/40 text-[10px] px-1.5 py-0 font-semibold">合約</Badge>
                                                     )}
                                                 </div>
                                             </TableCell>
                                            <TableCell>
                                                {/* 根據工單狀態動態顯示對應顏色之 Badge */}
                                                <Badge variant="outline" className={STATUS_BADGE_CLASSES[item.status] || 'bg-blue-100 text-blue-700 border-blue-200'}>
                                                    {item.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">{item.request_date}</TableCell>
                                            <TableCell>{item.cost_center}</TableCell>
                                            <TableCell>{item.requester_name}</TableCell>
                                            <TableCell>{item.project_order_id || '-'}</TableCell>
                                            <TableCell>{item.installment_count !== null && item.installment_count !== undefined ? `${item.installment_count} 期` : '-'}</TableCell>
                                            <TableCell className="max-w-[200px] truncate" title={item.maintain_content}>
                                                {item.maintain_content}
                                            </TableCell>
                                            <TableCell>{item.handler_name}</TableCell>
                                            <TableCell>{item.amount ? `$${Number(item.amount).toLocaleString()}` : '-'}</TableCell>
                                            <TableCell>{item.vendor_name || '-'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {/* 行動版卡片 */}
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

                            {data.map((item) => {
                                // 根據工單狀態動態對應 Tailwind 顏色樣式
                                const statusClassName = STATUS_BADGE_CLASSES[item.status] || 'bg-blue-100 text-blue-700 border-blue-200'

                                return (
                                    <MobileTableCard
                                        key={item.id}
                                        id={item.id}
                                        title={item.is_contract ? `${item.work_order_id} (合約)` : item.work_order_id}
                                        subtitle={item.cost_center}
                                        status={{
                                            label: item.status,
                                            variant: 'outline',
                                            className: statusClassName
                                        }}
                                        date={item.request_date}
                                        dateLabel="開單日"
                                        details={[
                                            { label: '工程單編號', value: item.project_order_id || '-' },
                                            { label: '期數', value: item.installment_count !== null && item.installment_count !== undefined ? `${item.installment_count} 期` : '-' },
                                            { label: '承辦人', value: item.handler_name },
                                            { label: '維修內容', value: item.maintain_content },
                                        ]}
                                        isSelected={selected.has(item.id)}
                                        onSelect={() => toggleSelect(item.id)}
                                        actionNode={
                                            isAdmin ? (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => onPreDelete([item.id])}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            ) : null
                                        }
                                    />
                                )
                            })}
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
                    </motion.div>
                )}
            </main>

            <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, ids: [] })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>確認刪除</AlertDialogTitle>
                        <AlertDialogDescription>
                            您確定要刪除這 {deleteDialog.ids.length} 筆維修單紀錄嗎？此動作無法復原。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
                            確認刪除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <MaintenanceDetailDialog
                open={viewDialogOpen}
                onOpenChange={setViewDialogOpen}
                viewingItem={viewingItem}
            />
        </div>
    )
}