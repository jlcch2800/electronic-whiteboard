// Vendor Work History Page - Client Component
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format, subDays } from 'date-fns'
import { motion } from 'framer-motion'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import {
    Users, ArrowLeft, Search, ChevronLeft, ChevronRight,
    RefreshCw, Download
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

interface VendorHistoryRecord {
    id: string
    created_at: string
    entry_status: 'arrival' | 'departure'
    work_date: string
    arrival_time: string | null
    departure_time: string | null
    building: string | null
    floor: string | null
    location: string | null
    vendor_badge_id: number | null
    head_count: number | null
    vendor_name: string
    vendor_contact: string | null
    vendor_contact_phone: string | null
    work_content: string | null
    note: string | null
}

export default function VendorHistoryClient() {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()

    // Data state
    const [data, setData] = useState<VendorHistoryRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [totalCount, setTotalCount] = useState(0)

    // 選取狀態
    const [selected, setSelected] = useState<Set<string>>(new Set())

    // Filter state
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [keyword, setKeyword] = useState('')

    // Pagination state
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)

    const totalPages = Math.ceil(totalCount / pageSize)

    // 選取功能
    const toggleSelect = (id: string) => {
        const newSet = new Set(selected)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setSelected(newSet)
    }

    const toggleSelectAll = () => {
        if (selected.size === data.length && data.length > 0) {
            setSelected(new Set())
        } else {
            setSelected(new Set(data.map(i => i.id)))
        }
    }

    // Fetch data
    const fetchData = async () => {
        setLoading(true)

        let query = supabase
            .from('vendor_today_work_history')
            .select('*', { count: 'exact' })
            .gte('work_date', startDate)
            .lte('work_date', endDate)
            .order('work_date', { ascending: false })
            .order('created_at', { ascending: false })
            .range((page - 1) * pageSize, page * pageSize - 1)

        // Keyword search (search in vendor_name, work_content, note)
        if (keyword.trim()) {
            query = query.or(`vendor_name.ilike.%${keyword}%,work_content.ilike.%${keyword}%,note.ilike.%${keyword}%`)
        }

        const { data: records, count, error } = await query

        if (error) {
            console.error('Fetch error:', error)
        } else {
            setData(records || [])
            setTotalCount(count || 0)
        }

        setSelected(new Set())
        setLoading(false)
    }

    // Initial fetch
    useEffect(() => {
        fetchData()
    }, [page, pageSize])

    // Handle search
    const handleSearch = () => {
        setPage(1)
        fetchData()
    }

    // 匯出 Excel
    const handleExport = async () => {
        // 如果有選取，匯出選取的；否則取得全部符合篩選條件的資料
        let dataToExport: VendorHistoryRecord[] = []

        if (selected.size > 0) {
            dataToExport = data.filter(r => selected.has(r.id))
        } else {
            // Fetch all data for export
            let query = supabase
                .from('vendor_today_work_history')
                .select('*')
                .gte('work_date', startDate)
                .lte('work_date', endDate)
                .order('work_date', { ascending: false })

            if (keyword.trim()) {
                query = query.or(`vendor_name.ilike.%${keyword}%,work_content.ilike.%${keyword}%,note.ilike.%${keyword}%`)
            }

            const { data: allData } = await query
            dataToExport = allData || []
        }

        if (dataToExport.length === 0) {
            toast({ title: '無資料可匯出', variant: 'destructive' })
            return
        }

        // 轉換為 Excel 格式
        const sheetData = dataToExport.map((row, index) => ({
            '#': index + 1,
            'ID': row.id,
            '建立時間': row.created_at ? format(new Date(row.created_at), 'yyyy-MM-dd HH:mm:ss') : '',
            '到院或離院': row.entry_status === 'arrival' ? '到院' : '離院',
            '施工日期': row.work_date,
            '到院時間': row.arrival_time || '',
            '離院時間': row.departure_time || '',
            '廠商名稱': row.vendor_name,
            '廠商工作證號': row.vendor_badge_id || '',
            '廠商負責人員姓名': row.vendor_contact || '',
            '廠商負責人員電話': row.vendor_contact_phone || '',
            '棟別': row.building || '',
            '樓層': row.floor || '',
            '施工地點': row.location || '',
            '施工人數': row.head_count || '',
            '施工內容': row.work_content || '',
            '備註': row.note || ''
        }))

        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.json_to_sheet(sheetData)
        const wscols = Object.keys(sheetData[0] || {}).map(() => ({ wch: 15 }))
        ws['!cols'] = wscols
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
        saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `廠商施工歷史_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`)


        toast({ title: '匯出成功', description: `已匯出 ${dataToExport.length} 筆資料` })
    }

    return (
        <div className="min-h-screen bg-slate-100">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        返回首頁
                    </Button>
                    <div className="h-6 w-px bg-slate-200" />
                    <h1 className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-500" />
                        廠商施工歷史記錄
                    </h1>
                </div>
            </header>

            {/* Main Content */}
            <main className="p-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200"
                >
                    {/* Filter Bar */}
                    <div className="p-4 border-b border-slate-100">
                        <div className="flex flex-wrap items-end gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-500">開始日期</Label>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-40"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-500">結束日期</Label>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-40"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-500">關鍵字搜尋</Label>
                                <Input
                                    type="text"
                                    placeholder="廠商名稱、施工內容..."
                                    value={keyword}
                                    onChange={(e) => setKeyword(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    className="w-60"
                                />
                            </div>
                            <Button onClick={handleSearch} disabled={loading}>
                                <Search className="w-4 h-4 mr-1" />
                                搜尋
                            </Button>
                            <Button variant="outline" onClick={handleExport}>
                                <Download className="w-4 h-4 mr-1" />
                                匯出
                            </Button>

                            <div className="flex-1" />

                            {/* Page Size Selector */}
                            <div className="flex items-center gap-2">
                                <Label className="text-xs text-slate-500">每頁顯示</Label>
                                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}>
                                    <SelectTrigger className="w-20">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                        <SelectItem value="100">100</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Badge variant="outline" className="text-sm">
                                共 {totalCount} 筆
                            </Badge>
                        </div>
                    </div>

                    {/* Table */}
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
                                    <TableHead className="text-xs">ID</TableHead>
                                    <TableHead>建立時間</TableHead>
                                    <TableHead>狀態</TableHead>
                                    <TableHead>日期</TableHead>
                                    <TableHead>到院時間</TableHead>
                                    <TableHead>離院時間</TableHead>
                                    <TableHead>廠商名稱</TableHead>
                                    <TableHead>廠商工作證號</TableHead>
                                    <TableHead>廠商負責人員姓名</TableHead>
                                    <TableHead>廠商負責人員電話</TableHead>
                                    <TableHead>棟別</TableHead>
                                    <TableHead>樓層</TableHead>
                                    <TableHead>施工地點</TableHead>
                                    <TableHead>施工人數</TableHead>
                                    <TableHead>施工內容</TableHead>
                                    <TableHead>備註</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={18} className="text-center py-8">
                                            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-slate-400" />
                                        </TableCell>
                                    </TableRow>
                                ) : data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={18} className="text-center py-8 text-slate-400">
                                            查無資料
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    data.map((row, index) => (
                                        <TableRow key={row.id} className={`hover:bg-blue-50/50 ${selected.has(row.id) ? 'bg-blue-100' : ''}`}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={selected.has(row.id)}
                                                    onCheckedChange={() => toggleSelect(row.id)}
                                                />
                                            </TableCell>
                                            <TableCell className="text-slate-400 text-sm">{index + 1}</TableCell>
                                            <TableCell className="font-mono text-xs text-slate-400 max-w-[80px] truncate" title={row.id}>{row.id?.slice(0, 8)}...</TableCell>
                                            <TableCell className="font-mono text-xs text-slate-500 whitespace-nowrap">{row.created_at ? format(new Date(row.created_at), 'yyyy-MM-dd HH:mm') : '-'}</TableCell>
                                            <TableCell>
                                                <Badge variant={row.entry_status === 'arrival' ? 'default' : 'secondary'}>
                                                    {row.entry_status === 'arrival' ? '到院' : '離院'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-mono">{row.work_date}</TableCell>
                                            <TableCell className="font-mono">{row.arrival_time?.slice(0, 5) || '-'}</TableCell>
                                            <TableCell className="font-mono">{row.departure_time?.slice(0, 5) || '-'}</TableCell>
                                            <TableCell className="font-bold">{row.vendor_name}</TableCell>
                                            <TableCell className="font-mono">{row.vendor_badge_id || '-'}</TableCell>
                                            <TableCell>{row.vendor_contact || '-'}</TableCell>
                                            <TableCell className="font-mono">{row.vendor_contact_phone || '-'}</TableCell>
                                            <TableCell>{row.building || '-'}</TableCell>
                                            <TableCell>{row.floor || '-'}</TableCell>
                                            <TableCell>{row.location || '-'}</TableCell>
                                            <TableCell>{row.head_count || '-'}</TableCell>
                                            <TableCell className="max-w-xs truncate" title={row.work_content || ''}>
                                                {row.work_content || '-'}
                                            </TableCell>
                                            <TableCell className="text-slate-400 text-xs max-w-32 truncate" title={row.note || ''}>
                                                {row.note || '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="p-4 border-t border-slate-100 flex justify-center items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page === 1}
                                onClick={() => setPage(p => p - 1)}
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <span className="text-sm text-slate-600 min-w-24 text-center">
                                第 {page} / {totalPages} 頁
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page === totalPages}
                                onClick={() => setPage(p => p + 1)}
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    )}
                </motion.div>
            </main>
        </div>
    )
}
