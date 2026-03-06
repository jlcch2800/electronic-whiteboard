'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { motion } from 'framer-motion'
import {
    Users, Plus, Search, Edit, Trash2, Download, ArrowLeft, RefreshCw, Filter
} from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'

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
import { useToast } from '@/hooks/use-toast'
import { MobileTableCard } from '@/components/MobileTableCard'
import { DataTablePagination } from '@/components/DataTablePagination'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { SkeletonTable } from '@/components/SkeletonTable'

interface VendorWorkClientProps {
    initialData: any[]
}

export default function VendorWorkClient({ initialData }: VendorWorkClientProps) {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()
    const { profile } = useAppStore()
    const isLoggedIn = !!profile

    const [data, setData] = useState(initialData)
    const [loading, setLoading] = useState(false)
    const [selected, setSelected] = useState<Set<string>>(new Set())

    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)
    const [totalItems, setTotalItems] = useState(0)
    const [totalPages, setTotalPages] = useState(0)

    // Search state
    const [search, setSearch] = useState({
        start: format(new Date(), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd'),
        keyword: ''
    })
    const [isFiltersOpen, setIsFiltersOpen] = useState(false)

    // 排序狀態
    const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
    const handleSort = (key: string) => {
        setSort(prev => {
            if (prev?.key === key && prev.direction === 'asc') return { key, direction: 'desc' }
            if (prev?.key === key && prev.direction === 'desc') return null
            return { key, direction: 'asc' }
        })
    }
    const sortedData = useMemo(() => {
        if (!sort) return data
        return [...data].sort((a, b) => {
            const valA = a[sort.key] ?? ''
            const valB = b[sort.key] ?? ''
            if (valA < valB) return sort.direction === 'asc' ? -1 : 1
            if (valA > valB) return sort.direction === 'asc' ? 1 : -1
            return 0
        })
    }, [data, sort])

    // Delete dialog
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean, ids: string[] }>({
        open: false, ids: []
    })

    // 載入初始資料筆數與頁數
    useEffect(() => {
        refreshData()
    }, [currentPage, itemsPerPage])

    const refreshData = async () => {
        setLoading(true)

        // 取得總筆數
        const { count } = await supabase
            .from('vendor_today_work')
            .select('*', { count: 'exact', head: true })
            .gte('work_date', search.start)
            .lte('work_date', search.end)

        const total = count || 0
        setTotalItems(total)
        setTotalPages(Math.ceil(total / itemsPerPage))

        // 取得分頁資料
        const { data: result } = await supabase
            .from('vendor_today_work')
            .select('*')
            .gte('work_date', search.start)
            .lte('work_date', search.end)
            .order('work_date', { ascending: false })
            .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1)

        setData(result || [])
        setSelected(new Set())
        setLoading(false)
    }

    const handleSearch = async () => {
        // 重設為第一頁
        setCurrentPage(1)

        setLoading(true)

        // 建立查詢條件
        let countQuery = supabase
            .from('vendor_today_work')
            .select('*', { count: 'exact', head: true })
            .gte('work_date', search.start)
            .lte('work_date', search.end)

        let dataQuery = supabase
            .from('vendor_today_work')
            .select('*')
            .gte('work_date', search.start)
            .lte('work_date', search.end)

        if (search.keyword) {
            const keywordFilter = `vendor_name.ilike.%${search.keyword}%,work_content.ilike.%${search.keyword}%,location.ilike.%${search.keyword}%,vendor_contact.ilike.%${search.keyword}%,entry_status.ilike.%${search.keyword}%,work_date.ilike.%${search.keyword}%,building.ilike.%${search.keyword}%,floor.ilike.%${search.keyword}%,vendor_badge_id.ilike.%${search.keyword}%,vendor_phone.ilike.%${search.keyword}%,note.ilike.%${search.keyword}%`
            countQuery = countQuery.or(keywordFilter)
            dataQuery = dataQuery.or(keywordFilter)
        }

        // 取得總筆數
        const { count } = await countQuery
        const total = count || 0
        setTotalItems(total)
        setTotalPages(Math.ceil(total / itemsPerPage))

        // 取得第一頁資料
        const { data: result } = await dataQuery
            .order('work_date', { ascending: false })
            .range(0, itemsPerPage - 1)

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
                .from('vendor_today_work')
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

        const sheetData = dataToExport.map((v, index) => ({
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

        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.json_to_sheet(sheetData)

        // 設定欄寬
        const wscols = Object.keys(sheetData[0] || {}).map(() => ({ wch: 15 }))
        ws['!cols'] = wscols

        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
        saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `廠商今日施工_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`)

        toast({ title: '匯出成功', description: `已匯出 ${dataToExport.length} 筆資料` })
    }

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
                        <Users className="w-6 h-6 text-blue-500" />
                        廠商今日施工項目
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
                            <Button size="sm" onClick={() => router.push('/vendor-work/new')} className="bg-green-600 hover:bg-green-700">
                                <Plus className="w-4 h-4 mr-1" /> 新增
                            </Button>

                            <Button size="sm" variant="outline" onClick={() => {
                                const id = Array.from(selected)[0]
                                if (id) router.push(`/vendor-work/${id}/edit`)
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
                            <Badge variant="outline">{data.length} 筆</Badge>
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
                                            <TableHead className="w-12">
                                                <Checkbox
                                                    checked={selected.size === data.length && data.length > 0}
                                                    onCheckedChange={toggleSelectAll}
                                                />
                                            </TableHead>
                                            <TableHead className="w-12">#</TableHead>
                                            <SortableTableHead label="狀態" sortKey="entry_status" currentSort={sort} onSort={handleSort} />
                                            <SortableTableHead label="日期" sortKey="work_date" currentSort={sort} onSort={handleSort} />
                                            <SortableTableHead label="到院時間" sortKey="arrival_time" currentSort={sort} onSort={handleSort} />
                                            <SortableTableHead label="離院時間" sortKey="departure_time" currentSort={sort} onSort={handleSort} />
                                            <SortableTableHead label="廠商名稱" sortKey="vendor_name" currentSort={sort} onSort={handleSort} />
                                            <SortableTableHead label="廠商工作證號" sortKey="vendor_badge_id" currentSort={sort} onSort={handleSort} />
                                            <SortableTableHead label="廠商負責人員姓名" sortKey="vendor_contact" currentSort={sort} onSort={handleSort} />
                                            <TableHead>廠商負責人員電話</TableHead>
                                            <SortableTableHead label="棟別" sortKey="building" currentSort={sort} onSort={handleSort} />
                                            <SortableTableHead label="樓層" sortKey="floor" currentSort={sort} onSort={handleSort} />
                                            <SortableTableHead label="施工地點" sortKey="location" currentSort={sort} onSort={handleSort} />
                                            <SortableTableHead label="施工人數" sortKey="head_count" currentSort={sort} onSort={handleSort} />
                                            <TableHead>施工內容</TableHead>
                                            <TableHead>備註</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedData.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={17} className="p-0">
                                                    <EmptyState icon={Users} title="今日暫無廠商施工" description="目前沒有安排任何廠商施工項目，您可以點擊右上方新增。" />
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            sortedData.map((v: any, index: number) => {
                                                const actualIndex = (currentPage - 1) * itemsPerPage + index + 1
                                                return (
                                                    <TableRow key={v.id} className={`table-row-hover hover:bg-primary/5 transition-all duration-200 even:bg-muted/20 ${selected.has(v.id) ? 'bg-primary/5' : ''}`}>
                                                        <TableCell className="sticky left-0 bg-card z-10">
                                                            <Checkbox checked={selected.has(v.id)} onCheckedChange={() => toggleSelect(v.id)} />
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground text-sm">{actualIndex}</TableCell>
                                                        <TableCell>
                                                            <Badge variant={v.entry_status === 'arrival' ? 'default' : 'secondary'} className={v.entry_status === 'arrival' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-muted text-foreground/80 hover:bg-slate-200'}>
                                                                {v.entry_status === 'arrival' ? '到院' : '離院'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="font-mono">{v.work_date}</TableCell>
                                                        <TableCell className="font-mono">{v.arrival_time?.slice(0, 5) || '-'}</TableCell>
                                                        <TableCell className="font-mono">{v.departure_time?.slice(0, 5) || '-'}</TableCell>
                                                        <TableCell className="font-bold text-blue-600">{v.vendor_name}</TableCell>
                                                        <TableCell>{v.vendor_badge_id || '-'}</TableCell>
                                                        <TableCell>{v.vendor_contact}</TableCell>
                                                        <TableCell className="font-mono">{v.vendor_contact_phone || '-'}</TableCell>
                                                        <TableCell>{v.building || '-'}</TableCell>
                                                        <TableCell>{v.floor || '-'}</TableCell>
                                                        <TableCell className="max-w-[150px] truncate" title={v.location}>{v.location}</TableCell>
                                                        <TableCell>{v.head_count || '-'}</TableCell>
                                                        <TableCell className="max-w-[200px] truncate" title={v.work_content}>{v.work_content}</TableCell>
                                                        <TableCell className="max-w-[150px] truncate" title={v.note}>{v.note || '-'}</TableCell>
                                                    </TableRow>
                                                )
                                            })
                                        )}
                                    </TableBody>
                                </Table>

                                {/* 手機版卡片列表 */}
                                <div className="md:hidden mt-4 space-y-4 px-1 pb-4">
                                    {sortedData.length === 0 ? (
                                        <EmptyState icon={Users} title="今日暫無廠商施工" description="目前沒有安排任何廠商施工項目，您可以點擊右上方新增。" />
                                    ) : (
                                        sortedData.map((v: any) => (
                                            <MobileTableCard
                                                key={v.id}
                                                id={v.id}
                                                title={v.vendor_name}
                                                subtitle={v.vendor_contact}
                                                status={{
                                                    label: '廠商',
                                                    variant: 'outline',
                                                    className: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                                }}
                                                date={v.work_date}
                                                time={v.time?.slice(0, 5) || '-'}
                                                isSelected={selected.has(v.id)}
                                                onSelect={() => toggleSelect(v.id)}
                                                onClick={() => router.push(`/vendor-work/${v.id}/edit`)}
                                                details={[
                                                    { label: "狀態", value: v.entry_status === 'arrival' ? '到院' : '離院' },
                                                    { label: "工作證號", value: v.vendor_badge_id },
                                                    { label: "聯絡人", value: v.vendor_contact },
                                                    { label: "聯絡電話", value: v.vendor_contact_phone },
                                                    { label: "棟別", value: v.building },
                                                    { label: "樓層", value: v.floor },
                                                    { label: "地點", value: v.location },
                                                    { label: "人數", value: v.head_count },
                                                    { label: "內容", value: v.work_content },
                                                    { label: "備註", value: v.note }
                                                ]}
                                            />
                                        ))
                                    )}
                                </div>

                                <div className="p-4 border-t border-border/50">
                                    <DataTablePagination
                                        currentPage={currentPage}
                                        totalPages={totalPages}
                                        totalItems={totalItems}
                                        itemsPerPage={itemsPerPage}
                                        onPageChange={setCurrentPage}
                                        onItemsPerPageChange={(value) => {
                                            setItemsPerPage(value)
                                            setCurrentPage(1)
                                        }}
                                        selectedCount={selected.size}
                                    />
                                </div>
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
