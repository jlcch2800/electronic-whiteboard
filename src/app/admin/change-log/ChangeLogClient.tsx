// 系統異動記錄 Client Component
'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { ArrowLeft, History, Search, RefreshCw, Download, Edit, Trash2, Plus, LogIn, LogOut, Eye, AlertTriangle, Filter } from 'lucide-react'
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
import { formatItemsDisplay } from '@/lib/utils'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { exportToExcelFile, exportToPdfFile, exportAoaToExcelFile } from '@/lib/export-utils'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"

interface ChangeLogClientProps {
    initialLogs: any[]
}

export default function ChangeLogClient({ initialLogs }: ChangeLogClientProps) {
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
        'work_reports': '施工回報記錄',
        'work_report_history': '施工回報歷史記錄',
        'users': '帳號管理',
        'system_change_log': '系統異動記錄',
        'system_execution_log': '系統執行記錄',
        'work_file': '施工文件',
        'maintenance_work_orders': '維修單',
        'maintenance_work_orders_history': '維修單歷史記錄',
    }

    const FIELD_LABELS: Record<string, string> = {
        id: 'ID', created_at: '建立時間', updated_at: '更新時間', date: '日期',
        // 廠商今日施工項目 (vendor_today_work)
        entry_status: '到院或離院', work_date: '施工日期', arrival_time: '到院時間', departure_time: '離院時間',
        location: '施工地點', vendor_badge_id: '廠商工作證號', head_count: '施工人數',
        vendor_name: '廠商名稱', vendor_contact: '廠商負責人員姓名', vendor_contact_phone: '廠商負責人員電話',
        work_content: '施工內容', note: '備註',
        borrow_action: '借用動作', borrowed_items: '借出項目', lender_name: '借出人員', returned_items: '歸還項目', receiver_name: '歸還人員', ref_arrival_id: '到院參考ID',
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
        content: '內容',
        // 維修單 (maintenance_work_orders)
        request_date: '開單日', cost_center: '成本中心',
        maintain_content: '維修內容', requester_name: '開單人',
        printer_name: '印單人', submit_date: '送呈日期',
        plan_start_date: '施工預計開始日期', plan_end_date: '施工預計結束日期',
        installment_count: '分期', installment_note: '分期說明',
        work_order_id: '工單編號', handler_name: '承辦人',
        work_order_date: '接單日期', maint_mgr_name: '工務單位主管', maint_mgr_date: '工務單位主管日期',
        req_dept_mgr_name: '開單主管姓名', req_dept_mgr_date: '開單主管日期',
        quote_user_name: '報價承辦人', quote_user_date: '報價承辦人日期',
        amount: '金額',
        dispatch_mgr_name: '發包單位主管', dispatch_mgr_date: '發包單位主管日期',
        dispatch_director_name: '發包部門主管', dispatch_director_date: '發包部門主管日期',
        vice_dean_name: '副院長姓名', vice_dean_date: '副院長日期',
        dean_name: '院長姓名', dean_date: '院長日期',
        project_order_id: '工程單編號',
        procurement_name: '採購組姓名', procurement_date: '採購組日期',
        material_name: '資材室姓名', material_date: '資材室日期',
        rev_vice_dean_name: '審查-副院長姓名', rev_vice_dean_date: '審查-副院長日期',
        rev_dean_name: '審查-院長姓名', rev_dean_date: '審查-院長日期',
        construct_end_date: '施工完成日期',
        accept_dept_mgr_name: '驗收-開單主管姓名', accept_dept_mgr_date: '驗收-開單主管日期',
        accept_handler_name: '驗收-承辦人', accept_handler_date: '驗收-承辦人日期',
        accept_mgr_name: '驗收單位主管', accept_mgr_date: '驗收單位主管日期',
        accept_director_name: '驗收部門主管', accept_director_date: '驗收部門主管日期',
    }

    // 定義各資料表的欄位顯示順序 (整合排序)
    const FIELD_ORDER = [
        'id', 'created_at', 'updated_at',
        // Vendor Today Work
        'entry_status', 'work_date', 'arrival_time', 'departure_time',
        'vendor_name', 'vendor_badge_id', 'vendor_contact', 'vendor_contact_phone',
        'location', 'head_count',
        'work_content', 'note',
        'borrow_action', 'borrowed_items', 'lender_name', 'returned_items', 'receiver_name', 'ref_arrival_id',
        // Work Reports
        'report_date', 'report_time',
        // Pending / Engineering
        'start_date', 'end_date', 'time',
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
        'content',
        // Maintenance Work Orders
        'status', 'request_date', 'cost_center',
        'maintain_content', 'requester_name', 'printer_name', 'submit_date',
        'work_order_id', 'handler_name',
        'work_order_date', 'maint_mgr_name', 'maint_mgr_date',
        'req_dept_mgr_name', 'req_dept_mgr_date',
        'quote_user_name', 'quote_user_date',
        'vendor_name', 'amount',
        'dispatch_mgr_name', 'dispatch_mgr_date',
        'dispatch_director_name', 'dispatch_director_date',
        'vice_dean_name', 'vice_dean_date',
        'dean_name', 'dean_date',
        'project_order_id',
        'plan_start_date', 'plan_end_date',
        'procurement_name', 'procurement_date',
        'material_name', 'material_date',
        'rev_vice_dean_name', 'rev_vice_dean_date',
        'rev_dean_name', 'rev_dean_date',
        'construct_end_date',
        'accept_dept_mgr_name', 'accept_dept_mgr_date',
        'accept_handler_name', 'accept_handler_date',
        'accept_mgr_name', 'accept_mgr_date',
        'accept_director_name', 'accept_director_date',
        'installment_count', 'installment_note',
    ];

    const formatLogValue = (key: string, value: any) => {
        if (value === undefined || value === null) return '-';

        if (key === 'entry_status') {
            if (value === 'arrival') return '"到院"';
            if (value === 'departure') return '"離院"';
        }

        if (key === 'borrow_action') {
            if (value === 'borrow') return '"已借物"';
            if (value === 'none') return '"未借物"';
            if (value === 'return') return '"歸還"';
            if (value === 'partial_return') return '"部分未歸還"';
        }

        if (key === 'borrowed_items' || key === 'returned_items') {
            const obj = typeof value === 'string' ? (() => { try { return JSON.parse(value) } catch { return value } })() : value;
            if (obj && typeof obj === 'object') {
                return formatItemsDisplay(obj.items, obj.other_text) || '-';
            }
        }

        return JSON.stringify(value);
    }

    const parseJson = (data: any) => {
        if (!data) return {}
        if (typeof data === 'string') { try { return JSON.parse(data) } catch { return {} } }
        return data
    }

    const getTranslatedTableName = (name: string) => TABLE_NAME_MAP[name] || name

    const toggleSelect = (id: string) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s) }

    // 重新載入資料
    const fetchLogs = async () => {
        setLoading(true)
        let query = supabase
            .from('system_change_log')
            .select('*')
            .order('created_at', { ascending: false })

        // 日期篩選
        if (startDate) {
            query = query.gte('date', startDate)
        }
        if (endDate) {
            query = query.lte('date', endDate)
        }

        const { data } = await query.limit(500)
        if (data) setLogs(data)
        setCurrentPage(1); setSelected(new Set()); setLoading(false)
    }

    // 篩選資料 - 排除 System 使用者
    const filteredLogs = logs.filter(log => {
        // 排除 System (依據需求：系統執行記錄只存放 cron job，異動記錄存放使用者操作)
        if (log.user_name === 'System' || log.user_account === 'System') return false;

        if (!searchTerm.trim()) return true;

        // 以空白分割多個關鍵字，並過濾掉空值
        const keywords = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);

        // 取得動作類型的中文顯示名稱以便搜尋
        let displayActionType = log.action_type
        if (log.action_type === 'Insert') displayActionType = '新增'
        else if (log.action_type === 'Update') displayActionType = '修改'
        else if (log.action_type === 'Delete') displayActionType = '刪除'
        else if (log.action_type === 'Logout') displayActionType = '登出'
        else if (log.action_type === 'Login') {
            try {
                const newData = typeof log.new_data === 'string' ? JSON.parse(log.new_data) : log.new_data
                if (newData?.status === 'Login Failed' || newData?.status?.includes('Account Locked')) {
                    displayActionType = '密碼錯誤'
                } else {
                    displayActionType = '登入'
                }
            } catch (e) {
                displayActionType = '登入'
            }
        }

        // 必須符合所有的關鍵字 (AND 邏輯)
        return keywords.every(kw =>
            log.user_name?.toLowerCase().includes(kw) ||
            log.user_account?.toLowerCase().includes(kw) ||
            log.user_unit?.toLowerCase().includes(kw) ||
            getTranslatedTableName(log.modify_table)?.toLowerCase().includes(kw) ||
            log.modify_table?.toLowerCase().includes(kw) ||
            log.action_type?.toLowerCase().includes(kw) ||
            displayActionType?.toLowerCase().includes(kw)
        );
    })

    // 分頁
    const totalPages = Math.ceil(filteredLogs.length / pageSize)

    // 排序狀態
    const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
    const handleSort = (key: string) => {
        setSort(prev => {
            if (prev?.key === key && prev.direction === 'asc') return { key, direction: 'desc' }
            if (prev?.key === key && prev.direction === 'desc') return null
            return { key, direction: 'asc' }
        })
        setCurrentPage(1)
    }
    const sortedLogs = useMemo(() => {
        if (!sort) return filteredLogs
        return [...filteredLogs].sort((a, b) => {
            const valA = (a as any)[sort.key] ?? ''
            const valB = (b as any)[sort.key] ?? ''

            if (typeof valA === 'string' && typeof valB === 'string') {
                return sort.direction === 'asc'
                    ? valA.localeCompare(valB, 'zh-Hant')
                    : valB.localeCompare(valA, 'zh-Hant')
            }

            if (valA < valB) return sort.direction === 'asc' ? -1 : 1
            if (valA > valB) return sort.direction === 'asc' ? 1 : -1
            return 0
        })
    }, [filteredLogs, sort])
    const paginatedLogs = sortedLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize)

    const toggleSelectAll = () => { selected.size === paginatedLogs.length && paginatedLogs.length > 0 ? setSelected(new Set()) : setSelected(new Set(paginatedLogs.map(i => i.id))) }

    // 匯出 Excel
    const exportToExcel = () => {
        const dataToExport = selected.size > 0 ? filteredLogs.filter(r => selected.has(r.id)) : filteredLogs
        if (dataToExport.length === 0) { toast({ title: '無資料可匯出', variant: 'destructive' }); return }

        const sheetData = dataToExport.map((r, i) => ({
            '#': i + 1,
            'ID': r.id,
            '建立時間': format(new Date(r.created_at), 'yyyy-MM-dd HH:mm:ss'),
            '日期': r.date,
            '單位': r.user_unit || '',
            '姓名': r.user_name || '',
            '帳號': r.user_account || '',
            '動作類型': r.action_type,
            '異動資料表': getTranslatedTableName(r.modify_table),
            '異動記錄ID': r.modify_record_id,
            '借用動作': formatLogValue('borrow_action', parseJson(r.new_data).borrow_action || parseJson(r.old_data).borrow_action),
            '借出項目': formatLogValue('borrowed_items', parseJson(r.new_data).borrowed_items || parseJson(r.old_data).borrowed_items),
            '歸還項目': formatLogValue('returned_items', parseJson(r.new_data).returned_items || parseJson(r.old_data).returned_items),
        }))

        exportToExcelFile(sheetData, '系統異動記錄')
        toast({ title: '匯出成功', description: `已匯出 ${dataToExport.length} 筆記錄` })
    }

    // 匯出 PDF
    const exportToPdf = async () => {
        const dataToExport = selected.size > 0 ? filteredLogs.filter(r => selected.has(r.id)) : filteredLogs
        if (dataToExport.length === 0) { toast({ title: '無資料可匯出', variant: 'destructive' }); return }

        const sheetData = dataToExport.map((r, i) => ({
            '#': i + 1,
            'ID': r.id,
            '建立時間': format(new Date(r.created_at), 'yyyy-MM-dd HH:mm:ss'),
            '日期': r.date,
            '單位': r.user_unit || '',
            '姓名': r.user_name || '',
            '帳號': r.user_account || '',
            '動作': r.action_type,
            '資料表': getTranslatedTableName(r.modify_table),
            '記錄ID': r.modify_record_id
        }))

        toast({ title: '正在準備匯出 PDF...', description: '正在載入中文字型，請稍候...' })

        try {
            await exportToPdfFile({
                title: '系統異動記錄清單',
                sheetData,
                filenamePrefix: '系統異動記錄',
                orientation: 'landscape',
                themeColor: [75, 85, 99], // 鐵灰色品牌色
                excludeColumns: ['ID', '建立時間']
            })
            toast({ title: 'PDF 匯出成功', description: `已匯出 ${dataToExport.length} 筆記錄` })
        } catch (error: any) {
            toast({ title: 'PDF 匯出失敗', description: error.message, variant: 'destructive' })
        }
    }

    // 匯出單筆明細 Excel
    const handleExportDetailExcel = (log: any) => {
        const aoa: any[][] = [];

        // 1. 基本資料
        aoa.push(['【異動記錄基本資料】', '']);
        aoa.push(['欄位', '值']);
        aoa.push(['ID', log.id]);
        aoa.push(['建立時間', format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')]);
        aoa.push(['發生日期', log.date]);
        aoa.push(['使用者單位', log.user_unit || '-']);
        aoa.push(['使用者姓名', log.user_name || '-']);
        aoa.push(['使用者帳號', log.user_account || '-']);
        aoa.push(['操作方式', log.action_type]);
        aoa.push(['異動資料表', getTranslatedTableName(log.modify_table)]);
        aoa.push(['異動項目的UUID', log.modify_record_id]);

        aoa.push([]);

        // 2. 異動明細
        const oldData = parseJson(log.old_data);
        const newData = parseJson(log.new_data);
        const allKeys = Array.from(new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})])).filter(key => key !== 'building' && key !== 'floor');

        // Sort keys
        const sortedKeys = allKeys.sort((a, b) => {
            const indexA = FIELD_ORDER.indexOf(a);
            const indexB = FIELD_ORDER.indexOf(b);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.localeCompare(b);
        });

        if (sortedKeys.length > 0) {
            aoa.push(['【異動明細對比】', '', '', '']);
            aoa.push(['欄位', '變更前', '變更後', '是否異動']);

            sortedKeys.forEach(key => {
                const oldVal = oldData?.[key];
                const newVal = newData?.[key];
                const isChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal);

                aoa.push([
                    FIELD_LABELS[key] || key,
                    formatLogValue(key, oldVal),
                    formatLogValue(key, newVal),
                    isChanged ? '是' : ''
                ]);
            });
        }

        exportAoaToExcelFile(aoa, `異動明細_${log.id.slice(0, 8)}`, '異動明細', [25, 40, 40, 10])
        toast({ title: 'Excel 匯出成功' })
    }

    // 匯出單筆明細 PDF (直向 A4, 雙表格, 鐵灰色主題)
    const handleExportDetailPdf = async (log: any) => {
        const basicHead = [['欄位', '值']];
        const basicBody = [
            ['ID', log.id],
            ['建立時間', format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')],
            ['發生日期', log.date],
            ['使用者單位', log.user_unit || '-'],
            ['使用者姓名', log.user_name || '-'],
            ['使用者帳號', log.user_account || '-'],
            ['操作方式', log.action_type],
            ['異動資料表', getTranslatedTableName(log.modify_table)],
            ['異動項目的UUID', log.modify_record_id]
        ];

        const oldData = parseJson(log.old_data);
        const newData = parseJson(log.new_data);
        const allKeys = Array.from(new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})])).filter(key => key !== 'building' && key !== 'floor');

        const sortedKeys = allKeys.sort((a, b) => {
            const indexA = FIELD_ORDER.indexOf(a);
            const indexB = FIELD_ORDER.indexOf(b);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.localeCompare(b);
        });

        const comparisonHead = [['欄位', '變更前', '變更後', '是否異動']];
        const comparisonBody = sortedKeys.map(key => {
            const oldVal = oldData?.[key];
            const newVal = newData?.[key];
            const isChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal);

            return [
                FIELD_LABELS[key] || key,
                formatLogValue(key, oldVal),
                formatLogValue(key, newVal),
                isChanged ? '是' : '否'
            ];
        });

        toast({ title: '正在準備匯出 PDF...', description: '正在載入中文字型，請稍候...' })

        try {
            await exportToPdfFile({
                title: '系統異動明細紀錄',
                filenamePrefix: `異動明細_${log.id.slice(0, 8)}`,
                orientation: 'portrait', // 直向
                themeColor: [75, 85, 99], // 鐵灰色品牌色
                head: basicHead,
                body: basicBody,
                secondTable: {
                    title: '異動資料對比',
                    head: comparisonHead,
                    body: comparisonBody
                }
            })
            toast({ title: 'PDF 匯出成功' })
        } catch (error: any) {
            toast({ title: 'PDF 匯出失敗', description: error.message, variant: 'destructive' })
        }
    }

    // 動作類型圖示與顏色
    const getActionBadge = (log: any) => {
        const actionType = log.action_type

        switch (actionType) {
            case 'Insert':
                return <Badge className="bg-green-500 gap-1"><Plus className="w-3 h-3" /> 新增</Badge>
            case 'Update':
                return <Badge className="bg-blue-500 gap-1"><Edit className="w-3 h-3" /> 修改</Badge>
            case 'Delete':
                return <Badge variant="destructive" className="gap-1"><Trash2 className="w-3 h-3" /> 刪除</Badge>
            case 'Login':
                // Check if it's a failed login
                let isFailure = false
                try {
                    const newData = typeof log.new_data === 'string' ? JSON.parse(log.new_data) : log.new_data
                    if (newData?.status === 'Login Failed' || newData?.status?.includes('Account Locked')) {
                        isFailure = true
                    }
                } catch (e) { }

                if (isFailure) {
                    return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> 密碼錯誤</Badge>
                }
                return <Badge variant="outline" className="border-emerald-500 text-emerald-600 gap-1"><LogIn className="w-3 h-3" /> 登入</Badge>
            case 'Logout':
                return <Badge variant="outline" className="border-slate-500 text-foreground/70 gap-1"><LogOut className="w-3 h-3" /> 登出</Badge>
            default:
                return <Badge variant="secondary">{actionType}</Badge>
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100">
            <header className="bg-background/95 backdrop-blur-md border-b border-border/50 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 shrink-0">
                                <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
                                    <ArrowLeft className="w-5 h-5" />
                                </Button>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl text-white">
                                        <History className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h1 className="text-xl font-bold text-foreground">系統異動記錄</h1>
                                        <p className="text-sm text-muted-foreground hidden md:block">使用者操作與資料異動記錄</p>
                                    </div>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" className="md:hidden" onClick={() => setIsFiltersOpen(!isFiltersOpen)}>
                                <Filter className="w-4 h-4 mr-1" />{isFiltersOpen ? '隱藏' : '篩選'}
                            </Button>
                        </div>

                        <div className={`flex-col md:flex-row items-stretch md:items-center gap-3 ${isFiltersOpen ? 'flex' : 'hidden md:flex'}`}>
                            <div className="flex items-center gap-2">
                                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full md:w-36" placeholder="開始日期" />
                                <span className="text-muted-foreground">~</span>
                                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full md:w-36" placeholder="結束日期" />
                            </div>

                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }} placeholder="多關鍵字空白分割(AND)搜尋" className="pl-10 w-full md:w-80" />
                            </div>

                            <div className="flex items-center gap-2">
                                <Button variant="outline" onClick={fetchLogs} disabled={loading} className="flex-1 md:flex-none">
                                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />查詢
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button className="bg-green-600 hover:bg-green-700 flex-1 md:flex-none text-white">
                                            <Download className="w-4 h-4 mr-2" /> 匯出
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
                        </div>
                    </div>
                </div>
            </header>

            {/* Table */}
            <main className="max-w-7xl mx-auto p-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card rounded-2xl shadow-card border border-border overflow-hidden"
                >
                    <div className="overflow-x-auto">
                        <Table className="hidden md:table">
                            <TableHeader>
                                <TableRow className="bg-muted">
                                    <TableHead className="w-12"><Checkbox checked={selected.size === paginatedLogs.length && paginatedLogs.length > 0} onCheckedChange={toggleSelectAll} /></TableHead>
                                    <TableHead className="w-12">#</TableHead>
                                    <SortableTableHead label="建立時間" sortKey="created_at" currentSort={sort} onSort={handleSort} />
                                    <SortableTableHead label="日期" sortKey="date" currentSort={sort} onSort={handleSort} />
                                    <SortableTableHead label="單位" sortKey="user_unit" currentSort={sort} onSort={handleSort} />
                                    <SortableTableHead label="姓名" sortKey="user_name" currentSort={sort} onSort={handleSort} />
                                    <SortableTableHead label="帳號" sortKey="user_account" currentSort={sort} onSort={handleSort} />
                                    <SortableTableHead label="動作類型" sortKey="action_type" currentSort={sort} onSort={handleSort} />
                                    <SortableTableHead label="異動資料表" sortKey="modify_table" currentSort={sort} onSort={handleSort} />
                                    <TableHead>異動記錄ID</TableHead>
                                    <TableHead>異動內容</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedLogs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={11} className="p-0">
                                            <EmptyState icon={History} title="沒有找到紀錄" description="目前沒有符合條件的異動紀錄，請調整篩選條件。" />
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedLogs.map((log, index) => (
                                        <TableRow key={log.id} className={`hover:bg-orange-50/50 dark:hover:bg-orange-900/20 transition-colors even:bg-muted/20 dark:even:bg-muted/10 ${selected.has(log.id) ? 'bg-orange-100 dark:bg-orange-900/40' : ''}`}>
                                            <TableCell><Checkbox checked={selected.has(log.id)} onCheckedChange={() => toggleSelect(log.id)} /></TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {(currentPage - 1) * pageSize + index + 1}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                                                {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}
                                            </TableCell>
                                            <TableCell className="font-mono text-sm">
                                                {log.date}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {log.user_unit || '-'}
                                            </TableCell>
                                            <TableCell className="font-bold text-sm">
                                                {log.user_name || '-'}
                                            </TableCell>
                                            <TableCell className="font-mono text-sm">
                                                {log.user_account || '-'}
                                            </TableCell>
                                            <TableCell>
                                                {getActionBadge(log)}
                                            </TableCell>
                                            <TableCell className="font-mono text-sm">
                                                {getTranslatedTableName(log.modify_table)}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground max-w-[100px] truncate" title={log.modify_record_id}>
                                                {log.modify_record_id?.slice(0, 8)}...
                                            </TableCell>
                                            <TableCell>
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-8 text-teal-600 hover:text-teal-700 hover:bg-teal-50">
                                                            <Eye className="w-4 h-4 mr-1" />
                                                            明細
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                                        <DialogHeader>
                                                            <DialogTitle className="flex items-center justify-between pr-8">
                                                                異動明細
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                                                                            <Download className="w-4 h-4 mr-1" />匯出
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end">
                                                                        <DropdownMenuItem onClick={() => handleExportDetailExcel(log)}>
                                                                            匯出 Excel
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem onClick={() => handleExportDetailPdf(log)}>
                                                                            匯出 PDF
                                                                        </DropdownMenuItem>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </DialogTitle>
                                                            <DialogDescription>
                                                                異動時間：{format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')} | 操作者：{log.user_name}
                                                            </DialogDescription>
                                                        </DialogHeader>

                                                        <div className="mt-4 border rounded-lg overflow-hidden">
                                                            {/* 基本資訊 */}
                                                            <Table>
                                                                <TableBody>
                                                                    <TableRow><TableCell className="bg-muted font-bold w-32">ID</TableCell><TableCell className="font-mono text-xs">{log.id}</TableCell></TableRow>
                                                                    <TableRow><TableCell className="bg-muted font-bold">建立時間</TableCell><TableCell className="font-mono">{format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}</TableCell></TableRow>
                                                                    <TableRow><TableCell className="bg-muted font-bold">發生日期</TableCell><TableCell className="font-mono">{log.date}</TableCell></TableRow>
                                                                    <TableRow><TableCell className="bg-muted font-bold">使用者單位</TableCell><TableCell>{log.user_unit || '-'}</TableCell></TableRow>
                                                                    <TableRow><TableCell className="bg-muted font-bold">使用者姓名</TableCell><TableCell className="font-bold">{log.user_name || '-'}</TableCell></TableRow>
                                                                    <TableRow><TableCell className="bg-muted font-bold">使用者帳號</TableCell><TableCell className="font-mono">{log.user_account || '-'}</TableCell></TableRow>
                                                                    <TableRow><TableCell className="bg-muted font-bold">操作方式</TableCell><TableCell>{getActionBadge(log)}</TableCell></TableRow>
                                                                    <TableRow><TableCell className="bg-muted font-bold">異動資料表</TableCell><TableCell className="font-mono">{getTranslatedTableName(log.modify_table)}</TableCell></TableRow>
                                                                    <TableRow><TableCell className="bg-muted font-bold">異動項目的UUID</TableCell><TableCell className="font-mono text-xs">{log.modify_record_id}</TableCell></TableRow>
                                                                </TableBody>
                                                            </Table>
                                                        </div>

                                                        {/* 異動資料對比 */}
                                                        {(() => {
                                                            const parseJson = (data: any) => {
                                                                if (!data) return {}
                                                                if (typeof data === 'string') { try { return JSON.parse(data) } catch { return {} } }
                                                                return data
                                                            }
                                                            const oldData = parseJson(log.old_data)
                                                            const newData = parseJson(log.new_data)
                                                            const allKeys = Array.from(new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})])).filter(key => key !== 'building' && key !== 'floor')

                                                            const sortedKeys = allKeys.sort((a, b) => {
                                                                const indexA = FIELD_ORDER.indexOf(a);
                                                                const indexB = FIELD_ORDER.indexOf(b);
                                                                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                                                                if (indexA !== -1) return -1;
                                                                if (indexB !== -1) return 1;
                                                                return a.localeCompare(b);
                                                            });

                                                            if (sortedKeys.length === 0) return null;

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
                                                                                            {formatLogValue(key, oldVal)}
                                                                                        </TableCell>
                                                                                        <TableCell className={`font-mono text-sm break-words ${isChanged ? 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/20' : 'dark:text-gray-200'}`}>
                                                                                            {formatLogValue(key, newVal)}
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
                                    ))
                                )}
                            </TableBody>
                        </Table>

                        {/* 手機版卡片列表 */}
                        <div className="md:hidden mt-4 space-y-3 px-2 pb-4">
                            {paginatedLogs.length > 0 && (
                                <div className="flex items-center justify-between bg-card p-3 rounded-xl border border-border/80 shadow-sm mb-3">
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id="mobile-select-all"
                                            checked={selected.size === paginatedLogs.length && paginatedLogs.length > 0}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                        <label htmlFor="mobile-select-all" className="text-sm font-medium cursor-pointer select-none">
                                            全選({selected.size}/{paginatedLogs.length})
                                        </label>
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

                            {paginatedLogs.length === 0 ? (
                                <EmptyState icon={History} title="沒有找到紀錄" description="目前沒有符合條件的異動紀錄，請調整篩選條件。" />
                            ) : (
                                paginatedLogs.map((log, index) => (
                                    <MobileTableCard
                                        key={log.id}
                                        id={log.id}
                                        title={`#${(currentPage - 1) * pageSize + index + 1} ${log.user_name || '-'}`}
                                        subtitle={log.user_account || '-'}
                                        status={{
                                            label: log.action_type === 'Insert' ? '新增' : log.action_type === 'Update' ? '修改' : log.action_type === 'Delete' ? '刪除' : log.action_type === 'Login' ? '登入' : log.action_type === 'Logout' ? '登出' : log.action_type,
                                            variant: log.action_type === 'Delete' ? 'destructive' as const : log.action_type === 'Insert' ? 'default' as const : 'secondary' as const,
                                            className: log.action_type === 'Insert' ? 'bg-green-500' : log.action_type === 'Update' ? 'bg-blue-500' : undefined,
                                        }}
                                        date={log.date}
                                        time={format(new Date(log.created_at), 'HH:mm:ss')}
                                        isSelected={selected.has(log.id)}
                                        onSelect={() => toggleSelect(log.id)}
                                        details={[
                                            { label: '建立時間', value: format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss') },
                                            { label: '單位', value: log.user_unit || '-' },
                                            { label: '異動資料表', value: getTranslatedTableName(log.modify_table) },
                                            { label: '異動記錄ID', value: log.modify_record_id?.slice(0, 8) + '...' },
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
                                                            異動明細
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                                                                        <Download className="w-4 h-4 mr-1" />匯出
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem onClick={() => handleExportDetailExcel(log)}>
                                                                        匯出 Excel
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => handleExportDetailPdf(log)}>
                                                                        匯出 PDF
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </DialogTitle>
                                                        <DialogDescription>
                                                            異動時間：{format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')} | 操作者：{log.user_name}
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <div className="mt-4 border rounded-lg overflow-hidden">
                                                        <Table>
                                                            <TableBody>
                                                                <TableRow><TableCell className="bg-muted font-bold w-32">ID</TableCell><TableCell className="font-mono text-xs">{log.id}</TableCell></TableRow>
                                                                <TableRow><TableCell className="bg-muted font-bold">建立時間</TableCell><TableCell className="font-mono">{format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}</TableCell></TableRow>
                                                                <TableRow><TableCell className="bg-muted font-bold">發生日期</TableCell><TableCell className="font-mono">{log.date}</TableCell></TableRow>
                                                                <TableRow><TableCell className="bg-muted font-bold">使用者單位</TableCell><TableCell>{log.user_unit || '-'}</TableCell></TableRow>
                                                                <TableRow><TableCell className="bg-muted font-bold">使用者姓名</TableCell><TableCell className="font-bold">{log.user_name || '-'}</TableCell></TableRow>
                                                                <TableRow><TableCell className="bg-muted font-bold">使用者帳號</TableCell><TableCell className="font-mono">{log.user_account || '-'}</TableCell></TableRow>
                                                                <TableRow><TableCell className="bg-muted font-bold">操作方式</TableCell><TableCell>{getActionBadge(log)}</TableCell></TableRow>
                                                                <TableRow><TableCell className="bg-muted font-bold">異動資料表</TableCell><TableCell className="font-mono">{getTranslatedTableName(log.modify_table)}</TableCell></TableRow>
                                                                <TableRow><TableCell className="bg-muted font-bold">異動項目的UUID</TableCell><TableCell className="font-mono text-xs">{log.modify_record_id}</TableCell></TableRow>
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                    {(() => {
                                                        const parseJson = (data: any) => {
                                                            if (!data) return {}
                                                            if (typeof data === 'string') { try { return JSON.parse(data) } catch { return {} } }
                                                            return data
                                                        }
                                                        const oldData = parseJson(log.old_data)
                                                        const newData = parseJson(log.new_data)
                                                        const allKeys = Array.from(new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})])).filter(key => key !== 'building' && key !== 'floor')
                                                        const sortedKeys = allKeys.sort((a, b) => {
                                                            const indexA = FIELD_ORDER.indexOf(a); const indexB = FIELD_ORDER.indexOf(b);
                                                            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                                                            if (indexA !== -1) return -1; if (indexB !== -1) return 1;
                                                            return a.localeCompare(b);
                                                        });
                                                        if (sortedKeys.length === 0) return null;
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
                                                                                    <TableCell className={`font-mono text-sm break-words ${isChanged ? 'text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/20' : 'dark:text-gray-200'}`}>{formatLogValue(key, oldVal)}</TableCell>
                                                                                    <TableCell className={`font-mono text-sm break-words ${isChanged ? 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/20' : 'dark:text-gray-200'}`}>{formatLogValue(key, newVal)}</TableCell>
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
