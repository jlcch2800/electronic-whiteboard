// Whiteboard Client Component
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, subDays, addDays } from 'date-fns'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { motion } from 'framer-motion'
import {
    Users, HardHat, FileClock, ClipboardCheck, History, UserCog, Activity,
    LogOut, BookOpen, RefreshCw, Plus, Search, ChevronDown, Edit, Trash2, FileText, Download, Calendar, Home
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { handleLogout as serverHandleLogout } from '@/actions/auth'
import { useAppStore } from '@/stores/useAppStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'

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
    const { profile, isLoading: authLoading, logout: storeLogout } = useAppStore()

    const [vendors, setVendors] = useState(initialVendors)
    const [engineering, setEngineering] = useState(initialEngineering)
    const [pendingWork, setPendingWork] = useState(initialPending)
    const [loading, setLoading] = useState(false)

    // Clock state
    const [currentTime, setCurrentTime] = useState(new Date())

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date())
        }, 1000)
        return () => clearInterval(timer)
    }, [])

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

    const handleLogout = async () => {
        if (profile?.id) {
            await serverHandleLogout(profile.id)
        }
        await supabase.auth.signOut()
        storeLogout()
        router.push('/login')
    }

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
        <div className="min-h-screen bg-slate-100 flex flex-col">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-black text-slate-800">🏥 工務室電子白板</h1>
                </div>

                <div className="flex items-center gap-4">
                    {/* Clock */}
                    <div className="text-sm font-medium text-slate-600 tabular-nums">
                        {format(currentTime, 'yyyy/MM/dd HH:mm:ss')}
                    </div>

                    {/* Home Link */}
                    <Button variant="ghost" className="gap-2" onClick={() => router.push('/')}>
                        <Home className="w-4 h-4" />
                        首頁
                    </Button>

                    {/* 今日-待處理 Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="gap-2">
                                <Calendar className="w-4 h-4" />
                                今日-待處理
                                <ChevronDown className="w-3 h-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => router.push('/vendor-work')}>廠商今日施工</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push('/engineering-work')}>工務今日施工</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push('/pending-work')}>待處理工作</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push('/')}>All</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Work Report & File Menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="gap-2">
                                <ClipboardCheck className="w-4 h-4" />
                                施工回報
                                <ChevronDown className="w-3 h-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => router.push('/work-report')}>
                                <ClipboardCheck className="w-4 h-4 mr-2" /> 施工回報
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push('/work-file')}>
                                <FileText className="w-4 h-4 mr-2" /> 施工文件
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* History Menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="gap-2">
                                <History className="w-4 h-4" />
                                歷史記錄
                                <ChevronDown className="w-3 h-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => router.push('/history/vendor')}>
                                <Users className="w-4 h-4 mr-2" /> 廠商施工歷史
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push('/history/engineering')}>
                                <HardHat className="w-4 h-4 mr-2" /> 工務施工歷史
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push('/history/pending')}>
                                <FileClock className="w-4 h-4 mr-2" /> 待處理工作歷史
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push('/history/report')}>
                                <ClipboardCheck className="w-4 h-4 mr-2" /> 施工回報歷史
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Admin - only show for admin users */}
                    {profile?.role === 'admin' && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="gap-2">
                                    <UserCog className="w-4 h-4" />
                                    系統管理
                                    <ChevronDown className="w-3 h-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => router.push('/admin/users')}>
                                    <UserCog className="w-4 h-4 mr-2" /> 帳號管理
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => router.push('/admin/change-log')}>
                                    <Activity className="w-4 h-4 mr-2" /> 系統異動記錄
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => router.push('/admin/execution-log')}>
                                    <Activity className="w-4 h-4 mr-2" /> 系統執行記錄
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}

                    <div className="h-6 w-px bg-slate-200" />

                    {/* User Info */}
                    {authLoading ? (
                        <div className="flex items-center gap-3">
                            <div className="animate-pulse">
                                <div className="h-3 w-16 bg-slate-200 rounded mb-1"></div>
                                <div className="h-4 w-24 bg-slate-200 rounded"></div>
                            </div>
                        </div>
                    ) : profile ? (
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <div className="text-xs text-slate-400">當前使用者</div>
                                <div className="text-sm font-bold text-slate-700 flex items-center gap-1">
                                    {profile.user_name}
                                    <Badge variant={profile.role === 'admin' ? 'destructive' : 'secondary'} className="text-[10px]">
                                        {profile.role}
                                    </Badge>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-1 text-red-600 border-red-200 hover:bg-red-50">
                                <LogOut className="w-3 h-3" /> 登出
                            </Button>
                        </div>
                    ) : (
                        <Button onClick={() => router.push('/login')}>登入</Button>
                    )}

                    <Button variant="outline" size="sm" onClick={refreshAll} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </header>

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
                        <div className="flex items-center gap-2">
                            <Input
                                type="date"
                                value={vendorSearch.start}
                                onChange={(e) => setVendorSearch(s => ({ ...s, start: e.target.value }))}
                                className="w-36"
                            />
                            <Input
                                type="date"
                                value={vendorSearch.end}
                                onChange={(e) => setVendorSearch(s => ({ ...s, end: e.target.value }))}
                                className="w-36"
                            />
                            <Input
                                placeholder="搜尋關鍵字..."
                                value={vendorSearch.keyword}
                                onChange={(e) => setVendorSearch(s => ({ ...s, keyword: e.target.value }))}
                                className="w-40"
                            />
                            <Button size="sm" onClick={searchVendor}>
                                <Search className="w-4 h-4 mr-1" /> 搜尋
                            </Button>
                            <Button size="sm" onClick={() => router.push('/vendor-work/new')} className="bg-green-600 hover:bg-green-700">
                                <Plus className="w-4 h-4 mr-1" /> 新增
                            </Button>
                            {/* 登入後才顯示的按鈕 */}
                            {isLoggedIn && (
                                <>
                                    <Button size="sm" variant="outline" onClick={() => {
                                        const id = Array.from(vendorSelected)[0]
                                        if (id) router.push(`/vendor-work/${id}/edit`)
                                    }} disabled={vendorSelected.size !== 1}>
                                        <Edit className="w-4 h-4 mr-1" /> 修改
                                    </Button>
                                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                                        onClick={() => setDeleteDialog({ open: true, type: 'vendor', ids: Array.from(vendorSelected) })}
                                        disabled={vendorSelected.size === 0}>
                                        <Trash2 className="w-4 h-4 mr-1" /> 刪除
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => exportToExcel('vendor')}>
                                        <Download className="w-4 h-4 mr-1" /> 匯出
                                    </Button>
                                </>
                            )}
                            <Badge variant="outline">{vendors.length} 筆</Badge>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {isLoggedIn && (
                                        <TableHead className="w-12">
                                            <Checkbox
                                                checked={vendorSelected.size === vendors.length && vendors.length > 0}
                                                onCheckedChange={() => toggleSelectAll(vendors, vendorSelected, setVendorSelected)}
                                            />
                                        </TableHead>
                                    )}
                                    <TableHead className="w-12">#</TableHead>
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
                                {vendors.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={isLoggedIn ? 17 : 16} className="text-center py-8 text-slate-400">
                                            查無資料
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    vendors.map((v: any, index: number) => (
                                        <TableRow key={v.id} className={`hover:bg-blue-50/50 ${vendorSelected.has(v.id) ? 'bg-blue-100' : ''}`}>
                                            {isLoggedIn && (
                                                <TableCell>
                                                    <Checkbox
                                                        checked={vendorSelected.has(v.id)}
                                                        onCheckedChange={() => toggleSelect(v.id, vendorSelected, setVendorSelected)}
                                                    />
                                                </TableCell>
                                            )}
                                            <TableCell className="text-slate-400 text-sm">{index + 1}</TableCell>
                                            <TableCell>
                                                <Badge variant={v.entry_status === 'arrival' ? 'default' : 'secondary'}>
                                                    {v.entry_status === 'arrival' ? '到院' : '離院'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-mono">{v.work_date}</TableCell>
                                            <TableCell className="font-mono">{v.arrival_time?.slice(0, 5) || '-'}</TableCell>
                                            <TableCell className="font-mono">{v.departure_time?.slice(0, 5) || '-'}</TableCell>
                                            <TableCell className="font-bold">{v.vendor_name}</TableCell>
                                            <TableCell>{v.vendor_badge_id || '-'}</TableCell>
                                            <TableCell>{v.vendor_contact}</TableCell>
                                            <TableCell>{v.vendor_contact_phone || '-'}</TableCell>
                                            <TableCell>{v.building || '-'}</TableCell>
                                            <TableCell>{v.floor || '-'}</TableCell>
                                            <TableCell>{v.location || '-'}</TableCell>
                                            <TableCell>{v.head_count || '-'}</TableCell>
                                            <TableCell className="max-w-xs truncate" title={v.work_content}>{v.work_content}</TableCell>
                                            <TableCell className="text-slate-400 text-xs">{v.note || '-'}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
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
                        <div className="flex items-center gap-2">
                            <Input
                                type="date"
                                value={engSearch.start}
                                onChange={(e) => setEngSearch(s => ({ ...s, start: e.target.value }))}
                                className="w-36"
                            />
                            <Input
                                type="date"
                                value={engSearch.end}
                                onChange={(e) => setEngSearch(s => ({ ...s, end: e.target.value }))}
                                className="w-36"
                            />
                            <Input
                                placeholder="搜尋關鍵字..."
                                value={engSearch.keyword}
                                onChange={(e) => setEngSearch(s => ({ ...s, keyword: e.target.value }))}
                                className="w-40"
                            />
                            <Button size="sm" onClick={searchEngineering}>
                                <Search className="w-4 h-4 mr-1" /> 搜尋
                            </Button>
                            <Button size="sm" onClick={() => router.push('/engineering-work/new')} className="bg-amber-600 hover:bg-amber-700">
                                <Plus className="w-4 h-4 mr-1" /> 新增
                            </Button>
                            {isLoggedIn && (
                                <>
                                    <Button size="sm" variant="outline" onClick={() => {
                                        const id = Array.from(engSelected)[0]
                                        if (id) router.push(`/engineering-work/${id}/edit`)
                                    }} disabled={engSelected.size !== 1}>
                                        <Edit className="w-4 h-4 mr-1" /> 修改
                                    </Button>
                                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                                        onClick={() => setDeleteDialog({ open: true, type: 'engineering', ids: Array.from(engSelected) })}
                                        disabled={engSelected.size === 0}>
                                        <Trash2 className="w-4 h-4 mr-1" /> 刪除
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => exportToExcel('engineering')}>
                                        <Download className="w-4 h-4 mr-1" /> 匯出
                                    </Button>
                                </>
                            )}
                            <Badge variant="outline">{engineering.length} 筆</Badge>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {isLoggedIn && (
                                        <TableHead className="w-12">
                                            <Checkbox
                                                checked={engSelected.size === engineering.length && engineering.length > 0}
                                                onCheckedChange={() => toggleSelectAll(engineering, engSelected, setEngSelected)}
                                            />
                                        </TableHead>
                                    )}
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
                                {engineering.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={isLoggedIn ? 11 : 10} className="text-center py-8 text-slate-400">
                                            查無資料
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    engineering.map((e: any, index: number) => (
                                        <TableRow key={e.id} className={`hover:bg-amber-50/50 ${engSelected.has(e.id) ? 'bg-amber-100' : ''}`}>
                                            {isLoggedIn && (
                                                <TableCell>
                                                    <Checkbox
                                                        checked={engSelected.has(e.id)}
                                                        onCheckedChange={() => toggleSelect(e.id, engSelected, setEngSelected)}
                                                    />
                                                </TableCell>
                                            )}
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
                        <div className="flex items-center gap-2">
                            <Input
                                type="date"
                                value={pendingSearch.start}
                                onChange={(e) => setPendingSearch(s => ({ ...s, start: e.target.value }))}
                                className="w-36"
                            />
                            <Input
                                type="date"
                                value={pendingSearch.end}
                                onChange={(e) => setPendingSearch(s => ({ ...s, end: e.target.value }))}
                                className="w-36"
                            />
                            <Input
                                placeholder="搜尋關鍵字..."
                                value={pendingSearch.keyword}
                                onChange={(e) => setPendingSearch(s => ({ ...s, keyword: e.target.value }))}
                                className="w-40"
                            />
                            <Button size="sm" onClick={searchPending}>
                                <Search className="w-4 h-4 mr-1" /> 搜尋
                            </Button>
                            <Button size="sm" onClick={() => router.push('/pending-work/new')} className="bg-purple-600 hover:bg-purple-700">
                                <Plus className="w-4 h-4 mr-1" /> 新增
                            </Button>
                            {isLoggedIn && (
                                <>
                                    <Button size="sm" variant="outline" onClick={() => {
                                        const id = Array.from(pendingSelected)[0]
                                        if (id) router.push(`/pending-work/${id}/edit`)
                                    }} disabled={pendingSelected.size !== 1}>
                                        <Edit className="w-4 h-4 mr-1" /> 修改
                                    </Button>
                                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                                        onClick={() => setDeleteDialog({ open: true, type: 'pending', ids: Array.from(pendingSelected) })}
                                        disabled={pendingSelected.size === 0}>
                                        <Trash2 className="w-4 h-4 mr-1" /> 刪除
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => exportToExcel('pending')}>
                                        <Download className="w-4 h-4 mr-1" /> 匯出
                                    </Button>
                                </>
                            )}
                            <Badge variant="outline">{pendingWork.length} 筆</Badge>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {isLoggedIn && (
                                        <TableHead className="w-12">
                                            <Checkbox
                                                checked={pendingSelected.size === pendingWork.length && pendingWork.length > 0}
                                                onCheckedChange={() => toggleSelectAll(pendingWork, pendingSelected, setPendingSelected)}
                                            />
                                        </TableHead>
                                    )}
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
                                {pendingWork.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={isLoggedIn ? 11 : 10} className="text-center py-8 text-slate-400">
                                            查無資料
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    pendingWork.map((p: any, index: number) => (
                                        <TableRow key={p.id} className={`hover:bg-purple-50/50 ${pendingSelected.has(p.id) ? 'bg-purple-100' : ''}`}>
                                            {isLoggedIn && (
                                                <TableCell>
                                                    <Checkbox
                                                        checked={pendingSelected.has(p.id)}
                                                        onCheckedChange={() => toggleSelect(p.id, pendingSelected, setPendingSelected)}
                                                    />
                                                </TableCell>
                                            )}
                                            <TableCell className="text-slate-400 text-sm">{index + 1}</TableCell>
                                            <TableCell className="font-mono">{p.start_date}</TableCell>
                                            <TableCell className="font-mono">{p.end_date}</TableCell>
                                            <TableCell className="font-mono">{p.time?.slice(0, 5) || '-'}</TableCell>
                                            <TableCell className="font-bold">{p.vendor_name}</TableCell>
                                            <TableCell><Badge variant="outline">{p.unit}</Badge></TableCell>
                                            <TableCell>{p.engineering_contact}</TableCell>
                                            <TableCell className="max-w-xs truncate" title={p.work_content}>{p.work_content}</TableCell>
                                            <TableCell className="text-slate-400 text-xs">{p.note || '-'}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
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
