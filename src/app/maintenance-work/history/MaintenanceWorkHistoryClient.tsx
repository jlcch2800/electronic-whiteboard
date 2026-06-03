'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { exportToExcelFile, exportToPdfFile } from '@/lib/export-utils'
import { motion } from 'framer-motion'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel
} from "@/components/ui/dropdown-menu"
import { History, Download, ArrowLeft, Search, CheckCircle2, Eye, Activity } from 'lucide-react'
import { AdvancedSearchFilter, SearchFilters, defaultFilters } from '@/components/AdvancedSearchFilter'
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { MobileTableCard } from '@/components/MobileTableCard'
import { DataTablePagination } from '@/components/DataTablePagination'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { EmptyState } from '@/components/EmptyState'

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
    // 步驟 8
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

interface MaintenanceWorkHistoryClientProps {
    initialData: any[]
}

export default function MaintenanceWorkHistoryClient({ initialData }: MaintenanceWorkHistoryClientProps) {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()

    const [data, setData] = useState(initialData)
    const [loading, setLoading] = useState(false)
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

    // 分頁
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)
    const [totalItems, setTotalItems] = useState(initialData.length)

    // 排序
    const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'created_at', direction: 'desc' })

    // 搜尋過濾器
    const [activeFilters, setActiveFilters] = useState<SearchFilters>(defaultFilters)

    // 取得資料
    const refreshData = async () => {
        setLoading(true)
        try {
            let query = supabase.from('maintenance_work_orders_history').select('*', { count: 'exact' })

            if (activeFilters.customSearch) {
                query = query.or(`work_order_id.ilike.%${activeFilters.customSearch}%,maintain_content.ilike.%${activeFilters.customSearch}%,printer_name.ilike.%${activeFilters.customSearch}%,handler_name.ilike.%${activeFilters.customSearch}%`)
            }
            if (activeFilters.startDate) query = query.gte('request_date', activeFilters.startDate)
            if (activeFilters.endDate) query = query.lte('request_date', activeFilters.endDate)
            if (activeFilters.status) query = query.ilike('status', `%${activeFilters.status}%`)
            if (activeFilters.costCenter) query = query.ilike('cost_center', `%${activeFilters.costCenter}%`)
            if (activeFilters.content) query = query.ilike('maintain_content', `%${activeFilters.content}%`)
            if (activeFilters.requester) query = query.ilike('requester_name', `%${activeFilters.requester}%`)
            if (activeFilters.workOrderId) query = query.ilike('work_order_id', `%${activeFilters.workOrderId}%`)
            if (activeFilters.handler) query = query.ilike('handler_name', `%${activeFilters.handler}%`)
            if (activeFilters.quoteHandler) query = query.ilike('quote_user_name', `%${activeFilters.quoteHandler}%`)
            if (activeFilters.vendor) query = query.ilike('vendor_name', `%${activeFilters.vendor}%`)
            if (activeFilters.projectOrderId) query = query.ilike('project_order_id', `%${activeFilters.projectOrderId}%`)
            if (activeFilters.procurement) query = query.ilike('procurement_name', `%${activeFilters.procurement}%`)
            if (activeFilters.acceptHandler) query = query.ilike('accept_handler_name', `%${activeFilters.acceptHandler}%`)

            if (activeFilters.planStartDate) query = query.gte('plan_start_date', activeFilters.planStartDate)
            if (activeFilters.planEndDate) query = query.lte('plan_end_date', activeFilters.planEndDate)
            if (activeFilters.installmentCountGte !== undefined && activeFilters.installmentCountGte !== null && activeFilters.installmentCountGte !== '') query = query.gte('installment_count', activeFilters.installmentCountGte)
            if (activeFilters.installmentCountLte !== undefined && activeFilters.installmentCountLte !== null && activeFilters.installmentCountLte !== '') query = query.lte('installment_count', activeFilters.installmentCountLte)

            if (activeFilters.amount === 'lte20k') query = query.lte('amount', 20000)
            else if (activeFilters.amount === 'gt20k') query = query.gt('amount', 20000)

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
            console.error('Error fetching maintenance history:', error)
            toast({ title: '載入失敗', description: error.message, variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        refreshData()
    }, [currentPage, itemsPerPage, sort, activeFilters])

    // 全選處理
    const toggleSelectAll = () => {
        if (selected.size === data.length) {
            setSelected(new Set())
        } else {
            setSelected(new Set(data.map(item => item.id)))
        }
    }

    // 單選處理
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

    // 取得匯出用資料集
    const getExportData = async (): Promise<any[] | null> => {
        let dataToExport = []
        if (selected.size > 0) {
            dataToExport = data.filter(item => selected.has(item.id))
        } else {
            try {
                let query = supabase.from('maintenance_work_orders_history').select('*')
                if (activeFilters.customSearch) {
                    query = query.or(`work_order_id.ilike.%${activeFilters.customSearch}%,maintain_content.ilike.%${activeFilters.customSearch}%,printer_name.ilike.%${activeFilters.customSearch}%,handler_name.ilike.%${activeFilters.customSearch}%`)
                }
                if (activeFilters.startDate) query = query.gte('request_date', activeFilters.startDate)
                if (activeFilters.endDate) query = query.lte('request_date', activeFilters.endDate)
                if (activeFilters.status) query = query.ilike('status', `%${activeFilters.status}%`)
                if (activeFilters.costCenter) query = query.ilike('cost_center', `%${activeFilters.costCenter}%`)
                if (activeFilters.content) query = query.ilike('maintain_content', `%${activeFilters.content}%`)
                if (activeFilters.requester) query = query.ilike('requester_name', `%${activeFilters.requester}%`)
                if (activeFilters.workOrderId) query = query.ilike('work_order_id', `%${activeFilters.workOrderId}%`)
                if (activeFilters.handler) query = query.ilike('handler_name', `%${activeFilters.handler}%`)
                if (activeFilters.quoteHandler) query = query.ilike('quote_user_name', `%${activeFilters.quoteHandler}%`)
                if (activeFilters.vendor) query = query.ilike('vendor_name', `%${activeFilters.vendor}%`)
                if (activeFilters.projectOrderId) query = query.ilike('project_order_id', `%${activeFilters.projectOrderId}%`)
                if (activeFilters.procurement) query = query.ilike('procurement_name', `%${activeFilters.procurement}%`)
                if (activeFilters.acceptHandler) query = query.ilike('accept_handler_name', `%${activeFilters.acceptHandler}%`)
                
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

        exportToExcelFile(sheetData, '維修單歷史表')
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
                title: '工務維修單歷史紀錄清單',
                sheetData,
                filenamePrefix: '維修單歷史表',
                orientation: 'landscape',
                themeColor: [234, 88, 12], // 橘色品牌色
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
            <header className="glass border-b border-border/50 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
                        <ArrowLeft className="w-4 h-4 mr-1" />返回首頁
                    </Button>
                    <div className="h-6 w-px bg-border" />
                    <h1 className="text-xl font-black text-foreground flex items-center gap-2">
                        <History className="w-6 h-6 text-green-600" />
                        維修單歷史紀錄
                    </h1>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleViewDetails}
                        disabled={selected.size !== 1 || loading}
                        className="px-2 sm:px-4 border-blue-600 text-blue-600 hover:bg-blue-50/50"
                    >
                        <Eye className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">檢視明細</span>
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" disabled={loading} className="px-2 sm:px-4">
                                <Download className="w-4 h-4 sm:mr-2" />
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
                </div>
            </header>

            <main className="flex-1 p-6 max-w-[1600px] mx-auto w-full">
                <AdvancedSearchFilter
                    onSearch={(f) => { setActiveFilters(f); setCurrentPage(1); }}
                    onReset={() => { setActiveFilters(defaultFilters); setCurrentPage(1); }}
                />

                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : data.length === 0 ? (
                    <EmptyState
                        icon={CheckCircle2}
                        title="查無歷史紀錄"
                        description={activeFilters.customSearch ? `沒有找到符合 "${activeFilters.customSearch}" 的歷史維修單` : "目前歷史表中沒有任何紀錄"}
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
                                            />
                                        </TableHead>
                                        <SortableTableHead sortKey="work_order_id" currentSort={sort} onSort={handleSort} label="工單編號" />
                                        <SortableTableHead sortKey="status" currentSort={sort} onSort={handleSort} label="狀態" />
                                        <SortableTableHead sortKey="request_date" currentSort={sort} onSort={handleSort} label="開單日" />
                                        <SortableTableHead sortKey="cost_center" currentSort={sort} onSort={handleSort} label="成本中心" />
                                        <SortableTableHead sortKey="requester_name" currentSort={sort} onSort={handleSort} label="開單人" />
                                        <SortableTableHead sortKey="printer_name" currentSort={sort} onSort={handleSort} label="印單人" />
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
                                            <TableCell className="font-mono font-medium">{item.work_order_id}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                                                    {item.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">{item.request_date}</TableCell>
                                            <TableCell>{item.cost_center}</TableCell>
                                            <TableCell>{item.requester_name}</TableCell>
                                            <TableCell>{item.printer_name || '-'}</TableCell>
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

                            {data.map((item) => (
                                <MobileTableCard
                                    key={item.id}
                                    id={item.id}
                                    title={item.work_order_id}
                                    subtitle={item.cost_center}
                                    status={{
                                        label: item.status,
                                        variant: "secondary",
                                        className: "bg-green-100 text-green-700"
                                    }}
                                    date={item.request_date}
                                    dateLabel="開單日"
                                    details={[
                                        { label: '印單人', value: item.printer_name || '-' },
                                        { label: '承辦人', value: item.handler_name },
                                        { label: '維修內容', value: item.maintain_content },
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
                    </motion.div>
                )}
            </main>

            {/* 醫療風格 - 檢視明細對話框 */}
            <AlertDialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
                <AlertDialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-2 border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
                    {/* 醫療卡片 Header */}
                    <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-teal-800 text-white px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
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