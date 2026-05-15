'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { motion } from 'framer-motion'
import { History, Download, ArrowLeft, Search, CheckCircle2 } from 'lucide-react'
import { AdvancedSearchFilter, SearchFilters, defaultFilters } from '@/components/AdvancedSearchFilter'

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
    'request_date': '開單日',
    'request_department': '開單部門',
    'cost_center': '成本中心',
    'maintain_content': '維修內容',
    'requester_name': '開單人',
    'work_order_id': '工單編號',
    'handler_name': '承辦人',
    'work_order_date': '接單日期',
    'maint_mgr_name': '工務單位主管',
    'maint_mgr_date': '工務單位主管日期',
    'req_dept_mgr_name': '開單主管姓名',
    'req_dept_mgr_date': '開單主管日期',
    'quote_user_name': '報價承辦人',
    'quote_user_date': '報價承辦人日期',
    'vendor_name': '廠商',
    'amount': '金額',
    'dispatch_mgr_name': '發包-工務主管',
    'dispatch_mgr_date': '發包-工務主管日期',
    'dispatch_director_name': '發包工務主任姓名',
    'dispatch_director_date': '發包工務主任日期',
    'vice_dean_name': '副院長姓名',
    'vice_dean_date': '副院長日期',
    'dean_name': '院長姓名',
    'dean_date': '院長日期',
    'project_order_id': '工程單編號',
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
    'accept_handler_name': '驗收-承辦人',
    'accept_handler_date': '驗收-承辦人日期',
    'accept_mgr_name': '驗收-工務主管',
    'accept_mgr_date': '驗收-工務主管日期',
    'accept_director_name': '驗收工務主任姓名',
    'accept_director_date': '驗收工務主任日期',
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
                query = query.or(`work_order_id.ilike.%${activeFilters.customSearch}%,maintain_content.ilike.%${activeFilters.customSearch}%,request_department.ilike.%${activeFilters.customSearch}%,handler_name.ilike.%${activeFilters.customSearch}%`)
            }
            if (activeFilters.startDate) query = query.gte('request_date', activeFilters.startDate)
            if (activeFilters.endDate) query = query.lte('request_date', activeFilters.endDate)
            if (activeFilters.status) query = query.ilike('status', `%${activeFilters.status}%`)
            if (activeFilters.department) query = query.ilike('request_department', `%${activeFilters.department}%`)
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

    // 匯出 Excel
    const exportToExcel = async () => {
        setLoading(true)
        let dataToExport = []
        if (selected.size > 0) {
            dataToExport = data.filter(item => selected.has(item.id))
        } else {
            try {
                let query = supabase.from('maintenance_work_orders_history').select('*')
                if (activeFilters.customSearch) {
                    query = query.or(`work_order_id.ilike.%${activeFilters.customSearch}%,maintain_content.ilike.%${activeFilters.customSearch}%,request_department.ilike.%${activeFilters.customSearch}%,handler_name.ilike.%${activeFilters.customSearch}%`)
                }
                if (activeFilters.startDate) query = query.gte('request_date', activeFilters.startDate)
                if (activeFilters.endDate) query = query.lte('request_date', activeFilters.endDate)
                if (activeFilters.status) query = query.ilike('status', `%${activeFilters.status}%`)
                if (activeFilters.department) query = query.ilike('request_department', `%${activeFilters.department}%`)
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
                if (activeFilters.amount === 'lte20k') query = query.lte('amount', 20000)
                else if (activeFilters.amount === 'gt20k') query = query.gt('amount', 20000)
                if (sort) query = query.order(sort.key, { ascending: sort.direction === 'asc' })
                else query = query.order('created_at', { ascending: false })
                const { data: allResult, error } = await query
                if (error) throw error
                dataToExport = allResult || []
            } catch (err: any) {
                toast({ title: '取得匯出資料失敗', description: err.message, variant: 'destructive' })
                setLoading(false)
                return
            }
        }
        if (dataToExport.length === 0) {
            toast({ title: '無資料可匯出', variant: 'destructive' })
            setLoading(false)
            return
        }
        const sheetData = dataToExport.map((v: any, index: number) => {
            const row: any = { '#': index + 1 }
            for (const key of Object.keys(EXPORT_LABELS)) row[EXPORT_LABELS[key]] = v[key] || ''
            return row
        })
        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.json_to_sheet(sheetData)
        ws['!cols'] = Object.keys(sheetData[0] || {}).map(() => ({ wch: 15 }))
        XLSX.utils.book_append_sheet(wb, ws, '維修單歷史表')
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
        saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `維修單歷史表_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`)
        toast({ title: '匯出成功', description: `已匯出 ${dataToExport.length} 筆資料` })
        setLoading(false)
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
                    <Button variant="outline" size="sm" onClick={exportToExcel} disabled={loading} className="px-2 sm:px-4">
                        <Download className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">匯出 Excel</span>
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
                                        <SortableTableHead sortKey="request_department" currentSort={sort} onSort={handleSort} label="開單部門" />
                                        <SortableTableHead sortKey="cost_center" currentSort={sort} onSort={handleSort} label="成本中心" />
                                        <SortableTableHead sortKey="requester_name" currentSort={sort} onSort={handleSort} label="開單人" />
                                        <TableHead>維修內容</TableHead>
                                        <SortableTableHead sortKey="handler_name" currentSort={sort} onSort={handleSort} label="承辦人" />
                                        <SortableTableHead sortKey="amount" currentSort={sort} onSort={handleSort} label="金額" />
                                        <SortableTableHead sortKey="vendor_name" currentSort={sort} onSort={handleSort} label="廠商" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.map((item) => (
                                        <TableRow key={item.id} className="group hover:bg-muted/30 cursor-pointer" onClick={() => router.push(`/maintenance-work/${item.id}`)}>
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
                                            <TableCell>{item.request_department}</TableCell>
                                            <TableCell>{item.cost_center}</TableCell>
                                            <TableCell>{item.requester_name}</TableCell>
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
                            {data.map((item) => (
                                <MobileTableCard
                                    key={item.id}
                                    id={item.id}
                                    title={item.work_order_id}
                                    subtitle={item.request_department}
                                    status={{
                                        label: item.status,
                                        variant: "secondary",
                                        className: "bg-green-100 text-green-700"
                                    }}
                                    date={item.request_date}
                                    details={[
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
        </div>
    )
}