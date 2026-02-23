'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { motion } from 'framer-motion'
import {
    HardHat, Plus, Search, Edit, Trash2, Download, ArrowLeft, RefreshCw
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
import { useToast } from '@/hooks/use-toast'

interface EngineeringWorkClientProps {
    initialData: any[]
}

export default function EngineeringWorkClient({ initialData }: EngineeringWorkClientProps) {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()
    const { profile } = useAppStore()
    const isLoggedIn = !!profile

    const [data, setData] = useState(initialData)
    const [loading, setLoading] = useState(false)
    const [selected, setSelected] = useState<Set<string>>(new Set())

    // Search state
    const [search, setSearch] = useState({
        start: format(new Date(), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd'),
        keyword: ''
    })

    // Delete dialog
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean, ids: string[] }>({
        open: false, ids: []
    })

    const refreshData = async () => {
        setLoading(true)
        const { data: result } = await supabase
            .from('engineering_today_work')
            .select('*')
            .lte('start_date', search.end)
            .gte('end_date', search.start)
            .order('start_date', { ascending: false })

        setData(result || [])
        setSelected(new Set())
        setLoading(false)
    }

    const handleSearch = async () => {
        setLoading(true)
        let query = supabase
            .from('engineering_today_work')
            .select('*')
            .lte('start_date', search.end)
            .gte('end_date', search.start)

        if (search.keyword) {
            query = query.or(`vendor_name.ilike.%${search.keyword}%,work_content.ilike.%${search.keyword}%,note.ilike.%${search.keyword}%`)
        }

        const { data: result } = await query.order('start_date', { ascending: false })
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
                .from('engineering_today_work')
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

        const sheetData = dataToExport.map((item, index) => ({
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

        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.json_to_sheet(sheetData)

        // 設定欄寬
        const wscols = Object.keys(sheetData[0] || {}).map(() => ({ wch: 15 }))
        ws['!cols'] = wscols

        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
        saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `工務今日施工_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`)

        toast({ title: '匯出成功', description: `已匯出 ${dataToExport.length} 筆資料` })
    }

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        返回首頁
                    </Button>
                    <div className="h-6 w-px bg-slate-200" />
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <HardHat className="w-6 h-6 text-amber-500" />
                        工務今日施工項目
                    </h1>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-6 overflow-auto">
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200"
                >
                    <div className="p-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Input
                                type="date"
                                value={search.start}
                                onChange={(e) => setSearch(s => ({ ...s, start: e.target.value }))}
                                className="w-36"
                            />
                            <span className="text-slate-400">~</span>
                            <Input
                                type="date"
                                value={search.end}
                                onChange={(e) => setSearch(s => ({ ...s, end: e.target.value }))}
                                className="w-36"
                            />
                            <Input
                                placeholder="搜尋關鍵字..."
                                value={search.keyword}
                                onChange={(e) => setSearch(s => ({ ...s, keyword: e.target.value }))}
                                className="w-40"
                            />
                            <Button size="sm" onClick={handleSearch} disabled={loading}>
                                <Search className="w-4 h-4 mr-1" /> 搜尋
                            </Button>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button size="sm" onClick={() => router.push('/engineering-work/new')} className="bg-amber-600 hover:bg-amber-700">
                                <Plus className="w-4 h-4 mr-1" /> 新增
                            </Button>

                            <Button size="sm" variant="outline" onClick={() => {
                                const id = Array.from(selected)[0]
                                if (id) router.push(`/engineering-work/${id}/edit`)
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
                                    <TableHead>開始日期</TableHead>
                                    <TableHead>結束日期</TableHead>
                                    <TableHead>時間</TableHead>
                                    <TableHead>廠商</TableHead>
                                    <TableHead>單位</TableHead>
                                    <TableHead>負責人</TableHead>
                                    <TableHead>內容</TableHead>
                                    <TableHead>備註</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={11} className="text-center py-8 text-slate-400">
                                            查無資料
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    data.map((e: any, index: number) => (
                                        <TableRow key={e.id} className={`hover:bg-amber-50/50 ${selected.has(e.id) ? 'bg-amber-100' : ''}`}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={selected.has(e.id)}
                                                    onCheckedChange={() => toggleSelect(e.id)}
                                                />
                                            </TableCell>
                                            <TableCell className="text-slate-400 text-sm">{index + 1}</TableCell>
                                            <TableCell className="font-mono">{e.start_date}</TableCell>
                                            <TableCell className="font-mono">{e.end_date}</TableCell>
                                            <TableCell className="font-mono">{e.time?.slice(0, 5) || '-'}</TableCell>
                                            <TableCell className="font-bold">{e.vendor_name}</TableCell>
                                            <TableCell><Badge variant="outline">{e.unit}</Badge></TableCell>
                                            <TableCell>{e.engineering_contact}</TableCell>
                                            <TableCell className="max-w-xs truncate" title={e.work_content}>{e.work_content}</TableCell>
                                            <TableCell className="text-slate-400 text-xs">{e.note || '-'}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
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
