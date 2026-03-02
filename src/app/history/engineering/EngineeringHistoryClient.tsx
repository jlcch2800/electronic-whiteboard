// Engineering Work History Page - Client Component
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format, subDays } from 'date-fns'
import { motion } from 'framer-motion'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import {
    HardHat, ArrowLeft, Search, ChevronLeft, ChevronRight,
    RefreshCw, Download, Filter
} from 'lucide-react'
import { MobileTableCard } from '@/components/MobileTableCard'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { DataTablePagination } from '@/components/DataTablePagination'
import { useToast } from '@/hooks/use-toast'

interface EngineeringHistoryRecord {
    id: string
    created_at: string
    start_date: string
    end_date: string
    time: string | null
    vendor_name: string
    work_content: string
    unit: string
    engineering_contact: string
    note: string | null
}

export default function EngineeringHistoryClient() {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()

    const [data, setData] = useState<EngineeringHistoryRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [totalCount, setTotalCount] = useState(0)

    // 選取狀態
    const [selected, setSelected] = useState<Set<string>>(new Set())

    const [isFiltersOpen, setIsFiltersOpen] = useState(false)
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [keyword, setKeyword] = useState('')

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

    const fetchData = async () => {
        setLoading(true)

        let query = supabase
            .from('engineering_work_history')
            .select('*', { count: 'exact' })
            .gte('start_date', startDate)
            .lte('start_date', endDate)
            .order('start_date', { ascending: false })
            .order('created_at', { ascending: false })
            .range((page - 1) * pageSize, page * pageSize - 1)

        if (keyword.trim()) {
            query = query.or(`vendor_name.ilike.%${keyword}%,work_content.ilike.%${keyword}%,unit.ilike.%${keyword}%`)
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

    useEffect(() => {
        fetchData()
    }, [page, pageSize])

    const handleSearch = () => {
        setPage(1)
        fetchData()
    }

    // 匯出 Excel
    const handleExport = async () => {
        let dataToExport: EngineeringHistoryRecord[] = []

        if (selected.size > 0) {
            dataToExport = data.filter(r => selected.has(r.id))
        } else {
            let query = supabase
                .from('engineering_work_history')
                .select('*')
                .gte('start_date', startDate)
                .lte('start_date', endDate)
                .order('start_date', { ascending: false })

            if (keyword.trim()) {
                query = query.or(`vendor_name.ilike.%${keyword}%,work_content.ilike.%${keyword}%,unit.ilike.%${keyword}%`)
            }

            const { data: allData } = await query
            dataToExport = allData || []
        }

        if (dataToExport.length === 0) {
            toast({ title: '無資料可匯出', variant: 'destructive' })
            return
        }

        const sheetData = dataToExport.map((row, index) => ({
            '#': index + 1,
            'ID': row.id,
            '建立時間': row.created_at ? format(new Date(row.created_at), 'yyyy-MM-dd HH:mm:ss') : '',
            '開始日期': row.start_date,
            '結束日期': row.end_date,
            '時間': row.time || '',
            '廠商': row.vendor_name,
            '單位': row.unit,
            '負責人': row.engineering_contact,
            '施工內容': row.work_content || '',
            '備註': row.note || ''
        }))

        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.json_to_sheet(sheetData)
        const wscols = Object.keys(sheetData[0] || {}).map(() => ({ wch: 15 }))
        ws['!cols'] = wscols
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
        saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `工務施工歷史_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`)


        toast({ title: '匯出成功', description: `已匯出 ${dataToExport.length} 筆資料` })
    }

    return (
        <div className="min-h-screen bg-slate-100">
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        返回首頁
                    </Button>
                    <div className="h-6 w-px bg-slate-200" />
                    <h1 className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <HardHat className="w-5 h-5 text-amber-500" />
                        工務施工歷史記錄
                    </h1>
                </div>
            </header>

            <main className="p-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200"
                >
                    <div className="p-4 border-b border-slate-100">
                        <div className="flex flex-wrap items-end gap-4">
                            <div className="flex w-full md:hidden justify-between items-center mb-2">
                                <Button size="sm" variant="outline" onClick={() => setIsFiltersOpen(!isFiltersOpen)} className="w-full">
                                    <Filter className="w-4 h-4 mr-2" />
                                    {isFiltersOpen ? '隱藏篩選' : '顯示篩選'}
                                </Button>
                            </div>
                            <div className={`flex-col md:flex-row flex-wrap items-stretch md:items-end gap-4 w-full md:w-auto ${isFiltersOpen ? 'flex' : 'hidden md:flex'}`}>
                                <div className="space-y-1"><Label className="text-xs text-slate-500">開始日期</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full md:w-40" /></div>
                                <div className="space-y-1"><Label className="text-xs text-slate-500">結束日期</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full md:w-40" /></div>
                                <div className="space-y-1"><Label className="text-xs text-slate-500">關鍵字搜尋</Label><Input type="text" placeholder="廠商、單位、施工內容..." value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="w-full md:w-60" /></div>
                                <Button onClick={handleSearch} disabled={loading} className="w-full md:w-auto"><Search className="w-4 h-4 mr-1" />搜尋</Button>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                                <Button variant="outline" onClick={handleExport}><Download className="w-4 h-4 mr-1" />匯出</Button>
                                <Badge variant="outline">{totalCount} 筆</Badge>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <Table className="hidden md:table">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12"><Checkbox checked={selected.size === data.length && data.length > 0} onCheckedChange={toggleSelectAll} /></TableHead>
                                    <TableHead className="w-12">#</TableHead>
                                    <TableHead>建立時間</TableHead>
                                    <TableHead>開始日期</TableHead>
                                    <TableHead>結束日期</TableHead>
                                    <TableHead>時間</TableHead>
                                    <TableHead>廠商</TableHead>
                                    <TableHead>單位</TableHead>
                                    <TableHead>負責人</TableHead>
                                    <TableHead>施工內容</TableHead>
                                    <TableHead>備註</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={11} className="text-center py-8"><RefreshCw className="w-5 h-5 animate-spin mx-auto text-slate-400" /></TableCell></TableRow>
                                ) : data.length === 0 ? (
                                    <TableRow><TableCell colSpan={11} className="text-center py-8 text-slate-400">查無資料</TableCell></TableRow>
                                ) : (
                                    data.map((row, index) => (
                                        <TableRow key={row.id} className={`hover:bg-amber-50/50 ${selected.has(row.id) ? 'bg-amber-100' : ''}`}>
                                            <TableCell><Checkbox checked={selected.has(row.id)} onCheckedChange={() => toggleSelect(row.id)} /></TableCell>
                                            <TableCell className="text-slate-400 text-sm">{index + 1}</TableCell>
                                            <TableCell className="font-mono text-xs text-slate-500 whitespace-nowrap">{row.created_at ? format(new Date(row.created_at), 'yyyy-MM-dd HH:mm') : '-'}</TableCell>
                                            <TableCell className="font-mono">{row.start_date}</TableCell>
                                            <TableCell className="font-mono">{row.end_date}</TableCell>
                                            <TableCell className="font-mono">{row.time?.slice(0, 5) || '-'}</TableCell>
                                            <TableCell className="font-bold">{row.vendor_name}</TableCell>
                                            <TableCell><Badge variant="outline">{row.unit}</Badge></TableCell>
                                            <TableCell>{row.engineering_contact}</TableCell>
                                            <TableCell className="max-w-xs truncate" title={row.work_content}>{row.work_content}</TableCell>
                                            <TableCell className="text-slate-400 text-xs max-w-32 truncate" title={row.note || ''}>{row.note || '-'}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>

                        {/* 手機版卡片列表 */}
                        <div className="md:hidden mt-4 space-y-4 px-1 pb-4">
                            {loading ? (
                                <div className="text-center py-8"><RefreshCw className="w-5 h-5 animate-spin mx-auto text-slate-400" /></div>
                            ) : data.length === 0 ? (
                                <div className="text-center py-8 text-slate-400">查無資料</div>
                            ) : (
                                data.map((row: EngineeringHistoryRecord) => (
                                    <MobileTableCard
                                        key={row.id}
                                        id={row.id}
                                        title={row.vendor_name}
                                        subtitle={row.engineering_contact}
                                        status={{
                                            label: row.unit,
                                            variant: 'outline' as const,
                                            className: 'bg-amber-50 text-amber-700 border-amber-200'
                                        }}
                                        date={row.start_date}
                                        endDate={row.end_date}
                                        time={row.time?.slice(0, 5) || '-'}
                                        isSelected={selected.has(row.id)}
                                        onSelect={() => toggleSelect(row.id)}
                                        details={[
                                            { label: '建立時間', value: row.created_at ? format(new Date(row.created_at), 'yyyy-MM-dd HH:mm') : '-' },
                                            { label: '施工內容', value: row.work_content },
                                            { label: '備註', value: row.note },
                                        ]}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    <div className="p-4 border-t border-slate-100">
                        <DataTablePagination
                            currentPage={page}
                            totalPages={totalPages}
                            totalItems={totalCount}
                            itemsPerPage={pageSize}
                            onPageChange={setPage}
                            onItemsPerPageChange={(size) => {
                                setPageSize(size)
                                setPage(1)
                            }}
                            selectedCount={selected.size}
                        />
                    </div>
                </motion.div>
            </main>
        </div>
    )
}
