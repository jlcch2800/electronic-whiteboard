// 系統執行記錄 Client Component
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { ArrowLeft, FileText, Search, RefreshCw, Download, AlertCircle, Info, AlertTriangle, Eye, Filter, Terminal } from 'lucide-react'
import { MobileTableCard } from '@/components/MobileTableCard'
import { EmptyState } from '@/components/EmptyState'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTablePagination } from '@/components/DataTablePagination'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { SortableTableHead } from '@/components/ui/sortable-table-head'

interface ExecutionLogClientProps { initialLogs: any[] }

export default function ExecutionLogClient({ initialLogs }: ExecutionLogClientProps) {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()
    const [logs, setLogs] = useState(initialLogs)
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [pageSize, setPageSize] = useState<number>(10)
    const [currentPage, setCurrentPage] = useState(1)
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [isFiltersOpen, setIsFiltersOpen] = useState(false)

    const TABLE_NAME_MAP: Record<string, string> = {
        'vendor_today_work': '廠商今日施工項目',
        'vendor_today_work_history': '廠商今日施工歷史記錄',
        'engineering_today_work': '工務今日施工項目',
        'engineering_work_history': '工務施工歷史記錄',
        'pending_work': '待處理工作項目',
        'pending_work_history': '待處理工作歷史記錄',
        'work_report': '施工回報記錄',
        'work_report_history': '施工回報歷史記錄',
        'users': '帳號管理',
        'system_change_log': '系統異動記錄',
        'system_execution_log': '系統執行記錄',
        'work_file': '施工文件',
    }

    const FIELD_LABELS: Record<string, string> = {
        id: 'ID', created_at: '建立時間', updated_at: '更新時間', date: '日期',
        // 廠商今日施工項目 (vendor_today_work)
        entry_status: '到院或離院', work_date: '施工日期', arrival_time: '到院時間', departure_time: '離院時間',
        building: '棟別', floor: '樓層', location: '施工地點', vendor_badge_id: '廠商工作證號', head_count: '施工人數',
        vendor_name: '廠商名稱', vendor_contact: '廠商負責人員姓名', vendor_contact_phone: '廠商負責人員電話',
        work_content: '施工內容', note: '備註',
        // 待處理/工務 (pending_work / engineering_today_work)
        start_date: '施工開始日期', end_date: '施工結束日期', time: '時間', unit: '單位', department: '部門', name: '名稱',
        engineering_contact: '工務負責人員', // 對應 Image 3 & 4
        // 施工回報 (work_reports)
        report_date: '施工回報日期', report_time: '時間', work_location: '施工地點', work_status: '施工狀態',
        // 帳號與其他
        user_name: '姓名', user_account: '帳號', user_unit: '使用者單位', role: '使用者群組',
        company: '公司/單位', status: '狀態', is_active: '是否啟用', email: 'e-mail',
        password: '密碼', password_hash: '密碼', failed_attempts: '失敗計次', last_failed_at: '最後失敗時間',
        locked_until: '鎖定解除時間',
        reset_token_hash: '重設密碼 Token Hash', reset_token_expire: '重設密碼 Token 到期時間',
        verify_token_hash: '驗證 Token Hash', verify_token_expire: '驗證 Token 到期時間',
        action_type: '動作類型', modify_table: '異動資料表', modify_record_id: '異動記錄ID',
        description: '說明', file_url: '文件', image_url: '照片', video_url: '影片', uploader_name: '上傳人員', work_item: '施工項目',
        content: '內容'
    }

    const FIELD_ORDER = [
        'id', 'created_at', 'updated_at',
        // Vendor Today Work
        'entry_status', 'work_date', 'arrival_time', 'departure_time', 'building', 'floor', 'location',
        'vendor_badge_id', 'head_count',
        // Work Reports
        'report_date', 'report_time',
        // Pending / Engineering
        'start_date', 'end_date', 'time',
        // Common Pivot (Vendor Name)
        'vendor_name',
        // Vendor Contact (After Name)
        'vendor_contact', 'vendor_contact_phone',
        // Unit/Dept (After Name in some contexts)
        'unit', 'department', 'name',
        // Work Reports Location (After Name)
        'work_location',
        // Engineering Contact
        'engineering_contact',
        // Work Status
        'work_status',
        // User fields
        'user_name', 'user_account', 'password_hash', 'role', 'email', 'is_active',
        'failed_attempts', 'last_failed_at', 'locked_until',
        // Content & Note (End)
        'work_item', 'uploader_name', 'description', 'file_url', 'image_url', 'video_url',
        'work_content', 'content', 'note'
    ];

    const getTranslatedTableName = (name: string) => TABLE_NAME_MAP[name] || name

    const translateMessage = (msg: string) => {
        if (!msg) return '';
        let translatedMsg = msg;
        Object.entries(TABLE_NAME_MAP).forEach(([key, value]) => {
            translatedMsg = translatedMsg.replace(new RegExp(key, 'g'), value);
        });
        return translatedMsg;
    }

    const toggleSelect = (id: string) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s) }

    const fetchLogs = async () => {
        setLoading(true)
        let query = supabase.from('system_execution_log').select('*').order('created_at', { ascending: false })
        if (startDate) query = query.gte('date', startDate)
        if (endDate) query = query.lte('date', endDate)
        const { data } = await query.limit(500)
        if (data) setLogs(data)
        setCurrentPage(1); setSelected(new Set()); setLoading(false)
    }

    useEffect(() => {
        fetchLogs()
    }, [startDate, endDate])

    const filteredLogs = logs.filter(log => (
        (getTranslatedTableName(log.table_name)?.toLowerCase().includes(searchTerm.toLowerCase()) || log.table_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        translateMessage(log.message)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.log_level?.toLowerCase().includes(searchTerm.toLowerCase())
    ))
    const totalPages = Math.ceil(filteredLogs.length / pageSize)

    // 排序狀態
    const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
    const handleSort = (key: string) => {
        setSort(prev => {
            if (prev?.key === key && prev.direction === 'asc') return { key, direction: 'desc' }
            if (prev?.key === key && prev.direction === 'desc') return null
            return { key, direction: 'asc' }
        })
    }
    const sortedLogs = useMemo(() => {
        if (!sort) return filteredLogs
        return [...filteredLogs].sort((a, b) => {
            const valA = (a as any)[sort.key] ?? ''
            const valB = (b as any)[sort.key] ?? ''
            if (valA < valB) return sort.direction === 'asc' ? -1 : 1
            if (valA > valB) return sort.direction === 'asc' ? 1 : -1
            return 0
        })
    }, [filteredLogs, sort])
    const paginatedLogs = sortedLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize)

    const toggleSelectAll = () => { selected.size === paginatedLogs.length && paginatedLogs.length > 0 ? setSelected(new Set()) : setSelected(new Set(paginatedLogs.map(i => i.id))) }

    const handleExport = () => {
        const dataToExport = selected.size > 0 ? filteredLogs.filter(r => selected.has(r.id)) : filteredLogs
        if (dataToExport.length === 0) { toast({ title: '無資料可匯出', variant: 'destructive' }); return }
        const sheetData = dataToExport.map((r, i) => ({ '#': i + 1, 'ID': r.id, '建立時間': format(new Date(r.created_at), 'yyyy-MM-dd HH:mm:ss'), '日期': r.date, '資料表': getTranslatedTableName(r.table_name), '記錄等級': r.log_level, '訊息': translateMessage(r.message) || '' }))
        const wb = XLSX.utils.book_new(); const ws = XLSX.utils.json_to_sheet(sheetData)
        ws['!cols'] = Object.keys(sheetData[0] || {}).map(() => ({ wch: 15 }))
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
        saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `系統執行記錄_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`)

        toast({ title: '匯出成功', description: `已匯出 ${dataToExport.length} 筆記錄` })
    }

    // 匯出單筆明細
    const handleExportDetail = (log: any) => {
        const parseJson = (data: any) => {
            if (!data) return {}
            if (typeof data === 'string') { try { return JSON.parse(data) } catch { return {} } }
            return data
        }

        // 使用 Array of Arrays (AOA) 來建構單一 Sheet 的內容，確保所有資訊一目瞭然
        const aoa: any[][] = [];

        // 1. 基本資料區塊
        aoa.push(['【執行記錄基本資料】', '']);
        aoa.push(['欄位', '值']);
        aoa.push(['ID', log.id]);
        aoa.push(['建立時間', format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')]);
        aoa.push(['日期', log.date]);
        aoa.push(['資料表', getTranslatedTableName(log.table_name)]);
        aoa.push(['記錄等級', log.log_level]);
        aoa.push(['訊息', translateMessage(log.message) || '-']);

        // 2. 空行分隔
        aoa.push([]);

        // 3. 異動明細/快照區塊
        if (log.old_data || log.new_data) {
            const oldData = parseJson(log.old_data);
            const newData = parseJson(log.new_data);

            if (Array.isArray(newData)) {
                // Handle Array Snapshot (e.g. pending_work)
                aoa.push(['【執行資料快照】', `共 ${newData.length} 筆`, '', '']);
                aoa.push([]);

                // Get all unique keys from all items to build headers
                const allKeys = Array.from(new Set(newData.flatMap((item: any) => Object.keys(item))));
                const sortedKeys = allKeys.sort((a, b) => {
                    const indexA = FIELD_ORDER.indexOf(a);
                    const indexB = FIELD_ORDER.indexOf(b);
                    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                    if (indexA !== -1) return -1;
                    if (indexB !== -1) return 1;
                    return a.localeCompare(b);
                });

                // Header Row
                const headerRow = ['#', ...sortedKeys.map(key => FIELD_LABELS[key] || key)];
                aoa.push(headerRow);

                // Data Rows
                newData.forEach((item: any, idx: number) => {
                    const row = [
                        idx + 1,
                        ...sortedKeys.map(key => {
                            const val = item[key];
                            return val !== undefined && val !== null ? (typeof val === 'object' ? JSON.stringify(val) : String(val)) : '-';
                        })
                    ];
                    aoa.push(row);
                });

            } else {
                // Handle Standard Object Comparison
                aoa.push(['【異動資料對比】', '', '', '']);
                aoa.push(['欄位', '變更前', '變更後', '是否異動']); // Detail Header

                // Get all keys
                const allKeys = Array.from(new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]));

                // Sort keys based on FIELD_ORDER
                const sortedKeys = allKeys.sort((a, b) => {
                    const indexA = FIELD_ORDER.indexOf(a);
                    const indexB = FIELD_ORDER.indexOf(b);

                    // If both are in FIELD_ORDER, sort by index
                    if (indexA !== -1 && indexB !== -1) return indexA - indexB;

                    // If one is in FIELD_ORDER, it comes first
                    if (indexA !== -1) return -1;
                    if (indexB !== -1) return 1;

                    // If neither is in FIELD_ORDER, sort alphabetically or keep original order
                    return a.localeCompare(b);
                });

                sortedKeys.forEach(key => {
                    const oldVal = oldData?.[key];
                    const newVal = newData?.[key];
                    const isChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal);

                    aoa.push([
                        FIELD_LABELS[key] || key,
                        oldVal !== undefined ? JSON.stringify(oldVal) : '-',
                        newVal !== undefined ? JSON.stringify(newVal) : '-',
                        isChanged ? '是' : ''
                    ]);
                });
            }
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(aoa);

        // 設定欄寬 (簡易設定)
        // 對於 Array Snapshot 可能欄位較多，這裡做一個通用的寬度設定
        // 計算最大欄數
        const maxCols = aoa.reduce((max, row) => Math.max(max, row.length), 0);
        const cols = [];
        for (let i = 0; i < maxCols; i++) {
            cols.push({ wch: 20 }); // Default width
        }
        // 特別調整前幾欄 (如果符合 Object Comparison 格式)
        if (aoa.length > 0 && aoa[0].length === 2 && cols.length >= 2) {
            cols[0] = { wch: 25 };
            cols[1] = { wch: 40 };
        }
        ws['!cols'] = cols;

        XLSX.utils.book_append_sheet(wb, ws, '執行記錄明細');

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
        saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `執行記錄明細_${log.id.slice(0, 8)}_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`)

        toast({ title: '匯出成功' });
    }

    const getLevelBadge = (level: string) => {
        switch (level) {
            case 'Error': return <Badge variant="destructive" className="gap-1"><AlertCircle className="w-3 h-3" /> Error</Badge>
            case 'Warning': return <Badge variant="outline" className="border-yellow-500 text-yellow-500 gap-1"><AlertTriangle className="w-3 h-3" /> Warning</Badge>
            default: return <Badge variant="secondary" className="gap-1"><Info className="w-3 h-3" /> Info</Badge>
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100">
            <header className="glass border-b border-border/50 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 shrink-0">
                                <Button variant="ghost" size="icon" onClick={() => router.push('/')}><ArrowLeft className="w-5 h-5" /></Button>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl text-white"><FileText className="w-6 h-6" /></div>
                                    <div><h1 className="text-xl font-bold text-foreground">系統執行記錄</h1><p className="text-sm text-muted-foreground hidden md:block">排程執行與系統運作記錄</p></div>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" className="md:hidden" onClick={() => setIsFiltersOpen(!isFiltersOpen)}>
                                <Filter className="w-4 h-4 mr-1" />{isFiltersOpen ? '隱藏' : '篩選'}
                            </Button>
                        </div>
                        <div className={`flex-col md:flex-row items-stretch md:items-center gap-3 ${isFiltersOpen ? 'flex' : 'hidden md:flex'}`}>
                            <div className="flex items-center gap-2">
                                <Input 
                                    type="date" 
                                    value={startDate} 
                                    onChange={(e) => setStartDate(e.target.value)} 
                                    className="w-full md:w-36" 
                                />
                                <span className="text-muted-foreground">~</span>
                                <Input 
                                    type="date" 
                                    value={endDate} 
                                    onChange={(e) => setEndDate(e.target.value)} 
                                    className="w-full md:w-36" 
                                />
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input 
                                    value={searchTerm} 
                                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }} 
                                    placeholder="搜尋..." 
                                    className="pl-10 w-full md:w-48" 
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Button onClick={handleExport} className="bg-green-600 hover:bg-green-700 flex-1 md:flex-none">
                                    <Download className="w-4 h-4 mr-2" /> 匯出
                                </Button>
                                <Button variant="outline" size="icon" onClick={fetchLogs} disabled={loading} className="hidden md:flex">
                                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </header>
            <main className="max-w-7xl mx-auto p-6">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl shadow-card border border-border overflow-hidden">
                    <div className="overflow-x-auto">
                        <Table className="hidden md:table">
                            <TableHeader><TableRow className="bg-muted">
                                <TableHead className="w-12"><Checkbox checked={selected.size === paginatedLogs.length && paginatedLogs.length > 0} onCheckedChange={toggleSelectAll} /></TableHead>
                                <TableHead className="w-12">#</TableHead>
                                <SortableTableHead label="建立時間" sortKey="created_at" currentSort={sort} onSort={handleSort} />
                                <SortableTableHead label="日期" sortKey="date" currentSort={sort} onSort={handleSort} />
                                <SortableTableHead label="資料表" sortKey="table_name" currentSort={sort} onSort={handleSort} />
                                <SortableTableHead label="記錄等級" sortKey="log_level" currentSort={sort} onSort={handleSort} />
                                <TableHead>訊息</TableHead><TableHead>明細</TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                                {paginatedLogs.length === 0 ? <TableRow><TableCell colSpan={8} className="p-0"><EmptyState icon={Terminal} title="沒有找到紀錄" description="目前沒有符合條件的執行紀錄，請調整篩選條件。" /></TableCell></TableRow>
                                    : paginatedLogs.map((log, index) => (
                                        <TableRow key={log.id} className={`hover:bg-muted dark:hover:bg-indigo-900/20 ${selected.has(log.id) ? 'bg-indigo-100 dark:bg-indigo-900/40' : ''}`}>
                                            <TableCell><Checkbox checked={selected.has(log.id)} onCheckedChange={() => toggleSelect(log.id)} /></TableCell>
                                            <TableCell className="text-muted-foreground dark:text-muted-foreground/70 text-sm">{(currentPage - 1) * pageSize + index + 1}</TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground dark:text-gray-300 whitespace-nowrap">{format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}</TableCell>
                                            <TableCell className="font-mono text-sm dark:text-gray-200">{log.date}</TableCell>
                                            <TableCell className="font-mono text-sm dark:text-gray-200">{getTranslatedTableName(log.table_name)}</TableCell>
                                            <TableCell>{getLevelBadge(log.log_level)}</TableCell>
                                            <TableCell className="max-w-[300px] truncate text-sm dark:text-gray-200" title={log.message}>{translateMessage(log.message) || '-'}</TableCell>
                                            <TableCell>
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-8 text-teal-600 hover:text-teal-700 hover:bg-teal-50">
                                                            <Eye className="w-4 h-4 mr-1" />明細
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                                        <DialogHeader>
                                                            <DialogTitle className="flex items-center justify-between pr-8">
                                                                執行記錄明細
                                                                <Button size="sm" onClick={() => handleExportDetail(log)} className="bg-green-600 hover:bg-green-700">
                                                                    <Download className="w-4 h-4 mr-1" />匯出
                                                                </Button>
                                                            </DialogTitle>
                                                            <DialogDescription>
                                                                執行時間：{format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}
                                                            </DialogDescription>
                                                        </DialogHeader>
                                                        <div className="mt-4 border rounded-lg overflow-hidden">
                                                            {/* 基本資訊 */}
                                                            <Table>
                                                                <TableBody>
                                                                    <TableRow><TableCell className="bg-muted dark:bg-slate-800/50 font-bold w-32 dark:text-gray-200">ID</TableCell><TableCell className="font-mono text-xs dark:text-gray-300">{log.id}</TableCell></TableRow>
                                                                    <TableRow><TableCell className="bg-muted dark:bg-slate-800/50 font-bold dark:text-gray-200">建立時間</TableCell><TableCell className="font-mono dark:text-gray-300">{format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}</TableCell></TableRow>
                                                                    <TableRow><TableCell className="bg-muted dark:bg-slate-800/50 font-bold dark:text-gray-200">日期</TableCell><TableCell className="font-mono dark:text-gray-300">{log.date}</TableCell></TableRow>
                                                                    <TableRow><TableCell className="bg-muted dark:bg-slate-800/50 font-bold dark:text-gray-200">資料表</TableCell><TableCell className="font-mono dark:text-gray-300">{getTranslatedTableName(log.table_name)}</TableCell></TableRow>
                                                                    <TableRow><TableCell className="bg-muted dark:bg-slate-800/50 font-bold dark:text-gray-200">記錄等級</TableCell><TableCell>{getLevelBadge(log.log_level)}</TableCell></TableRow>
                                                                    <TableRow><TableCell className="bg-muted dark:bg-slate-800/50 font-bold align-top dark:text-gray-200">訊息</TableCell><TableCell className="whitespace-pre-wrap break-words dark:text-gray-300">{translateMessage(log.message) || '-'}</TableCell></TableRow>
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                        {/* 異動資料對比 */}
                                                        {(log.old_data || log.new_data) && (() => {
                                                            const parseJson = (data: any) => {
                                                                if (!data) return null
                                                                if (typeof data === 'string') { try { return JSON.parse(data) } catch { return null } }
                                                                return data
                                                            }
                                                            const oldData = parseJson(log.old_data)
                                                            const newData = parseJson(log.new_data)
                                                            const allKeys = Array.from(new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]))

                                                            // Sort keys based on FIELD_ORDER
                                                            const sortedKeys = allKeys.sort((a, b) => {
                                                                const indexA = FIELD_ORDER.indexOf(a);
                                                                const indexB = FIELD_ORDER.indexOf(b);
                                                                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                                                                if (indexA !== -1) return -1;
                                                                if (indexB !== -1) return 1;
                                                                return a.localeCompare(b);
                                                            });

                                                            // Handle Array Data (Snapshot)
                                                            if (Array.isArray(newData)) {
                                                                return (
                                                                    <div className="mt-4 border rounded-lg overflow-hidden">
                                                                        <div className="bg-muted px-4 py-2 font-bold text-sm text-foreground/80">
                                                                            執行資料快照 (共 {newData.length} 筆)
                                                                        </div>
                                                                        <div className="max-h-[50vh] overflow-y-auto">
                                                                            {newData.map((item: any, idx: number) => {
                                                                                const itemKeys = Object.keys(item).sort((a, b) => {
                                                                                    const indexA = FIELD_ORDER.indexOf(a);
                                                                                    const indexB = FIELD_ORDER.indexOf(b);
                                                                                    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                                                                                    if (indexA !== -1) return -1;
                                                                                    if (indexB !== -1) return 1;
                                                                                    return a.localeCompare(b);
                                                                                });
                                                                                return (
                                                                                    <div key={idx} className="border-b last:border-b-0">
                                                                                        <div className="bg-muted px-4 py-1 text-xs font-bold text-muted-foreground border-b border-dashed border-border">
                                                                                            #{idx + 1}
                                                                                        </div>
                                                                                        <Table>
                                                                                            <TableBody>
                                                                                                {itemKeys.map(key => (
                                                                                                    <TableRow key={key} className="hover:bg-transparent">
                                                                                                        <TableCell className="w-32 font-bold text-foreground/70 dark:text-gray-300 text-xs py-1 border-b-0 h-auto align-top">
                                                                                                            {FIELD_LABELS[key] || key}
                                                                                                        </TableCell>
                                                                                                        <TableCell className="font-mono text-sm py-1 border-b-0 h-auto break-words dark:text-gray-200">
                                                                                                            {item[key] !== undefined && item[key] !== null ? (typeof item[key] === 'object' ? JSON.stringify(item[key]) : String(item[key])) : '-'}
                                                                                                        </TableCell>
                                                                                                    </TableRow>
                                                                                                ))}
                                                                                            </TableBody>
                                                                                        </Table>
                                                                                    </div>
                                                                                )
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                )
                                                            }

                                                            return (
                                                                <div className="mt-4 border rounded-lg overflow-hidden">
                                                                    <div className="bg-muted px-4 py-2 font-bold text-sm text-foreground/80">異動資料對比</div>
                                                                    <Table>
                                                                        <TableHeader>
                                                                            <TableRow className="bg-muted">
                                                                                <TableHead className="w-32">欄位</TableHead>
                                                                                <TableHead className="text-green-700 bg-green-50">變更前</TableHead>
                                                                                <TableHead className="text-red-700 bg-red-50">變更後</TableHead>
                                                                            </TableRow>
                                                                        </TableHeader>
                                                                        <TableBody>
                                                                            {sortedKeys.map(key => {
                                                                                const oldVal = oldData?.[key]
                                                                                const newVal = newData?.[key]
                                                                                const isChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal)
                                                                                return (
                                                                                    <TableRow key={key} className={isChanged ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}>
                                                                                        <TableCell className="font-bold text-foreground/70 dark:text-gray-300 text-xs">{FIELD_LABELS[key] || key}</TableCell>
                                                                                        <TableCell className={`font-mono text-sm break-words ${isChanged ? 'text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/20' : 'dark:text-gray-200'}`}>
                                                                                            {oldVal !== undefined ? JSON.stringify(oldVal) : '-'}
                                                                                        </TableCell>
                                                                                        <TableCell className={`font-mono text-sm break-words ${isChanged ? 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/20' : 'dark:text-gray-200'}`}>
                                                                                            {newVal !== undefined ? JSON.stringify(newVal) : '-'}
                                                                                        </TableCell>
                                                                                    </TableRow>
                                                                                )
                                                                            })}
                                                                        </TableBody>
                                                                    </Table>
                                                                </div>
                                                            )
                                                        })()}
                                                    </DialogContent>
                                                </Dialog>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                            </TableBody>
                        </Table>

                        {/* 手機版卡片列表 */}
                        <div className="md:hidden mt-4 space-y-3 px-2 pb-4">
                            {paginatedLogs.length === 0 ? (
                                <EmptyState icon={Terminal} title="沒有找到紀錄" description="目前沒有符合條件的執行紀錄，請調整篩選條件。" />
                            ) : (
                                paginatedLogs.map((log, index) => (
                                    <MobileTableCard
                                        key={log.id}
                                        id={log.id}
                                        title={`#${(currentPage - 1) * pageSize + index + 1} ${getTranslatedTableName(log.table_name)}`}
                                        subtitle={translateMessage(log.message)?.slice(0, 50) || '-'}
                                        status={{
                                            label: log.log_level,
                                            variant: log.log_level === 'Error' ? 'destructive' as const : log.log_level === 'Warning' ? 'outline' as const : 'secondary' as const,
                                            className: log.log_level === 'Warning' ? 'border-yellow-500 text-yellow-500' : undefined,
                                        }}
                                        date={log.date}
                                        time={format(new Date(log.created_at), 'HH:mm:ss')}
                                        isSelected={selected.has(log.id)}
                                        onSelect={() => toggleSelect(log.id)}
                                        details={[
                                            { label: '建立時間', value: format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss') },
                                            { label: '訊息', value: translateMessage(log.message) || '-' },
                                        ]}
                                        actionNode={
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-8 text-teal-600 hover:text-teal-700 hover:bg-teal-50 px-2">
                                                        <Eye className="w-4 h-4 mr-1" />明細
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-[95vw] md:max-w-2xl max-h-[80vh] overflow-y-auto">
                                                    <DialogHeader>
                                                        <DialogTitle className="flex items-center justify-between pr-8">
                                                            執行記錄明細
                                                            <Button size="sm" onClick={() => handleExportDetail(log)} className="bg-green-600 hover:bg-green-700">
                                                                <Download className="w-4 h-4 mr-1" />匯出
                                                            </Button>
                                                        </DialogTitle>
                                                        <DialogDescription>
                                                            執行時間：{format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <div className="mt-4 border rounded-lg overflow-hidden">
                                                        <Table>
                                                            <TableBody>
                                                                <TableRow><TableCell className="bg-muted font-bold w-32">ID</TableCell><TableCell className="font-mono text-xs">{log.id}</TableCell></TableRow>
                                                                <TableRow><TableCell className="bg-muted font-bold">建立時間</TableCell><TableCell className="font-mono">{format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}</TableCell></TableRow>
                                                                <TableRow><TableCell className="bg-muted font-bold">日期</TableCell><TableCell className="font-mono">{log.date}</TableCell></TableRow>
                                                                <TableRow><TableCell className="bg-muted font-bold">資料表</TableCell><TableCell className="font-mono">{getTranslatedTableName(log.table_name)}</TableCell></TableRow>
                                                                <TableRow><TableCell className="bg-muted font-bold">記錄等級</TableCell><TableCell>{getLevelBadge(log.log_level)}</TableCell></TableRow>
                                                                <TableRow><TableCell className="bg-muted font-bold align-top">訊息</TableCell><TableCell className="whitespace-pre-wrap break-words">{translateMessage(log.message) || '-'}</TableCell></TableRow>
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                    {(log.old_data || log.new_data) && (() => {
                                                        const parseJson = (data: any) => {
                                                            if (!data) return null
                                                            if (typeof data === 'string') { try { return JSON.parse(data) } catch { return null } }
                                                            return data
                                                        }
                                                        const oldData = parseJson(log.old_data)
                                                        const newData = parseJson(log.new_data)
                                                        const allKeys = Array.from(new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]))
                                                        const sortedKeys = allKeys.sort((a, b) => {
                                                            const indexA = FIELD_ORDER.indexOf(a); const indexB = FIELD_ORDER.indexOf(b);
                                                            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                                                            if (indexA !== -1) return -1; if (indexB !== -1) return 1;
                                                            return a.localeCompare(b);
                                                        });
                                                        if (Array.isArray(newData)) {
                                                            return (
                                                                <div className="mt-4 border rounded-lg overflow-hidden">
                                                                    <div className="bg-muted px-4 py-2 font-bold text-sm text-foreground/80">執行資料快照 (共 {newData.length} 筆)</div>
                                                                    <div className="max-h-[50vh] overflow-y-auto">
                                                                        {newData.map((item: any, idx: number) => {
                                                                            const itemKeys = Object.keys(item).sort((a, b) => {
                                                                                const iA = FIELD_ORDER.indexOf(a); const iB = FIELD_ORDER.indexOf(b);
                                                                                if (iA !== -1 && iB !== -1) return iA - iB;
                                                                                if (iA !== -1) return -1; if (iB !== -1) return 1;
                                                                                return a.localeCompare(b);
                                                                            });
                                                                            return (
                                                                                <div key={idx} className="border-b last:border-b-0">
                                                                                    <div className="bg-muted px-4 py-1 text-xs font-bold text-muted-foreground border-b border-dashed">#{idx + 1}</div>
                                                                                    <Table><TableBody>
                                                                                        {itemKeys.map(key => (
                                                                                            <TableRow key={key} className="hover:bg-transparent">
                                                                                                <TableCell className="w-32 font-bold text-foreground/70 text-xs py-1 border-b-0 h-auto align-top">{FIELD_LABELS[key] || key}</TableCell>
                                                                                                <TableCell className="font-mono text-sm py-1 border-b-0 h-auto break-words">{item[key] !== undefined && item[key] !== null ? (typeof item[key] === 'object' ? JSON.stringify(item[key]) : String(item[key])) : '-'}</TableCell>
                                                                                            </TableRow>
                                                                                        ))}
                                                                                    </TableBody></Table>
                                                                                </div>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )
                                                        }
                                                        return (
                                                            <div className="mt-4 border rounded-lg overflow-hidden">
                                                                <div className="bg-muted px-4 py-2 font-bold text-sm text-foreground/80">異動資料對比</div>
                                                                <Table>
                                                                    <TableHeader><TableRow className="bg-muted">
                                                                        <TableHead className="w-32">欄位</TableHead>
                                                                        <TableHead className="text-green-700 bg-green-50">變更前</TableHead>
                                                                        <TableHead className="text-red-700 bg-red-50">變更後</TableHead>
                                                                    </TableRow></TableHeader>
                                                                    <TableBody>
                                                                        {sortedKeys.map(key => {
                                                                            const oldVal = oldData?.[key]; const newVal = newData?.[key];
                                                                            const isChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal);
                                                                            return (
                                                                                <TableRow key={key} className={isChanged ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}>
                                                                                    <TableCell className="font-bold text-foreground/70 dark:text-gray-300 text-xs">{FIELD_LABELS[key] || key}</TableCell>
                                                                                    <TableCell className={`font-mono text-sm break-words ${isChanged ? 'text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/20' : 'dark:text-gray-200'}`}>{oldVal !== undefined ? JSON.stringify(oldVal) : '-'}</TableCell>
                                                                                    <TableCell className={`font-mono text-sm break-words ${isChanged ? 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/20' : 'dark:text-gray-200'}`}>{newVal !== undefined ? JSON.stringify(newVal) : '-'}</TableCell>
                                                                                </TableRow>
                                                                            )
                                                                        })}
                                                                    </TableBody>
                                                                </Table>
                                                            </div>
                                                        )
                                                    })()}
                                                </DialogContent>
                                            </Dialog>
                                        }
                                    />
                                ))
                            )}
                        </div>
                    </div>
                    <div className="p-4 border-t border-border/50">
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={totalPages || 1}
                            totalItems={filteredLogs.length}
                            itemsPerPage={pageSize}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={(size) => {
                                setPageSize(size)
                                setCurrentPage(1)
                            }}
                            selectedCount={selected.size}
                        />
                    </div>
                </motion.div>
            </main>
        </div>
    )
}
