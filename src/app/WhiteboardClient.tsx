// Whiteboard Client Component — Dashboard（三表合一）
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format, subDays, addDays } from 'date-fns'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { motion } from 'framer-motion'
import {
    Users, HardHat, FileClock,
    Plus, Search, Edit, Trash2, Download, MoreHorizontal, Copy
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
import Navbar from '@/components/Navbar'
import { useTableData } from '@/hooks/useTableData'
import { DataTablePagination } from '@/components/DataTablePagination'
import { EmptyState } from '@/components/EmptyState'
import { SortableTableHead } from '@/components/ui/sortable-table-head'

interface WhiteboardClientProps {
    initialVendors: any[]
    initialEngineering: any[]
    initialPending: any[]
}

export default function WhiteboardClient({
    initialVendors,
    initialEngineering,
    initialPending
}: WhiteboardClientProps) {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()
    const { profile } = useAppStore()

    const [vendors, setVendors] = useState(initialVendors)
    const [engineering, setEngineering] = useState(initialEngineering)
    const [pendingWork, setPendingWork] = useState(initialPending)
    const [loading, setLoading] = useState(false)

    // 表格狀態 Hook
    const vendorTable = useTableData(vendors, 'work_date')
    const engTable = useTableData(engineering, 'start_date')
    const pendingTable = useTableData(pendingWork, 'start_date')

    // 選取狀態
    const [vendorSelected, setVendorSelected] = useState<Set<string>>(new Set())
    const [engSelected, setEngSelected] = useState<Set<string>>(new Set())
    const [pendingSelected, setPendingSelected] = useState<Set<string>>(new Set())

    // 刪除確認對話框
    const [deleteDialog, setDeleteDialog] = useState<{
        open: boolean
        type: 'vendor' | 'engineering' | 'pending' | null
        ids: string[]
    }>({ open: false, type: null, ids: [] })

    // Search states
    const [vendorSearch, setVendorSearch] = useState({ start: format(new Date(), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd'), keyword: '' })
    const [engSearch, setEngSearch] = useState({ start: format(new Date(), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd'), keyword: '' })
    // 待處理工作項目預設顯示當日起六個月內
    const [pendingSearch, setPendingSearch] = useState({ start: format(new Date(), 'yyyy-MM-dd'), end: format(addDays(new Date(), 180), 'yyyy-MM-dd'), keyword: '' })

    // 是否已登入
    const isLoggedIn = !!profile



    const refreshAll = async () => {
        setLoading(true)
        const today = format(new Date(), 'yyyy-MM-dd')

        const [v, e, p] = await Promise.all([
            supabase.from('vendor_today_work').select('*').eq('work_date', today),
            supabase.from('engineering_today_work').select('*').lte('start_date', today).gte('end_date', today),
            supabase.from('pending_work').select('*').lte('start_date', today).gte('end_date', today),
        ])

        setVendors(v.data || [])
        setEngineering(e.data || [])
        setPendingWork(p.data || [])
        setVendorSelected(new Set())
        setEngSelected(new Set())
        setPendingSelected(new Set())
        setLoading(false)
    }

    const searchVendor = async () => {
        let query = supabase
            .from('vendor_today_work')
            .select('*')
            .gte('work_date', vendorSearch.start)
            .lte('work_date', vendorSearch.end)

        if (vendorSearch.keyword) {
            query = query.or(`vendor_name.ilike.%${vendorSearch.keyword}%,work_content.ilike.%${vendorSearch.keyword}%,location.ilike.%${vendorSearch.keyword}%,vendor_contact.ilike.%${vendorSearch.keyword}%`)
        }

        const { data } = await query.order('work_date', { ascending: false })
        setVendors(data || [])
        setVendorSelected(new Set())
    }

    const searchEngineering = async () => {
        let query = supabase
            .from('engineering_today_work')
            .select('*')
            .lte('start_date', engSearch.end)
            .gte('end_date', engSearch.start)

        if (engSearch.keyword) {
            query = query.or(`vendor_name.ilike.%${engSearch.keyword}%,work_content.ilike.%${engSearch.keyword}%,note.ilike.%${engSearch.keyword}%`)
        }

        const { data } = await query.order('start_date', { ascending: false })
        setEngineering(data || [])
        setEngSelected(new Set())
    }

    const searchPending = async () => {
        let query = supabase
            .from('pending_work')
            .select('*')
            .lte('start_date', pendingSearch.end)
            .gte('end_date', pendingSearch.start)

        if (pendingSearch.keyword) {
            query = query.or(`vendor_name.ilike.%${pendingSearch.keyword}%,work_content.ilike.%${pendingSearch.keyword}%,note.ilike.%${pendingSearch.keyword}%`)
        }

        const { data } = await query.order('start_date', { ascending: false })
        setPendingWork(data || [])
        setPendingSelected(new Set())
    }

    // 選取功能
    const toggleSelect = (id: string, selected: Set<string>, setSelected: (s: Set<string>) => void) => {
        const newSet = new Set(selected)
        if (newSet.has(id)) {
            newSet.delete(id)
        } else {
            newSet.add(id)
        }
        setSelected(newSet)
    }

    const toggleSelectAll = (items: any[], selected: Set<string>, setSelected: (s: Set<string>) => void) => {
        if (selected.size === items.length) {
            setSelected(new Set())
        } else {
            setSelected(new Set(items.map(i => i.id)))
        }
    }

    // 刪除功能
    const handleDelete = async () => {
        if (!deleteDialog.type || deleteDialog.ids.length === 0) return

        const tableName = deleteDialog.type === 'vendor' ? 'vendor_today_work'
            : deleteDialog.type === 'engineering' ? 'engineering_today_work'
                : 'pending_work'

        try {
            const { error } = await supabase
                .from(tableName)
                .delete()
                .in('id', deleteDialog.ids)

            if (error) throw error

            toast({ title: '刪除成功', description: `已刪除 ${deleteDialog.ids.length} 筆資料` })

            // 更新本地狀態
            if (deleteDialog.type === 'vendor') {
                setVendors(vendors.filter(v => !deleteDialog.ids.includes(v.id)))
                setVendorSelected(new Set())
            } else if (deleteDialog.type === 'engineering') {
                setEngineering(engineering.filter(e => !deleteDialog.ids.includes(e.id)))
                setEngSelected(new Set())
            } else {
                setPendingWork(pendingWork.filter(p => !deleteDialog.ids.includes(p.id)))
                setPendingSelected(new Set())
            }
        } catch (error: any) {
            toast({ title: '刪除失敗', description: error.message, variant: 'destructive' })
        }

        setDeleteDialog({ open: false, type: null, ids: [] })
    }

    // 匯出 Excel
    const exportToExcel = (type: 'vendor' | 'engineering' | 'pending') => {
        const selected = type === 'vendor' ? vendorSelected : type === 'engineering' ? engSelected : pendingSelected
        const sourceData = type === 'vendor' ? vendors : type === 'engineering' ? engineering : pendingWork

        const dataToExport = selected.size > 0 ? sourceData.filter(i => selected.has(i.id)) : sourceData

        if (dataToExport.length === 0) {
            toast({ title: '無資料可匯出', variant: 'destructive' })
            return
        }

        let sheetData: any[] = []
        let filename = ''

        if (type === 'vendor') {
            filename = `廠商今日施工_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`
            sheetData = dataToExport.map((v, index) => ({
                '#': index + 1,
                'ID': v.id,
                '建立時間': v.created_at ? format(new Date(v.created_at), 'yyyy-MM-dd HH:mm:ss') : '',
                '到院或離院': v.entry_status === 'arrival' ? '到院' : '離院',
                '施工日期': v.work_date,
                '到院時間': v.arrival_time || '',
                '離院時間': v.departure_time || '',
                '廠商名稱': v.vendor_name,
                '廠商工作證號': v.vendor_badge_id || '',
                '廠商負責人員姓名': v.vendor_contact || '',
                '廠商負責人員電話': v.vendor_contact_phone || '',
                '棟別': v.building || '',
                '樓層': v.floor || '',
                '施工地點': v.location || '',
                '施工人數': v.head_count || '',
                '施工內容': v.work_content || '',
                '備註': v.note || ''
            }))
        } else {
            // Engineering and Pending share similar structure
            filename = (type === 'engineering' ? '工務今日施工_' : '待處理工作_') + format(new Date(), 'yyyyMMdd_HHmmss') + '.xlsx'
            sheetData = dataToExport.map((item, index) => ({
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
        }

        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.json_to_sheet(sheetData)

        // 設定欄寬
        const wscols = Object.keys(sheetData[0] || {}).map(() => ({ wch: 15 }))
        ws['!cols'] = wscols

        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')

        // 使用 file-saver 確保瀏覽器正確觸發下載
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
        saveAs(new Blob([wbout], { type: 'application/octet-stream' }), filename)

        toast({ title: '匯出成功', description: `已匯出 ${dataToExport.length} 筆資料` })
    }

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* ===== 共用導覽列 ===== */}
            <Navbar onRefresh={refreshAll} loading={loading} />

            {/* Main Content */}
            <main className="flex-1 p-6 space-y-6 overflow-auto">
                {/* Vendor Work Table */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200"
                >
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                        <h2 className="font-black text-slate-700 flex items-center gap-2">
                            <Users className="w-5 h-5 text-blue-500" />
                            廠商今日施工項目
                        </h2>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2 mr-auto">
                                <Input type="date" value={vendorSearch.start} onChange={(e) => setVendorSearch(s => ({ ...s, start: e.target.value }))} className="w-36 h-9" />
                                <span className="text-slate-400">-</span>
                                <Input type="date" value={vendorSearch.end} onChange={(e) => setVendorSearch(s => ({ ...s, end: e.target.value }))} className="w-36 h-9" />
                                <Input placeholder="搜尋關鍵字..." value={vendorSearch.keyword} onChange={(e) => setVendorSearch(s => ({ ...s, keyword: e.target.value }))} className="w-48 h-9" />
                                <Button size="sm" onClick={searchVendor} variant="secondary" className="h-9">
                                    <Search className="w-4 h-4 mr-1" /> 搜尋
                                </Button>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button size="sm" variant="outline" className="h-9" onClick={() => {
                                    const id = Array.from(vendorSelected)[0]
                                    if (id) router.push(`/vendor-work/${id}/edit`)
                                }} disabled={vendorSelected.size !== 1}>
                                    <Edit className="w-4 h-4 mr-1" /> 修改
                                </Button>
                                <Button size="sm" variant="outline" className="h-9 text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-50"
                                    onClick={() => setDeleteDialog({ open: true, type: 'vendor', ids: Array.from(vendorSelected) })}
                                    disabled={vendorSelected.size === 0}>
                                    <Trash2 className="w-4 h-4 mr-1" /> 刪除 {vendorSelected.size > 0 && `(${vendorSelected.size})`}
                                </Button>
                                <Button size="sm" variant="outline" className="h-9" onClick={() => exportToExcel('vendor')}>
                                    <Download className="w-4 h-4 mr-1" /> 匯出
                                </Button>
                                <Button size="sm" className="h-9 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => router.push('/vendor-work/new')}>
                                    <Plus className="w-4 h-4 mr-1" /> 新增
                                </Button>
                            </div>
                        </div>
                    </div>

                    {vendors.length === 0 ? (
                        <EmptyState icon={Users} title="今日暫無廠商施工" description="目前沒有安排任何廠商施工項目，您可以點擊右上方新增。" />
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-slate-50/50">
                                        <TableRow>
                                            <TableHead className="w-12 sticky left-0 bg-slate-50/50 z-10">
                                                <Checkbox checked={vendorSelected.size === vendorTable.paginatedData.length && vendorTable.paginatedData.length > 0} onCheckedChange={() => toggleSelectAll(vendorTable.paginatedData, vendorSelected, setVendorSelected)} />
                                            </TableHead>
                                            <TableHead className="w-12">#</TableHead>
                                            <SortableTableHead label="狀態" sortKey="entry_status" currentSort={vendorTable.sort} onSort={vendorTable.handleSort} />
                                            <SortableTableHead label="日期" sortKey="work_date" currentSort={vendorTable.sort} onSort={vendorTable.handleSort} />
                                            <SortableTableHead label="到院時間" sortKey="arrival_time" currentSort={vendorTable.sort} onSort={vendorTable.handleSort} />
                                            <SortableTableHead label="離院時間" sortKey="departure_time" currentSort={vendorTable.sort} onSort={vendorTable.handleSort} />
                                            <SortableTableHead label="廠商名稱" sortKey="vendor_name" currentSort={vendorTable.sort} onSort={vendorTable.handleSort} />
                                            <SortableTableHead label="工作證號" sortKey="vendor_badge_id" currentSort={vendorTable.sort} onSort={vendorTable.handleSort} />
                                            <SortableTableHead label="負責人" sortKey="vendor_contact" currentSort={vendorTable.sort} onSort={vendorTable.handleSort} />
                                            <TableHead>棟別/樓層</TableHead>
                                            <TableHead>施工地點</TableHead>
                                            <TableHead>人數</TableHead>
                                            <TableHead>施工內容</TableHead>

                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {vendorTable.paginatedData.map((v: any, index: number) => {
                                            const actualIndex = (vendorTable.page - 1) * vendorTable.perPage + index + 1
                                            return (
                                                <TableRow key={v.id} className={`hover:bg-blue-50/50 transition-colors ${vendorSelected.has(v.id) ? 'bg-blue-50' : ''}`}>
                                                    <TableCell className="sticky left-0 bg-white z-10 group-hover:bg-blue-50/50">
                                                        <Checkbox checked={vendorSelected.has(v.id)} onCheckedChange={() => toggleSelect(v.id, vendorSelected, setVendorSelected)} />
                                                    </TableCell>
                                                    <TableCell className="text-slate-400 text-sm">{actualIndex}</TableCell>
                                                    <TableCell><Badge variant={v.entry_status === 'arrival' ? 'default' : 'secondary'} className={v.entry_status === 'arrival' ? 'bg-[var(--primary)]' : ''}>{v.entry_status === 'arrival' ? '到院' : '離院'}</Badge></TableCell>
                                                    <TableCell className="font-mono">{v.work_date}</TableCell>
                                                    <TableCell className="font-mono">{v.arrival_time?.slice(0, 5) || '-'}</TableCell>
                                                    <TableCell className="font-mono">{v.departure_time?.slice(0, 5) || '-'}</TableCell>
                                                    <TableCell className="font-bold text-[var(--primary)]">{v.vendor_name}</TableCell>
                                                    <TableCell>{v.vendor_badge_id || '-'}</TableCell>
                                                    <TableCell>{v.vendor_contact}</TableCell>
                                                    <TableCell>{v.building || '-'} / {v.floor || '-'}</TableCell>
                                                    <TableCell>{v.location || '-'}</TableCell>
                                                    <TableCell>{v.head_count || '-'}</TableCell>
                                                    <TableCell className="max-w-[200px] truncate" title={v.work_content}>{v.work_content}</TableCell>

                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="p-4 border-t border-slate-100">
                                <DataTablePagination

                                    currentPage={vendorTable.page} totalPages={vendorTable.totalPages}
                                    totalItems={vendorTable.totalItems} itemsPerPage={vendorTable.perPage}
                                    onPageChange={vendorTable.setPage} onItemsPerPageChange={vendorTable.setPerPage}
                                    selectedCount={vendorSelected.size}
                                />
                            </div>
                        </>
                    )}
                </motion.section>

                {/* Engineering Work Table */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200"
                >
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                        <h2 className="font-black text-slate-700 flex items-center gap-2">
                            <HardHat className="w-5 h-5 text-amber-500" />
                            工務今日工作項目
                        </h2>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2 mr-auto">
                                <Input type="date" value={engSearch.start} onChange={(e) => setEngSearch(s => ({ ...s, start: e.target.value }))} className="w-36 h-9" />
                                <span className="text-slate-400">-</span>
                                <Input type="date" value={engSearch.end} onChange={(e) => setEngSearch(s => ({ ...s, end: e.target.value }))} className="w-36 h-9" />
                                <Input placeholder="搜尋關鍵字..." value={engSearch.keyword} onChange={(e) => setEngSearch(s => ({ ...s, keyword: e.target.value }))} className="w-48 h-9" />
                                <Button size="sm" onClick={searchEngineering} variant="secondary" className="h-9">
                                    <Search className="w-4 h-4 mr-1" /> 搜尋
                                </Button>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button size="sm" variant="outline" className="h-9" onClick={() => {
                                    const id = Array.from(engSelected)[0]
                                    if (id) router.push(`/engineering-work/${id}/edit`)
                                }} disabled={engSelected.size !== 1}>
                                    <Edit className="w-4 h-4 mr-1" /> 修改
                                </Button>
                                <Button size="sm" variant="outline" className="h-9 text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-50"
                                    onClick={() => setDeleteDialog({ open: true, type: 'engineering', ids: Array.from(engSelected) })}
                                    disabled={engSelected.size === 0}>
                                    <Trash2 className="w-4 h-4 mr-1" /> 刪除 {engSelected.size > 0 && `(${engSelected.size})`}
                                </Button>
                                <Button size="sm" variant="outline" className="h-9" onClick={() => exportToExcel('engineering')}>
                                    <Download className="w-4 h-4 mr-1" /> 匯出
                                </Button>
                                <Button size="sm" className="h-9 bg-amber-600 hover:bg-amber-700 text-white" onClick={() => router.push('/engineering-work/new')}>
                                    <Plus className="w-4 h-4 mr-1" /> 新增
                                </Button>
                            </div>
                        </div>
                    </div>

                    {engineering.length === 0 ? (
                        <EmptyState icon={HardHat} title="今日暫無工務施工" description="目前沒有安排任何工務施工項目，您可以點擊右上方新增。" />
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-slate-50/50">
                                        <TableRow>
                                            <TableHead className="w-12 sticky left-0 bg-slate-50/50 z-10">
                                                <Checkbox checked={engSelected.size === engTable.paginatedData.length && engTable.paginatedData.length > 0} onCheckedChange={() => toggleSelectAll(engTable.paginatedData, engSelected, setEngSelected)} />
                                            </TableHead>
                                            <TableHead className="w-12">#</TableHead>
                                            <SortableTableHead label="開始日期" sortKey="start_date" currentSort={engTable.sort} onSort={engTable.handleSort} />
                                            <SortableTableHead label="結束日期" sortKey="end_date" currentSort={engTable.sort} onSort={engTable.handleSort} />
                                            <SortableTableHead label="時間" sortKey="time" currentSort={engTable.sort} onSort={engTable.handleSort} />
                                            <SortableTableHead label="廠商" sortKey="vendor_name" currentSort={engTable.sort} onSort={engTable.handleSort} />
                                            <SortableTableHead label="單位" sortKey="unit" currentSort={engTable.sort} onSort={engTable.handleSort} />
                                            <SortableTableHead label="負責人" sortKey="engineering_contact" currentSort={engTable.sort} onSort={engTable.handleSort} />
                                            <TableHead>內容</TableHead>
                                            <TableHead>備註</TableHead>

                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {engTable.paginatedData.map((e: any, index: number) => {
                                            const actualIndex = (engTable.page - 1) * engTable.perPage + index + 1
                                            return (
                                                <TableRow key={e.id} className={`hover:bg-amber-50/50 transition-colors ${engSelected.has(e.id) ? 'bg-amber-50' : ''}`}>
                                                    <TableCell className="sticky left-0 bg-white z-10 group-hover:bg-amber-50/50">
                                                        <Checkbox checked={engSelected.has(e.id)} onCheckedChange={() => toggleSelect(e.id, engSelected, setEngSelected)} />
                                                    </TableCell>
                                                    <TableCell className="text-slate-400 text-sm">{actualIndex}</TableCell>
                                                    <TableCell className="font-mono">{e.start_date}</TableCell>
                                                    <TableCell className="font-mono">{e.end_date}</TableCell>
                                                    <TableCell className="font-mono">{e.time?.slice(0, 5) || '-'}</TableCell>
                                                    <TableCell className="font-bold text-amber-600">{e.vendor_name}</TableCell>
                                                    <TableCell><Badge variant="outline" className="bg-amber-50 text-amber-700 hover:bg-amber-100">{e.unit}</Badge></TableCell>
                                                    <TableCell>{e.engineering_contact}</TableCell>
                                                    <TableCell className="max-w-[200px] truncate" title={e.work_content}>{e.work_content}</TableCell>
                                                    <TableCell className="text-slate-400 text-xs">{e.note || '-'}</TableCell>

                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="p-4 border-t border-slate-100">
                                <DataTablePagination
                                    currentPage={engTable.page} totalPages={engTable.totalPages}
                                    totalItems={engTable.totalItems} itemsPerPage={engTable.perPage}
                                    onPageChange={engTable.setPage} onItemsPerPageChange={engTable.setPerPage}
                                    selectedCount={engSelected.size}
                                />
                            </div>
                        </>
                    )}
                </motion.section>

                {/* Pending Work Table */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200"
                >
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                        <h2 className="font-black text-slate-700 flex items-center gap-2">
                            <FileClock className="w-5 h-5 text-purple-500" />
                            待處理工作項目
                        </h2>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2 mr-auto">
                                <Input type="date" value={pendingSearch.start} onChange={(e) => setPendingSearch(s => ({ ...s, start: e.target.value }))} className="w-36 h-9" />
                                <span className="text-slate-400">-</span>
                                <Input type="date" value={pendingSearch.end} onChange={(e) => setPendingSearch(s => ({ ...s, end: e.target.value }))} className="w-36 h-9" />
                                <Input placeholder="搜尋關鍵字..." value={pendingSearch.keyword} onChange={(e) => setPendingSearch(s => ({ ...s, keyword: e.target.value }))} className="w-48 h-9" />
                                <Button size="sm" onClick={searchPending} variant="secondary" className="h-9">
                                    <Search className="w-4 h-4 mr-1" /> 搜尋
                                </Button>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button size="sm" variant="outline" className="h-9" onClick={() => {
                                    const id = Array.from(pendingSelected)[0]
                                    if (id) router.push(`/pending-work/${id}/edit`)
                                }} disabled={pendingSelected.size !== 1}>
                                    <Edit className="w-4 h-4 mr-1" /> 修改
                                </Button>
                                <Button size="sm" variant="outline" className="h-9 text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-50"
                                    onClick={() => setDeleteDialog({ open: true, type: 'pending', ids: Array.from(pendingSelected) })}
                                    disabled={pendingSelected.size === 0}>
                                    <Trash2 className="w-4 h-4 mr-1" /> 刪除 {pendingSelected.size > 0 && `(${pendingSelected.size})`}
                                </Button>
                                <Button size="sm" variant="outline" className="h-9" onClick={() => exportToExcel('pending')}>
                                    <Download className="w-4 h-4 mr-1" /> 匯出
                                </Button>
                                <Button size="sm" className="h-9 bg-purple-600 hover:bg-purple-700 text-white" onClick={() => router.push('/pending-work/new')}>
                                    <Plus className="w-4 h-4 mr-1" /> 新增
                                </Button>
                            </div>
                        </div>
                    </div>

                    {pendingWork.length === 0 ? (
                        <EmptyState icon={FileClock} title="目前無待處理項目" description="沒有需要追蹤的待處理任務，點擊右上方即可新增。" />
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-slate-50/50">
                                        <TableRow>
                                            <TableHead className="w-12 sticky left-0 bg-slate-50/50 z-10">
                                                <Checkbox checked={pendingSelected.size === pendingTable.paginatedData.length && pendingTable.paginatedData.length > 0} onCheckedChange={() => toggleSelectAll(pendingTable.paginatedData, pendingSelected, setPendingSelected)} />
                                            </TableHead>
                                            <TableHead className="w-12">#</TableHead>
                                            <SortableTableHead label="開始日期" sortKey="start_date" currentSort={pendingTable.sort} onSort={pendingTable.handleSort} />
                                            <SortableTableHead label="結束日期" sortKey="end_date" currentSort={pendingTable.sort} onSort={pendingTable.handleSort} />
                                            <SortableTableHead label="時間" sortKey="time" currentSort={pendingTable.sort} onSort={pendingTable.handleSort} />
                                            <SortableTableHead label="廠商" sortKey="vendor_name" currentSort={pendingTable.sort} onSort={pendingTable.handleSort} />
                                            <SortableTableHead label="單位" sortKey="unit" currentSort={pendingTable.sort} onSort={pendingTable.handleSort} />
                                            <SortableTableHead label="負責人" sortKey="engineering_contact" currentSort={pendingTable.sort} onSort={pendingTable.handleSort} />
                                            <TableHead>內容</TableHead>
                                            <TableHead>備註</TableHead>

                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pendingTable.paginatedData.map((p: any, index: number) => {
                                            const actualIndex = (pendingTable.page - 1) * pendingTable.perPage + index + 1
                                            return (
                                                <TableRow key={p.id} className={`hover:bg-purple-50/50 transition-colors ${pendingSelected.has(p.id) ? 'bg-purple-50' : ''}`}>
                                                    <TableCell className="sticky left-0 bg-white z-10 group-hover:bg-purple-50/50">
                                                        <Checkbox checked={pendingSelected.has(p.id)} onCheckedChange={() => toggleSelect(p.id, pendingSelected, setPendingSelected)} />
                                                    </TableCell>
                                                    <TableCell className="text-slate-400 text-sm">{actualIndex}</TableCell>
                                                    <TableCell className="font-mono">{p.start_date}</TableCell>
                                                    <TableCell className="font-mono">{p.end_date}</TableCell>
                                                    <TableCell className="font-mono">{p.time?.slice(0, 5) || '-'}</TableCell>
                                                    <TableCell className="font-bold text-purple-700">{p.vendor_name}</TableCell>
                                                    <TableCell><Badge variant="outline" className="bg-purple-50 text-purple-700 hover:bg-purple-100">{p.unit}</Badge></TableCell>
                                                    <TableCell>{p.engineering_contact}</TableCell>
                                                    <TableCell className="max-w-[200px] truncate" title={p.work_content}>{p.work_content}</TableCell>
                                                    <TableCell className="text-slate-400 text-xs">{p.note || '-'}</TableCell>

                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="p-4 border-t border-slate-100">
                                <DataTablePagination
                                    currentPage={pendingTable.page} totalPages={pendingTable.totalPages}
                                    totalItems={pendingTable.totalItems} itemsPerPage={pendingTable.perPage}
                                    onPageChange={pendingTable.setPage} onItemsPerPageChange={pendingTable.setPerPage}
                                    selectedCount={pendingSelected.size}
                                />
                            </div>
                        </>
                    )}
                </motion.section>
            </main>

            {/* 刪除確認對話框 */}
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
