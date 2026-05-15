'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    Activity, ArrowLeft, Download, Plus, Search, Trash2, 
    RefreshCcw, CheckCircle2, MoreHorizontal, Edit2
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
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
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { exportToExcel } from '@/lib/utils' // 假設已有匯出工具

export default function StatusDetailPageClient({ status }: { status: string }) {
    const router = useRouter()
    const { user, profile } = useAuth()
    const supabase = createClient()
    const isAdmin = profile?.role === 'admin'

    // 資料狀態
    const [data, setData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [selected, setSelected] = useState<Set<string>>(new Set())

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
                query = query.or(`work_order_id.ilike.%${searchTerm}%,maintain_content.ilike.%${searchTerm}%,request_department.ilike.%${searchTerm}%,handler_name.ilike.%${searchTerm}%`)
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
            const { error } = await supabase.from('maintenance_work_orders').delete().in('id', deleteDialog.ids)
            if (error) throw error
            toast({ title: '刪除成功', description: `已刪除 ${deleteDialog.ids.length} 筆紀錄` })
            refreshData()
        } catch (error: any) {
            toast({ title: '刪除失敗', description: error.message, variant: 'destructive' })
        } finally {
            setDeleteDialog({ open: false, ids: [] })
        }
    }

    return (
        <div className="min-h-screen bg-slate-50/50 flex flex-col">
            <Navbar onRefresh={refreshData} />

            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.push('/maintenance-work/status')}>
                        <ArrowLeft className="w-4 h-4 mr-1" />返回儀表板
                    </Button>
                    <div className="h-6 w-px bg-slate-200" />
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <Badge className="bg-primary/10 text-primary border-primary/20">{status}</Badge>
                        明細列表
                    </h1>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => router.push(`/maintenance-work/edit/${Array.from(selected)[0]}`)} 
                        disabled={selected.size !== 1 || loading}
                        className="px-2 sm:px-4 border-primary text-primary hover:bg-primary/5 disabled:opacity-50"
                    >
                        <Edit2 className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">修改</span>
                    </Button>
                    {selected.size > 0 && isAdmin && (
                        <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={() => setDeleteDialog({ open: true, ids: Array.from(selected) })} 
                            disabled={loading}
                            className="px-2 sm:px-4"
                        >
                            <Trash2 className="w-4 h-4 sm:mr-2" />
                            <span className="hidden sm:inline">刪除 ({selected.size})</span>
                            <span className="sm:hidden">{selected.size}</span>
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => {/* TODO: Implement Export */}} disabled={loading} className="px-2 sm:px-4">
                        <Download className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">匯出 Excel</span>
                    </Button>
                    <Button className="bg-orange-600 hover:bg-orange-700 text-white px-2 sm:px-4" size="sm" onClick={() => router.push('/maintenance-work/new')}>
                        <Plus className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">新增維修單</span>
                    </Button>
                </div>
            </header>

            <main className="flex-1 p-6 max-w-[1600px] mx-auto w-full">
                <div className="mb-6 flex justify-between items-center">
                    <div className="relative w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="搜尋工單、部門、承辦人..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-white"
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
                        <div className="hidden md:block rounded-xl border bg-white shadow-sm overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50/80">
                                    <TableRow>
                                        <TableHead className="w-[40px] px-4">
                                            <Checkbox
                                                checked={selected.size === data.length && data.length > 0}
                                                onCheckedChange={toggleSelectAll}
                                            />
                                        </TableHead>
                                        <SortableTableHead sortKey="work_order_id" currentSort={sort} onSort={handleSort} label="工單編號" />
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
                                        <TableRow key={item.id} className="hover:bg-slate-50/50">
                                            <TableCell className="px-4">
                                                <Checkbox
                                                    checked={selected.has(item.id)}
                                                    onCheckedChange={() => toggleSelect(item.id)}
                                                />
                                            </TableCell>
                                            <TableCell className="font-mono font-bold text-slate-700">{item.work_order_id}</TableCell>
                                            <TableCell className="text-slate-500">{item.request_date}</TableCell>
                                            <TableCell>{item.request_department}</TableCell>
                                            <TableCell>{item.cost_center}</TableCell>
                                            <TableCell>{item.requester_name}</TableCell>
                                            <TableCell className="max-w-xs truncate" title={item.maintain_content}>
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

                        {/* 行動版 */}
                        <div className="grid grid-cols-1 gap-4 md:hidden">
                            {data.map((item) => (
                                <MobileTableCard
                                    key={item.id}
                                    id={item.id}
                                    title={item.work_order_id}
                                    subtitle={item.request_department}
                                    status={{ label: item.status, variant: 'default' }}
                                    date={item.request_date}
                                    details={[
                                        { label: '承辦人', value: item.handler_name },
                                        { label: '內容', value: item.maintain_content },
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
        </div>
    )
}
