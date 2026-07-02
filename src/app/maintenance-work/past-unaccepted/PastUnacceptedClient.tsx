'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    Activity, ArrowLeft, Download, Search, CheckCircle2, Eye
} from 'lucide-react'
import { Label } from '@/components/ui/label'

import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
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
import { MaintenanceDetailDialog } from '@/components/maintenance-work/MaintenanceDetailDialog'
import { exportToExcelFile, exportToPdfFile } from '@/lib/export-utils'
import { format } from 'date-fns'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"

// EXPORT_LABELS: 完整的欄位中文對照表（供 Excel/PDF 匯出用）
const EXPORT_LABELS: Record<string, string> = {
    'id': 'ID',
    'created_at': '建立時間',
    'status': '狀態',
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
    'req_dept_mgr_name': '開單主管姓名',
    'req_dept_mgr_date': '開單主管日期',
    'quote_user_name': '報價承辦人',
    'quote_user_date': '報價承辦人日期',
    'vendor_name': '廠商',
    'amount': '金額',
    'dispatch_mgr_name': '發包單位主管',
    'dispatch_mgr_date': '發包單位主管日期',
    'dispatch_director_name': '發包部門主管',
    'dispatch_director_date': '發包部門主管日期',
    'vice_dean_name': '副院長姓名',
    'vice_dean_date': '副院長日期',
    'dean_name': '院長姓名',
    'dean_date': '院長日期',
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
    'construct_end_date': '施工完成日期',
    'accept_dept_mgr_name': '驗收-開單主管姓名',
    'accept_dept_mgr_date': '驗收-開單主管日期',
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

// ROSE_THEME: Rose 顏色主題樣式設定物件，用於表格邊框、背景、文字與頂端裝飾條
const ROSE_THEME = {
    bg: 'bg-rose-50/80 dark:bg-rose-950/20',
    text: 'text-rose-700 dark:text-rose-400',
    border: 'border-rose-200/60 dark:border-rose-800/40',
    topBar: 'bg-rose-400'
}

export default function PastUnacceptedClient() {
    const router = useRouter()
    const supabase = createClient()

    // data: 儲存今年之前未驗收維修單的資料集陣列
    const [data, setData] = useState<any[]>([])
    // loading: 載入狀態，當開始載入為 true，結束載入為 false
    const [loading, setLoading] = useState(true)
    // searchTerm: 搜尋框輸入的字串，用於過濾表格紀錄
    const [searchTerm, setSearchTerm] = useState('')
    // selected: 已勾選的維修單 ID 集合
    const [selected, setSelected] = useState<Set<string>>(new Set())

    // viewDialogOpen: 檢視詳細步驟與簽章對話框的開關狀態
    const [viewDialogOpen, setViewDialogOpen] = useState(false)
    // viewingItem: 當前選取並在對話框內顯示的維修單物件
    const [viewingItem, setViewingItem] = useState<any>(null)

    // currentPage: 分頁元件中的當前頁碼
    const [currentPage, setCurrentPage] = useState(1)
    // itemsPerPage: 每頁要呈現的最多筆數，預設 10 筆
    const [itemsPerPage, setItemsPerPage] = useState(10)
    // totalItems: 符合篩選與搜尋條件的總工單數量
    const [totalItems, setTotalItems] = useState(0)
    // sort: 目前排序的欄位與遞增遞減方向，預設以開單日遞減排序
    const [sort, setSort] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'request_date', direction: 'desc' })

    // handleViewDetails: 點擊「檢視明細」按鈕時的處理函式，會將選取行資料綁定到 viewingItem 並開啟對話框
    const handleViewDetails = () => {
        if (selected.size !== 1) return
        const targetId = Array.from(selected)[0]
        const item = data.find(i => i.id === targetId)
        if (item) {
            setViewingItem(item)
            setViewDialogOpen(true)
        }
    }

    // refreshData: 非同步向 Supabase 查詢今年之前（以 request_date 判斷）未驗收（status != 已驗收）的紀錄
    const refreshData = async () => {
        setLoading(true)
        try {
            const currentYear = new Date().getFullYear()
            // startOfThisYear: 今年的一月一日日期字串，格式為 YYYY-MM-DD
            const startOfThisYear = `${currentYear}-01-01`

            // 從維修單表查詢符合非「已驗收」且開單日小於今年元旦的所有項目
            let query = supabase
                .from('maintenance_work_orders')
                .select('*', { count: 'exact' })
                .neq('status', '已驗收')
                .lt('request_date', startOfThisYear)

            // 如果有輸入關鍵字，對工單編號、內容、承辦人、印單人及狀態進行模糊搜尋
            if (searchTerm) {
                let orConditions = `work_order_id.ilike.%${searchTerm}%,maintain_content.ilike.%${searchTerm}%,printer_name.ilike.%${searchTerm}%,handler_name.ilike.%${searchTerm}%,status.ilike.%${searchTerm}%`;
                if (searchTerm === '合約' || searchTerm === '合約維修單') {
                    orConditions += `,is_contract.eq.true`;
                } else if (searchTerm === '非合約' || searchTerm === '非合約維修單') {
                    orConditions += `,is_contract.eq.false,is_contract.is.null`;
                }
                query = query.or(orConditions);
            }

            // 若有設定排序欄位，則套用對應的排序規則
            if (sort) {
                query = query.order(sort.key, { ascending: sort.direction === 'asc' })
            }

            const { count, error: countError } = await query
            if (countError) throw countError
            setTotalItems(count || 0)

            // 限制查詢範圍（分頁）
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

    // 監聽分頁、排序及搜尋字串的變化，觸發資料重新查詢
    useEffect(() => {
        refreshData()
    }, [currentPage, itemsPerPage, sort, searchTerm])

    // handleSort: 當使用者點選表頭欄位時切換排序方向或排序欄位
    const handleSort = (key: string) => {
        setSort(prev => {
            if (prev?.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
            }
            return { key, direction: 'desc' }
        })
    }

    // toggleSelect: 勾選或取消勾選某一列維修單
    const toggleSelect = (id: string) => {
        const next = new Set(selected)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelected(next)
    }

    // toggleSelectAll: 勾選或取消勾選當前頁面呈現的所有工單行
    const toggleSelectAll = () => {
        if (selected.size === data.length) setSelected(new Set())
        else setSelected(new Set(data.map(i => i.id)))
    }

    // getExportData: 取得目前需要匯出的資料。若有選取特定行則僅匯出選取行，否則匯出符合搜尋條件的整份結果
    const getExportData = async (): Promise<any[] | null> => {
        let dataToExport = []
        if (selected.size > 0) {
            dataToExport = data.filter(item => selected.has(item.id))
        } else {
            try {
                const currentYear = new Date().getFullYear()
                const startOfThisYear = `${currentYear}-01-01`

                let query = supabase
                    .from('maintenance_work_orders')
                    .select('*')
                    .neq('status', '已驗收')
                    .lt('request_date', startOfThisYear)

                if (searchTerm) {
                    let orConditions = `work_order_id.ilike.%${searchTerm}%,maintain_content.ilike.%${searchTerm}%,printer_name.ilike.%${searchTerm}%,handler_name.ilike.%${searchTerm}%,status.ilike.%${searchTerm}%`;
                    if (searchTerm === '合約' || searchTerm === '合約維修單') {
                        orConditions += `,is_contract.eq.true`;
                    } else if (searchTerm === '非合約' || searchTerm === '非合約維修單') {
                        orConditions += `,is_contract.eq.false,is_contract.is.null`;
                    }
                    query = query.or(orConditions);
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

    // exportToExcel: 將撈取出的資料格式化並匯出為 Excel 檔案
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

        exportToExcelFile(sheetData, '今年之前未驗收維修單明細')
        toast({ title: '匯出成功', description: `已匯出 ${dataToExport.length} 筆資料` })
        setLoading(false)
    }

    // exportToPdf: 將撈取出的資料格式化並匯出為 PDF 報表
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
                title: '今年之前未驗收維修單明細清單',
                sheetData,
                filenamePrefix: '今年之前未驗收維修單明細',
                orientation: 'landscape',
                themeColor: [244, 63, 94], // 使用符合 Rose 主題的 RGB 顏色
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

            {/* 表頭功能列：僅提供返回、檢視明細與匯出功能 (沒有修改、刪除、新增) */}
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
                        <Badge className={`${ROSE_THEME.bg} ${ROSE_THEME.text} ${ROSE_THEME.border} border text-xs py-1 px-2.5 font-bold tracking-wide whitespace-nowrap flex-shrink-0`}>
                            今年之前未驗收
                        </Badge>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap md:flex-nowrap w-full md:w-auto">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleViewDetails}
                        disabled={selected.size !== 1 || loading}
                        className="px-2 sm:px-4 border-rose-600 text-rose-600 hover:bg-rose-50/50 disabled:opacity-50 h-9 flex-1 sm:flex-initial justify-center"
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
                </div>
            </header>

            {/* 主要內容區 */}
            <main className="flex-1 p-6 max-w-[1600px] mx-auto w-full">
                <div className="mb-6 flex justify-between items-center">
                    <div className="relative w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="搜尋工單、維修內容、目前狀態..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-white dark:bg-slate-900"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : data.length === 0 ? (
                    <EmptyState
                        icon={CheckCircle2}
                        title="目前無今年之前未驗收的維修單"
                        description="所有今年之前的工單皆已結案驗收完畢。"
                    />
                ) : (
                    <div className="space-y-4">
                        {/* 桌面版表格：標題與頂部邊框均套用 Rose 顏色主題 */}
                        <div className={`hidden md:block rounded-xl border bg-white dark:bg-slate-950 shadow-sm overflow-hidden relative pt-1 ${ROSE_THEME.border}`}>
                            <div className={`absolute top-0 left-0 right-0 h-1 ${ROSE_THEME.topBar}`} />
                            <Table>
                                <TableHeader className={`${ROSE_THEME.bg} border-b ${ROSE_THEME.border}`}>
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
                                        <SortableTableHead sortKey="status" currentSort={sort} onSort={handleSort} label="目前狀態" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.map((item) => (
                                        <TableRow key={item.id} className={`hover:bg-slate-50/50 transition-colors ${selected.has(item.id) ? ROSE_THEME.bg : ''}`}>
                                            <TableCell className="px-4">
                                                <Checkbox
                                                    checked={selected.has(item.id)}
                                                    onCheckedChange={() => toggleSelect(item.id)}
                                                />
                                            </TableCell>
                                            <TableCell className="font-mono font-bold text-slate-700 dark:text-slate-200">
                                                 <div className="flex items-center gap-2">
                                                     {item.work_order_id}
                                                     {item.is_contract && (
                                                         <Badge className="bg-purple-100 hover:bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800/40 text-[10px] px-1.5 py-0 font-semibold">合約</Badge>
                                                     )}
                                                 </div>
                                             </TableCell>
                                            <TableCell className="text-slate-500 dark:text-slate-400">{item.request_date}</TableCell>
                                            <TableCell>{item.cost_center}</TableCell>
                                            <TableCell>{item.requester_name}</TableCell>
                                            <TableCell>{item.printer_name || '-'}</TableCell>
                                            <TableCell>{item.submit_date || '-'}</TableCell>
                                            <TableCell className="max-w-xs truncate" title={item.maintain_content}>
                                                {item.maintain_content}
                                            </TableCell>
                                            <TableCell>{item.handler_name}</TableCell>
                                            <TableCell>
                                                <Badge className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900 border text-[11px] font-semibold py-0.5 px-2">
                                                    {item.status}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {/* 行動版面 */}
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
                                    title={item.is_contract ? `${item.work_order_id} (合約)` : item.work_order_id}
                                    subtitle={item.cost_center}
                                    status={{ 
                                        label: item.status, 
                                        className: `${ROSE_THEME.bg} ${ROSE_THEME.text} ${ROSE_THEME.border} border font-bold text-[10px]` 
                                    }}
                                    date={item.request_date}
                                    dateLabel="開單日"
                                    details={[
                                        { label: '印單人', value: item.printer_name || '-' },
                                        { label: '送呈日期', value: item.submit_date || '-' },
                                        { label: '承辦人', value: item.handler_name },
                                        { label: '內容', value: item.maintain_content },
                                    ]}
                                    isSelected={selected.has(item.id)}
                                    onSelect={() => toggleSelect(item.id)}
                                />
                            ))}
                        </div>

                        {/* 分頁元件 */}
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

            {/* 檢視單筆明細對話框 (比照狀態 10 的流程顯示，包含完整步驟及簽章資訊) */}
            <MaintenanceDetailDialog
                open={viewDialogOpen}
                onOpenChange={setViewDialogOpen}
                viewingItem={viewingItem}
                title="工務維修單單筆記錄明細 (今年之前未驗收)"
                themeTopBar={ROSE_THEME.topBar}
                themeGradient="from-slate-900 via-slate-800 to-slate-900"
                themeTextColor="text-rose-300"
                themeSystemIdColor="text-rose-200"
            />
        </div>
    )
}
