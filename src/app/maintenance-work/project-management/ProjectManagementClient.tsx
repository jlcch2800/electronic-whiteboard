'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
    FolderKanban, Plus, Edit2, Trash2, ChevronDown, ChevronRight,
    FolderPlus, Wrench, Loader2, RefreshCw, AlertTriangle, FileText, CheckCircle, History, Eye, Download
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { exportToPdfFile } from '@/lib/export-utils'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

import { createClient } from '@/lib/supabase/client'
import { logChangeRecord } from '@/lib/change-log'
import { useAppStore } from '@/stores/useAppStore'
import Navbar from '@/components/Navbar'
import { STATUS_COLORS } from '@/lib/maintenance-constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog'
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import ProjectWorkRecordDialog from '@/components/projects/ProjectWorkRecordDialog'

interface Project {
    id: string
    created_at: string
    maintenance_project_name: string
    description: string | null
    is_closed: boolean
    closed_at: string | null
}

interface ProjectCategory {
    id: string
    created_at: string
    maintenance_project_id: string
    maintenance_category_name: string
}

interface MaintenanceOrder {
    id: string
    work_order_id: string
    status: string
    requester_name: string
    handler_name: string | null
    work_order_date: string
    cost_center?: string
    maintain_content?: string
    vendor_name?: string | null
    maintenance_project_category_id?: string | null
}

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
    '#F7D6D2': { bg: 'bg-[#F7D6D2]/20 dark:bg-[#F7D6D2]/10', text: 'text-[#9e3a30] dark:text-[#f8b4ad]', border: 'border-[#F7D6D2]/60 dark:border-[#F7D6D2]/30' },
    '#D4E7EE': { bg: 'bg-[#D4E7EE]/20 dark:bg-[#D4E7EE]/10', text: 'text-[#2f6f85] dark:text-[#a0d2e2]', border: 'border-[#D4E7EE]/60 dark:border-[#D4E7EE]/30' },
    '#F3E8C3': { bg: 'bg-[#F3E8C3]/20 dark:bg-[#F3E8C3]/10', text: 'text-[#826a1d] dark:text-[#ecd997]', border: 'border-[#F3E8C3]/60 dark:border-[#F3E8C3]/30' },
    '#DDE9CC': { bg: 'bg-[#DDE9CC]/20 dark:bg-[#DDE9CC]/10', text: 'text-[#516e2d] dark:text-[#cce0b4]', border: 'border-[#DDE9CC]/60 dark:border-[#DDE9CC]/30' },
    'PASTEL Lavender': { bg: 'bg-violet-50/80 dark:bg-violet-950/20', text: 'text-violet-700 dark:text-violet-400', border: 'border-violet-200/60 dark:border-violet-800/40' },
    'Pastel blue': { bg: 'bg-sky-50/80 dark:bg-sky-950/20', text: 'text-sky-700 dark:text-sky-400', border: 'border-sky-200/60 dark:border-sky-800/40' },
    '#F1CEAF': { bg: 'bg-[#F1CEAF]/20 dark:bg-[#F1CEAF]/10', text: 'text-[#93521d] dark:text-[#f8d4b8]', border: 'border-[#F1CEAF]/60 dark:border-[#F1CEAF]/30' },
    'yellow': { bg: 'bg-yellow-50/80 dark:bg-yellow-950/20', text: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-200/60 dark:border-yellow-800/40' },
    'Peach': { bg: 'bg-orange-50/80 dark:bg-orange-950/20', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-200/60 dark:border-orange-800/40' },
    'Sage Green': { bg: 'bg-emerald-50/80 dark:bg-emerald-950/20', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200/60 dark:border-emerald-800/40' },
}

const getStatusColor = (status: string) => {
    const colorKey = STATUS_COLORS[status] || 'Pastel blue'
    const c = COLOR_MAP[colorKey] || COLOR_MAP['Pastel blue']
    return `${c.bg} ${c.text} ${c.border}`
}

// 專案識別色彩方案：排列順序以最大化相鄰色差（冷→暖→冷→暖…）
const PROJECT_ACCENT_COLORS = [
    { border: 'border-l-blue-500', banner: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500', rowBg: 'bg-blue-50/60 dark:bg-blue-950/15', hoverRowBg: 'hover:bg-blue-50/60 dark:hover:bg-blue-950/15', hoverBanner: 'hover:bg-blue-50 dark:hover:bg-blue-950/30' },
    { border: 'border-l-amber-500', banner: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500', rowBg: 'bg-amber-50/60 dark:bg-amber-950/15', hoverRowBg: 'hover:bg-amber-50/60 dark:hover:bg-amber-950/15', hoverBanner: 'hover:bg-amber-50 dark:hover:bg-amber-950/30' },
    { border: 'border-l-teal-500', banner: 'bg-teal-50 dark:bg-teal-950/30', text: 'text-teal-700 dark:text-teal-300', dot: 'bg-teal-500', rowBg: 'bg-teal-50/60 dark:bg-teal-950/15', hoverRowBg: 'hover:bg-teal-50/60 dark:hover:bg-teal-950/15', hoverBanner: 'hover:bg-teal-50 dark:hover:bg-teal-950/30' },
    { border: 'border-l-rose-500', banner: 'bg-rose-50 dark:bg-rose-950/30', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500', rowBg: 'bg-rose-50/60 dark:bg-rose-950/15', hoverRowBg: 'hover:bg-rose-50/60 dark:hover:bg-rose-950/15', hoverBanner: 'hover:bg-rose-50 dark:hover:bg-rose-950/30' },
    { border: 'border-l-emerald-500', banner: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500', rowBg: 'bg-emerald-50/60 dark:bg-emerald-950/15', hoverRowBg: 'hover:bg-emerald-50/60 dark:hover:bg-emerald-950/15', hoverBanner: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/30' },
    { border: 'border-l-violet-500', banner: 'bg-violet-50 dark:bg-violet-950/30', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500', rowBg: 'bg-violet-50/60 dark:bg-violet-950/15', hoverRowBg: 'hover:bg-violet-50/60 dark:hover:bg-violet-950/15', hoverBanner: 'hover:bg-violet-50 dark:hover:bg-violet-950/30' },
    { border: 'border-l-indigo-500', banner: 'bg-indigo-50 dark:bg-indigo-950/30', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500', rowBg: 'bg-indigo-50/60 dark:bg-indigo-950/15', hoverRowBg: 'hover:bg-indigo-50/60 dark:hover:bg-indigo-950/15', hoverBanner: 'hover:bg-indigo-50 dark:hover:bg-indigo-950/30' },
    { border: 'border-l-orange-500', banner: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500', rowBg: 'bg-orange-50/60 dark:bg-orange-950/15', hoverRowBg: 'hover:bg-orange-50/60 dark:hover:bg-orange-950/15', hoverBanner: 'hover:bg-orange-50 dark:hover:bg-orange-950/30' },
]

interface ProjectManagementClientProps {
    initialProjects: Project[]
}

export default function ProjectManagementClient({ initialProjects }: ProjectManagementClientProps) {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()
    const { profile } = useAppStore()

    // 專案列表狀態
    const [projects, setProjects] = useState<Project[]>(initialProjects)
    const [loading, setLoading] = useState(false)
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'closed'>('all')

    // 展開的專案 ID Set
    const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())

    // 展開專案的詳細資料：類別、關聯維修單
    const [projectCategories, setProjectCategories] = useState<Record<string, ProjectCategory[]>>({})
    const [projectOrders, setProjectOrders] = useState<Record<string, MaintenanceOrder[]>>({})
    const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({})

    // 專案 Dialog 狀態
    const [projectDialogOpen, setProjectDialogOpen] = useState(false)
    const [editingProject, setEditingProject] = useState<Project | null>(null)
    const [projectNameInput, setProjectNameInput] = useState('')
    const [projectDescInput, setProjectDescInput] = useState('')
    const [projectIsClosedInput, setProjectIsClosedInput] = useState(false)

    // 類別 Dialog 狀態
    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
    const [targetProjectIdForCategory, setTargetProjectIdForCategory] = useState<string>('')
    const [editingCategory, setEditingCategory] = useState<ProjectCategory | null>(null)
    const [categoryNameInput, setCategoryNameInput] = useState('')

    // 刪除專案確認 Dialog 狀態
    const [deleteProjectAlertOpen, setDeleteProjectAlertOpen] = useState(false)
    const [deletingProject, setDeletingProject] = useState<Project | null>(null)

    // 刪除類別確認 Dialog 狀態
    const [deleteCategoryAlertOpen, setDeleteCategoryAlertOpen] = useState(false)
    const [deletingCategory, setDeletingCategory] = useState<ProjectCategory | null>(null)

    // 專案工作紀錄 Dialog 狀態
    const [workRecordDialog, setWorkRecordDialog] = useState<{
        open: boolean
        projectId: string
        projectCategoryId: string
        projectName: string
        categoryName: string
    }>({
        open: false,
        projectId: '',
        projectCategoryId: '',
        projectName: '',
        categoryName: ''
    })

    // 取得所有專案
    const fetchProjects = useCallback(async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('maintenance_project')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setProjects(data || [])
        } catch (err: any) {
            toast({
                title: '取得專案失敗',
                description: err.message,
                variant: 'destructive'
            })
        } finally {
            setLoading(false)
        }
    }, [supabase, toast])

    // 取得指定專案的子資料（主項目、關聯維修單）
    const fetchProjectDetails = useCallback(async (projectId: string) => {
        setDetailLoading(prev => ({ ...prev, [projectId]: true }))
        try {
            // 查詢主項目
            const { data: categories, error: catError } = await supabase
                .from('maintenance_project_category')
                .select('*')
                .eq('maintenance_project_id', projectId)
                .order('created_at', { ascending: true })

            if (catError) throw catError

            // 查詢關聯維修單
            const { data: orders, error: orderError } = await supabase
                .from('maintenance_work_orders')
                .select('id, work_order_id, status, requester_name, handler_name, work_order_date, cost_center, maintain_content, vendor_name, maintenance_project_category_id')
                .eq('maintenance_project_id', projectId)
                .order('work_order_date', { ascending: false })

            if (orderError) throw orderError

            setProjectCategories(prev => ({ ...prev, [projectId]: categories || [] }))
            setProjectOrders(prev => ({ ...prev, [projectId]: orders || [] }))
        } catch (err: any) {
            toast({
                title: '取得專案詳細資訊失敗',
                description: err.message,
                variant: 'destructive'
            })
        } finally {
            setDetailLoading(prev => ({ ...prev, [projectId]: false }))
        }
    }, [supabase, toast])

    // 展開/折疊處理
    const toggleExpand = async (projectId: string) => {
        const nextExpanded = new Set(expandedProjects)
        if (nextExpanded.has(projectId)) {
            nextExpanded.delete(projectId)
        } else {
            nextExpanded.add(projectId)
            // 展開時自動抓取詳細資料
            await fetchProjectDetails(projectId)
        }
        expandedProjects.forEach((id) => {
            if (id === projectId && nextExpanded.has(id)) {
                // Keep expanded
            }
        })
        setExpandedProjects(nextExpanded)
    }

    // 篩選後專案
    const filteredProjects = projects.filter(p => {
        if (filterStatus === 'active') return !p.is_closed
        if (filterStatus === 'closed') return p.is_closed
        return true
    })

    // 開啟專案新增 Dialog
    const handleOpenAddProject = () => {
        setEditingProject(null)
        setProjectNameInput('')
        setProjectDescInput('')
        setProjectIsClosedInput(false)
        setProjectDialogOpen(true)
    }

    // 開啟專案編輯 Dialog
    const handleOpenEditProject = (project: Project) => {
        setEditingProject(project)
        setProjectNameInput(project.maintenance_project_name)
        setProjectDescInput(project.description || '')
        setProjectIsClosedInput(project.is_closed)
        setProjectDialogOpen(true)
    }

    // 儲存專案（新增或編輯）
    const handleSaveProject = async () => {
        if (!projectNameInput.trim()) {
            toast({
                title: '欄位錯誤',
                description: '請輸入專案名稱',
                variant: 'destructive'
            })
            return
        }

        try {
            if (editingProject) {
                // 編輯專案
                const payload = {
                    maintenance_project_name: projectNameInput.trim(),
                    description: projectDescInput.trim(),
                    is_closed: projectIsClosedInput,
                    closed_at: projectIsClosedInput ? (editingProject.closed_at || new Date().toISOString()) : null
                }

                const { error } = await supabase
                    .from('maintenance_project')
                    .update(payload)
                    .eq('id', editingProject.id)

                if (error) throw error

                logChangeRecord({
                    actionType: 'Update',
                    modifyTable: 'maintenance_project',
                    modifyRecordId: editingProject.id,
                    oldData: editingProject,
                    newData: payload
                })

                toast({ title: '修改成功', description: '專案資料已成功更新' })
            } else {
                // 新增專案
                const payload = {
                    maintenance_project_name: projectNameInput.trim(),
                    description: projectDescInput.trim(),
                    is_closed: false,
                    closed_at: null
                }

                const { data, error } = await supabase
                    .from('maintenance_project')
                    .insert(payload)
                    .select('id')
                    .single()

                if (error) throw error

                logChangeRecord({
                    actionType: 'Insert',
                    modifyTable: 'maintenance_project',
                    modifyRecordId: data?.id || '',
                    newData: payload
                })

                toast({ title: '建立成功', description: '專案已順利建立' })
            }

            setProjectDialogOpen(false)
            fetchProjects()
        } catch (err: any) {
            toast({
                title: '儲存失敗',
                description: err.message,
                variant: 'destructive'
            })
        }
    }

    // 開啟刪除專案確認
    const handleConfirmDeleteProject = (project: Project) => {
        setDeletingProject(project)
        setDeleteProjectAlertOpen(true)
    }

    // 刪除專案
    const handleDeleteProject = async () => {
        if (!deletingProject) return
        try {
            // 先檢查此專案底下是否有關聯維修單
            const { count, error: countError } = await supabase
                .from('maintenance_work_orders')
                .select('*', { count: 'exact', head: true })
                .eq('maintenance_project_id', deletingProject.id)

            if (countError) throw countError

            if (count && count > 0) {
                toast({
                    title: '無法刪除專案',
                    description: `此專案目前有關聯的 ${count} 筆維修單，請先移除關聯再進行刪除。`,
                    variant: 'destructive'
                })
                setDeleteProjectAlertOpen(false)
                return
            }

            const { error } = await supabase
                .from('maintenance_project')
                .delete()
                .eq('id', deletingProject.id)

            if (error) throw error

            logChangeRecord({
                actionType: 'Delete',
                modifyTable: 'maintenance_project',
                modifyRecordId: deletingProject.id,
                oldData: deletingProject
            })

            toast({ title: '刪除成功', description: '專案已順利刪除' })
            fetchProjects()
        } catch (err: any) {
            toast({
                title: '刪除失敗',
                description: err.message,
                variant: 'destructive'
            })
        } finally {
            setDeleteProjectAlertOpen(false)
            setDeletingProject(null)
        }
    }

    // 開啟類別新增 Dialog
    const handleOpenAddCategory = (projectId: string) => {
        setTargetProjectIdForCategory(projectId)
        setEditingCategory(null)
        setCategoryNameInput('')
        setCategoryDialogOpen(true)
    }

    // 開啟類別編輯 Dialog
    const handleOpenEditCategory = (projectId: string, category: ProjectCategory) => {
        setTargetProjectIdForCategory(projectId)
        setEditingCategory(category)
        setCategoryNameInput(category.maintenance_category_name)
        setCategoryDialogOpen(true)
    }

    // 儲存類別（新增或編輯）
    const handleSaveCategory = async () => {
        if (!categoryNameInput.trim()) {
            toast({
                title: '欄位錯誤',
                description: '請輸入主項目名稱',
                variant: 'destructive'
            })
            return
        }

        try {
            if (editingCategory) {
                // 編輯類別
                const payload = {
                    maintenance_category_name: categoryNameInput.trim()
                }

                const { error } = await supabase
                    .from('maintenance_project_category')
                    .update(payload)
                    .eq('id', editingCategory.id)

                if (error) throw error

                logChangeRecord({
                    actionType: 'Update',
                    modifyTable: 'maintenance_project_category',
                    modifyRecordId: editingCategory.id,
                    oldData: editingCategory,
                    newData: payload
                })

                toast({ title: '修改成功', description: '主項目已更新' })
            } else {
                // 新增類別
                const payload = {
                    maintenance_project_id: targetProjectIdForCategory,
                    maintenance_category_name: categoryNameInput.trim()
                }

                const { data, error } = await supabase
                    .from('maintenance_project_category')
                    .insert(payload)
                    .select('id')
                    .single()

                if (error) throw error

                logChangeRecord({
                    actionType: 'Insert',
                    modifyTable: 'maintenance_project_category',
                    modifyRecordId: data?.id || '',
                    newData: payload
                })

                toast({ title: '建立成功', description: '主項目已新增' })
            }

            setCategoryDialogOpen(false)
            fetchProjectDetails(targetProjectIdForCategory)
        } catch (err: any) {
            toast({
                title: '儲存失敗',
                description: err.message,
                variant: 'destructive'
            })
        }
    }

    // 開啟類別刪除確認
    const handleConfirmDeleteCategory = (category: ProjectCategory) => {
        setDeletingCategory(category)
        setDeleteCategoryAlertOpen(true)
    }

    // 刪除類別
    const handleDeleteCategory = async () => {
        if (!deletingCategory) return
        try {
            // 檢查此類別底下是否有維修單關聯
            const { count, error: countError } = await supabase
                .from('maintenance_work_orders')
                .select('*', { count: 'exact', head: true })
                .eq('maintenance_project_category_id', deletingCategory.id)

            if (countError) throw countError

            if (count && count > 0) {
                toast({
                    title: '無法刪除主項目',
                    description: `此主項目目前有關聯的 ${count} 筆維修單，請先更換工單的專案類別。`,
                    variant: 'destructive'
                })
                setDeleteCategoryAlertOpen(false)
                return
            }

            const { error } = await supabase
                .from('maintenance_project_category')
                .delete()
                .eq('id', deletingCategory.id)

            if (error) throw error

            logChangeRecord({
                actionType: 'Delete',
                modifyTable: 'maintenance_project_category',
                modifyRecordId: deletingCategory.id,
                oldData: deletingCategory
            })

            toast({ title: '刪除成功', description: '主項目已刪除' })
            fetchProjectDetails(deletingCategory.maintenance_project_id)
        } catch (err: any) {
            toast({
                title: '刪除失敗',
                description: err.message,
                variant: 'destructive'
            })
        } finally {
            setDeleteCategoryAlertOpen(false)
            setDeletingCategory(null)
        }
    }

    // 匯出特定專案主項目之工作紀錄 (Excel 或 PDF)
    const handleExportCategoryRecords = async (
        project: Project,
        cat: ProjectCategory,
        exportType: 'excel' | 'pdf'
    ) => {
        try {
            toast({ title: '正在準備資料...', description: '即將匯出檔案，請稍候' })

            // 1. 讀取維修單
            const { data: orders } = await supabase
                .from('maintenance_work_orders')
                .select('*')
                .eq('maintenance_project_id', project.id)
                .eq('maintenance_project_category_id', cat.id)
                .order('created_at', { ascending: false })

            // 2. 讀取廠商工作紀錄 (今日與歷史歸檔)
            const [vendorsRes, historyRes] = await Promise.all([
                supabase
                    .from('vendor_today_work')
                    .select('*')
                    .eq('maintenance_project_id', project.id)
                    .eq('maintenance_project_category_id', cat.id),
                supabase
                    .from('vendor_today_work_history')
                    .select('*')
                    .eq('maintenance_project_id', project.id)
                    .eq('maintenance_project_category_id', cat.id)
            ])

            const activeVendors = vendorsRes.data || []
            const historyVendors = historyRes.data || []
            const allVendors = [...activeVendors, ...historyVendors].sort((a, b) => (b.work_date || '').localeCompare(a.work_date || ''))

            // 3. 讀取所有附件
            const { data: files } = await supabase
                .from('maintenance_project_work_file')
                .select('*')
                .eq('maintenance_project_id', project.id)
                .order('created_at', { ascending: false })

            const workOrdersList = orders || []
            const vendorWorksList = allVendors
            const attachmentsList = files || []

            if (exportType === 'excel') {
                const wb = XLSX.utils.book_new()

                const orderData = workOrdersList.map(o => ({
                    '工單編號': o.work_order_id || o.order_id || '',
                    '日期': o.work_order_date || o.sent_date || '',
                    '主項目': cat.maintenance_category_name,
                    '維修內容': o.maintain_content || o.cause || '',
                    '處理狀態': o.status || '',
                    '成本中心': o.cost_center || '',
                    '開單人': o.requester_name || '',
                    '承辦人': o.handler_name || '',
                    '廠商': o.vendor_name || ''
                }))
                const wsOrders = XLSX.utils.json_to_sheet(orderData)
                XLSX.utils.book_append_sheet(wb, wsOrders, '工務維修單')

                const vendorData = vendorWorksList.map(v => {
                    const rowFiles = attachmentsList.filter(a => a.vendor_work_id === v.id)
                    const urls = rowFiles.map(a => a.image_url || a.video_url || a.file_url).join(' \n')
                    return {
                        '施工日期': v.work_date || '',
                        '廠商名稱': v.vendor_name || '',
                        '負責人員': v.vendor_contact || '',
                        '到院時間': v.arrival_time || '',
                        '離院時間': v.departure_time || '',
                        '施工地點': v.location || '',
                        '工作證號': v.vendor_badge_id || '',
                        '施工人數': v.head_count || 1,
                        '工作/施工內容': v.work_content || '',
                        '備註': v.note || '',
                        '附件連結': urls
                    }
                })
                const wsVendors = XLSX.utils.json_to_sheet(vendorData)
                XLSX.utils.book_append_sheet(wb, wsVendors, '廠商施工日誌')

                XLSX.writeFile(wb, `專案工作紀錄_${project.maintenance_project_name}_${cat.maintenance_category_name}.xlsx`)
                toast({ title: '匯出成功', description: 'Excel 檔案已下載' })
            } else {
                const orderHead = [['工單編號', '日期', '主項目', '維修內容', '處理狀態', '開單人', '承辦人', '廠商']]
                const orderBody = workOrdersList.map(o => [
                    o.work_order_id || o.order_id || '',
                    o.work_order_date || o.sent_date || '',
                    cat.maintenance_category_name,
                    o.maintain_content || o.cause || '',
                    o.status || '',
                    o.requester_name || '',
                    o.handler_name || '',
                    o.vendor_name || ''
                ])

                const vendorHead = [['施工日期', '廠商名稱', '負責人員', '到離院時間', '人數', '施工地點', '施工內容', '備註']]
                const vendorBody = vendorWorksList.map(v => [
                    v.work_date || '',
                    v.vendor_name || '',
                    v.vendor_contact || '',
                    `${v.arrival_time || '--:--'} ~ ${v.departure_time || '--:--'}`,
                    `${v.head_count || 1} 人`,
                    v.location || '',
                    v.work_content || '',
                    v.note || ''
                ])

                await exportToPdfFile({
                    title: `專案工作紀錄報告 — ${project.maintenance_project_name} (${cat.maintenance_category_name})`,
                    filenamePrefix: `專案工作紀錄_${project.maintenance_project_name}_${cat.maintenance_category_name}`,
                    orientation: 'landscape',
                    themeColor: [2, 132, 199],
                    head: orderHead,
                    body: orderBody,
                    secondTable: {
                        title: '廠商施工日誌',
                        head: vendorHead,
                        body: vendorBody
                    }
                })

                toast({ title: 'PDF 匯出成功', description: 'PDF 檔案已下載' })
            }
        } catch (error: any) {
            toast({ title: '匯出失敗', description: error.message, variant: 'destructive' })
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <Navbar />
            <main className="max-w-7xl mx-auto p-4 md:p-6 pb-20">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <FolderKanban className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                            專案管理
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-[16px] mt-1">
                            建立與編修院內改建、遷移等專案，並分類各專案之水電、裝潢等主項目。
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={fetchProjects}
                            disabled={loading}
                            title="重新整理"
                            className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-500' : ''}`} />
                        </Button>
                        <Button
                            onClick={handleOpenAddProject}
                            className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/20 active:scale-95 transition-all duration-200"
                        >
                            <Plus className="w-4 h-4" />
                            新增專案
                        </Button>
                    </div>
                </div>

                {/* 篩選標籤 */}
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 p-4 rounded-2xl shadow-sm mb-6 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-blue-600 dark:text-blue-400">
                            <FolderKanban className="w-4 h-4" />
                        </div>
                        <span className="text-[16px] font-bold text-slate-700 dark:text-slate-300">篩選專案狀態</span>
                    </div>
                    <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-xl border border-slate-200/30 dark:border-slate-700/30">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setFilterStatus('all')}
                            className={`px-4 py-1.5 rounded-lg text-[16px] font-bold h-9 transition-all duration-200 ${filterStatus === 'all' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                        >
                            全部 ({projects.length})
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setFilterStatus('active')}
                            className={`px-4 py-1.5 rounded-lg text-[16px] font-bold h-9 transition-all duration-200 ${filterStatus === 'active' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                        >
                            進行中 ({projects.filter(p => !p.is_closed).length})
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setFilterStatus('closed')}
                            className={`px-4 py-1.5 rounded-lg text-[16px] font-bold h-9 transition-all duration-200 ${filterStatus === 'closed' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                        >
                            已結案 ({projects.filter(p => p.is_closed).length})
                        </Button>
                    </div>
                </div>

                {/* 專案列表 Table */}
                <Card className="border-slate-200/80 dark:border-slate-800/80 shadow-md shadow-slate-100/50 dark:shadow-none rounded-2xl overflow-hidden bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm">
                    <Table>
                        <TableHeader className="bg-slate-100/50 dark:bg-slate-900/50">
                            <TableRow>
                                <TableHead className="w-[50px]"></TableHead>
                                <TableHead className="font-bold">專案名稱</TableHead>
                                <TableHead className="font-bold">描述</TableHead>
                                <TableHead className="font-bold w-[120px]">狀態</TableHead>
                                <TableHead className="font-bold w-[180px]">建立時間</TableHead>
                                <TableHead className="font-bold text-right w-[150px]">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && filteredProjects.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10">
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                                        <span className="text-[16px] text-slate-400 mt-2 block">載入中...</span>
                                    </TableCell>
                                </TableRow>
                            ) : filteredProjects.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10 text-slate-400">
                                        尚無符合條件的專案
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredProjects.map((project, projectIndex) => {
                                    const isExpanded = expandedProjects.has(project.id)
                                    const cats = projectCategories[project.id] || []
                                    const orders = projectOrders[project.id] || []
                                    const isDetailLoading = detailLoading[project.id]
                                    const accent = PROJECT_ACCENT_COLORS[projectIndex % PROJECT_ACCENT_COLORS.length]

                                    return (
                                        <>
                                            <TableRow
                                                key={project.id}
                                                className={`group transition-colors duration-200 ${accent.rowBg} ${accent.hoverRowBg}`}
                                            >
                                                <TableCell className={`p-2 text-center border-l-4 ${accent.border}`}>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => toggleExpand(project.id)}
                                                        className="w-9 h-9 hover:bg-white/60 dark:hover:bg-slate-800 rounded-full"
                                                    >
                                                        <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''} ${accent.text.split(' ')[0]}`} />
                                                    </Button>
                                                </TableCell>
                                                <TableCell className={`font-bold text-[16px] ${accent.text}`}>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${accent.dot} shrink-0`}></div>
                                                        {project.maintenance_project_name}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-slate-500 dark:text-slate-400 max-w-[300px] truncate text-[16px]">
                                                    {project.description || '-'}
                                                </TableCell>
                                                <TableCell>
                                                    {project.is_closed ? (
                                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30 font-semibold">
                                                            已結案
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30 font-semibold">
                                                            進行中
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-slate-400 text-[16px]">
                                                    {format(new Date(project.created_at), 'yyyy/MM/dd HH:mm')}
                                                </TableCell>
                                                <TableCell className="text-right space-x-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleOpenEditProject(project)}
                                                        className="hover:text-primary rounded-lg"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleConfirmDeleteProject(project)}
                                                        className="hover:text-destructive rounded-lg"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>

                                            {/* 展開之細節區塊 */}
                                            {isExpanded && (
                                                <TableRow key={`${project.id}-details`} className={`${accent.banner} ${accent.hoverBanner}`}>
                                                    <TableCell colSpan={6} className={`p-6 border-l-4 ${accent.border}`}>
                                                        {isDetailLoading ? (
                                                            <div className="flex items-center gap-2 justify-center py-4">
                                                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                                                <span className="text-[16px] text-slate-400">載入專案項目與關聯工單中...</span>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-4">
                                                                {/* 主項目與關聯維修單標題與新增按鈕 */}
                                                                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                                                                    <h3 className="text-[16px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                                                        <FolderPlus className="w-4 h-4 text-primary" />
                                                                        專案主項目分類與關聯維修單 (主項目: {cats.length} / 總工單: {orders.length})
                                                                    </h3>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() => handleOpenAddCategory(project.id)}
                                                                        className="h-8 text-[14px] font-semibold gap-1.5 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary transition-all rounded-lg"
                                                                    >
                                                                        <Plus className="w-3.5 h-3.5" />
                                                                        新增主項目
                                                                    </Button>
                                                                </div>

                                                                {cats.length === 0 ? (
                                                                    <div className="text-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-[16px] bg-slate-50/50 dark:bg-slate-900/20">
                                                                        尚未新增任何專案主項目（如水電、隔間裝修等）
                                                                    </div>
                                                                ) : (
                                                                    <div className="space-y-3">
                                                                        {cats.map((cat) => {
                                                                            const catOrders = orders.filter(o => o.maintenance_project_category_id === cat.id)

                                                                            return (
                                                                                <div
                                                                                    key={cat.id}
                                                                                    className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3"
                                                                                >
                                                                                    {/* 專案主項目列 (名稱與歷史圖示之間留約8個文字距離) */}
                                                                                    <div className="flex items-center flex-wrap pb-2 border-b border-slate-100 dark:border-slate-800/80">
                                                                                        <div className="flex items-center gap-2">
                                                                                            <div className="w-1.5 h-4 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full"></div>
                                                                                            <span className="text-[16px] font-bold text-slate-800 dark:text-slate-200">
                                                                                                {cat.maintenance_category_name}
                                                                                            </span>
                                                                                        </div>

                                                                                        {/* 距離專案主項目名稱約8個文字 (gap-8 / ml-8) */}
                                                                                        <div className="flex items-center gap-2 ml-8">
                                                                                            <Button
                                                                                                variant="outline"
                                                                                                size="sm"
                                                                                                onClick={() => setWorkRecordDialog({
                                                                                                    open: true,
                                                                                                    projectId: project.id,
                                                                                                    projectCategoryId: cat.id,
                                                                                                    projectName: project.maintenance_project_name,
                                                                                                    categoryName: cat.maintenance_category_name
                                                                                                })}
                                                                                                className="h-8 px-3 border-blue-600 text-blue-600 hover:bg-blue-50/50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-950/30 gap-1.5 font-bold rounded-lg text-[13px]"
                                                                                            >
                                                                                                <Eye className="w-4 h-4 shrink-0" />
                                                                                                <span>檢視明細</span>
                                                                                            </Button>

                                                                                            <DropdownMenu>
                                                                                                <DropdownMenuTrigger asChild>
                                                                                                    <Button
                                                                                                        variant="outline"
                                                                                                        size="sm"
                                                                                                        className="h-8 px-3 gap-1.5 rounded-lg border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium text-[13px]"
                                                                                                    >
                                                                                                        <Download className="w-4 h-4 shrink-0" />
                                                                                                        <span>匯出</span>
                                                                                                    </Button>
                                                                                                </DropdownMenuTrigger>
                                                                                                <DropdownMenuContent align="end">
                                                                                                    <DropdownMenuItem onClick={() => handleExportCategoryRecords(project, cat, 'excel')}>
                                                                                                        匯出 Excel
                                                                                                    </DropdownMenuItem>
                                                                                                    <DropdownMenuItem onClick={() => handleExportCategoryRecords(project, cat, 'pdf')}>
                                                                                                        匯出 PDF
                                                                                                    </DropdownMenuItem>
                                                                                                </DropdownMenuContent>
                                                                                            </DropdownMenu>

                                                                                            <Button
                                                                                                variant="ghost"
                                                                                                size="icon"
                                                                                                onClick={() => handleOpenEditCategory(project.id, cat)}
                                                                                                className="w-8 h-8 hover:text-primary rounded-lg"
                                                                                            >
                                                                                                <Edit2 className="w-4 h-4" />
                                                                                            </Button>
                                                                                            <Button
                                                                                                variant="ghost"
                                                                                                size="icon"
                                                                                                onClick={() => handleConfirmDeleteCategory(cat)}
                                                                                                className="w-8 h-8 hover:text-destructive rounded-lg"
                                                                                            >
                                                                                                <Trash2 className="w-4 h-4" />
                                                                                            </Button>
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* 屬於該專案主項目的維修單 (顯示在同一列) */}
                                                                                    {catOrders.length === 0 ? (
                                                                                        <div className="text-[14px] text-slate-400 pl-3 py-1">
                                                                                            目前無工務維修單關聯至此主項目
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div className="space-y-2">
                                                                                            {catOrders.map((ord) => (
                                                                                                <div
                                                                                                    key={ord.id}
                                                                                                    onClick={() => router.push(`/maintenance-work/edit/${ord.id}`)}
                                                                                                    className="bg-slate-50/70 dark:bg-slate-800/40 hover:bg-blue-50/50 dark:hover:bg-slate-800/80 p-3 rounded-lg border border-slate-100 dark:border-slate-800/60 cursor-pointer flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] transition-colors group/order"
                                                                                                >
                                                                                                    {/* 欄位順序: 工單編號、接單日期、成本中心、開單人名稱、承辦人名稱、廠商、維修內容、維修狀態 */}
                                                                                                    {/* 1. 工單編號 */}
                                                                                                    <span className="text-[15px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100/60 dark:bg-blue-950/60 px-2 py-0.5 rounded font-mono shrink-0">
                                                                                                        {ord.work_order_id}
                                                                                                    </span>

                                                                                                    <span className="text-slate-300 dark:text-slate-700">|</span>

                                                                                                    {/* 2. 接單日期 */}
                                                                                                    <span className="text-slate-600 dark:text-slate-400 shrink-0">
                                                                                                        接單日期: <span className="font-mono text-slate-800 dark:text-slate-200">{ord.work_order_date || '-'}</span>
                                                                                                    </span>

                                                                                                    <span className="text-slate-300 dark:text-slate-700">|</span>

                                                                                                    {/* 3. 成本中心 */}
                                                                                                    <span className="text-slate-600 dark:text-slate-400 shrink-0">
                                                                                                        成本中心: <span className="text-slate-800 dark:text-slate-200">{ord.cost_center || '-'}</span>
                                                                                                    </span>

                                                                                                    <span className="text-slate-300 dark:text-slate-700">|</span>

                                                                                                    {/* 4. 開單人 */}
                                                                                                    <span className="text-slate-600 dark:text-slate-400 shrink-0">
                                                                                                        開單人: <span className="text-slate-800 dark:text-slate-200">{ord.requester_name || '-'}</span>
                                                                                                    </span>

                                                                                                    <span className="text-slate-300 dark:text-slate-700">|</span>

                                                                                                    {/* 5. 承辦人 */}
                                                                                                    <span className="text-slate-600 dark:text-slate-400 shrink-0">
                                                                                                        承辦人: <span className="text-slate-800 dark:text-slate-200">{ord.handler_name || '-'}</span>
                                                                                                    </span>

                                                                                                    <span className="text-slate-300 dark:text-slate-700">|</span>

                                                                                                    {/* 6. 廠商 */}
                                                                                                    <span className="text-slate-600 dark:text-slate-400 shrink-0">
                                                                                                        廠商: <span className="text-slate-800 dark:text-slate-200">{ord.vendor_name || '-'}</span>
                                                                                                    </span>

                                                                                                    <span className="text-slate-300 dark:text-slate-700">|</span>

                                                                                                    {/* 7. 維修內容 */}
                                                                                                    <span className="text-slate-800 dark:text-slate-200 font-medium truncate max-w-[260px] shrink-0" title={ord.maintain_content}>
                                                                                                        維修內容: {ord.maintain_content || '-'}
                                                                                                    </span>

                                                                                                    {/* 8. 維修狀態 */}
                                                                                                    <Badge variant="outline" className={`text-[12px] px-2 py-0.5 rounded-lg font-semibold border ml-auto shrink-0 ${getStatusColor(ord.status)}`}>
                                                                                                        {ord.status}
                                                                                                    </Badge>
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )
                                                                        })}

                                                                        {/* 未歸類於專案主項目的維修單處理 */}
                                                                        {(() => {
                                                                            const catIds = new Set(cats.map(c => c.id))
                                                                            const uncategorizedOrders = orders.filter(o => !o.maintenance_project_category_id || !catIds.has(o.maintenance_project_category_id))
                                                                            if (uncategorizedOrders.length === 0) return null

                                                                            return (
                                                                                <div className="bg-slate-100/70 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 mt-4">
                                                                                    <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                                                                                        <div className="w-1.5 h-4 bg-amber-500 rounded-full"></div>
                                                                                        <span className="text-[16px] font-bold text-slate-700 dark:text-slate-300">
                                                                                            未指定專案主項目之維修單 ({uncategorizedOrders.length})
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="space-y-2">
                                                                                        {uncategorizedOrders.map((ord) => (
                                                                                            <div
                                                                                                key={ord.id}
                                                                                                onClick={() => router.push(`/maintenance-work/edit/${ord.id}`)}
                                                                                                className="bg-white dark:bg-slate-900 hover:bg-blue-50/50 dark:hover:bg-slate-800/80 p-3 rounded-lg border border-slate-100 dark:border-slate-800/60 cursor-pointer flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] transition-colors"
                                                                                            >
                                                                                                {/* 1. 工單編號 */}
                                                                                                <span className="text-[15px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100/60 dark:bg-blue-950/60 px-2 py-0.5 rounded font-mono shrink-0">
                                                                                                    {ord.work_order_id}
                                                                                                </span>

                                                                                                <span className="text-slate-300 dark:text-slate-700">|</span>

                                                                                                {/* 2. 接單日期 */}
                                                                                                <span className="text-slate-600 dark:text-slate-400 shrink-0">
                                                                                                    接單日期: <span className="font-mono text-slate-800 dark:text-slate-200">{ord.work_order_date || '-'}</span>
                                                                                                </span>

                                                                                                <span className="text-slate-300 dark:text-slate-700">|</span>

                                                                                                {/* 3. 成本中心 */}
                                                                                                <span className="text-slate-600 dark:text-slate-400 shrink-0">
                                                                                                    成本中心: <span className="text-slate-800 dark:text-slate-200">{ord.cost_center || '-'}</span>
                                                                                                </span>

                                                                                                <span className="text-slate-300 dark:text-slate-700">|</span>

                                                                                                {/* 4. 開單人 */}
                                                                                                <span className="text-slate-600 dark:text-slate-400 shrink-0">
                                                                                                    開單人: <span className="text-slate-800 dark:text-slate-200">{ord.requester_name || '-'}</span>
                                                                                                </span>

                                                                                                <span className="text-slate-300 dark:text-slate-700">|</span>

                                                                                                {/* 5. 承辦人 */}
                                                                                                <span className="text-slate-600 dark:text-slate-400 shrink-0">
                                                                                                    承辦人: <span className="text-slate-800 dark:text-slate-200">{ord.handler_name || '-'}</span>
                                                                                                </span>

                                                                                                <span className="text-slate-300 dark:text-slate-700">|</span>

                                                                                                {/* 6. 廠商 */}
                                                                                                <span className="text-slate-600 dark:text-slate-400 shrink-0">
                                                                                                    廠商: <span className="text-slate-800 dark:text-slate-200">{ord.vendor_name || '-'}</span>
                                                                                                </span>

                                                                                                <span className="text-slate-300 dark:text-slate-700">|</span>

                                                                                                {/* 7. 維修內容 */}
                                                                                                <span className="text-slate-800 dark:text-slate-200 font-medium truncate max-w-[260px] shrink-0" title={ord.maintain_content}>
                                                                                                    維修內容: {ord.maintain_content || '-'}
                                                                                                </span>

                                                                                                {/* 8. 維修狀態 */}
                                                                                                <Badge variant="outline" className={`text-[12px] px-2 py-0.5 rounded-lg font-semibold border ml-auto shrink-0 ${getStatusColor(ord.status)}`}>
                                                                                                    {ord.status}
                                                                                                </Badge>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )
                                                                        })()}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </Card>
            </main>

            {/* 專案新增/修改 Dialog */}
            <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{editingProject ? '修改專案' : '新增專案'}</DialogTitle>
                        <DialogDescription>請填寫專案的基本資訊。</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <span className="text-[16px] font-semibold">專案名稱 <span className="text-destructive">*</span></span>
                            <Input
                                placeholder="如: 新建C棟工程"
                                value={projectNameInput}
                                onChange={(e) => setProjectNameInput(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <span className="text-[16px] font-semibold">描述/說明</span>
                            <Textarea
                                placeholder="請輸入專案說明 (非必填)"
                                value={projectDescInput}
                                onChange={(e) => setProjectDescInput(e.target.value)}
                                rows={3}
                            />
                        </div>
                        {editingProject && (
                            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 mt-2">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[16px] font-bold text-slate-700 dark:text-slate-300">專案結案</span>
                                    <span className="text-[16px] text-slate-400">當勾選結案時，此專案將不顯示於可選擇之下拉選單</span>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={projectIsClosedInput}
                                    onChange={(e) => setProjectIsClosedInput(e.target.checked)}
                                    className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                                />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setProjectDialogOpen(false)}>取消</Button>
                        <Button onClick={handleSaveProject}>儲存</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 主項目 Category 新增/修改 Dialog */}
            <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>{editingCategory ? '修改主項目' : '新增主項目'}</DialogTitle>
                        <DialogDescription>為此專案新增工程分類項目。</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <span className="text-[16px] font-semibold">主項目名稱 <span className="text-destructive">*</span></span>
                            <Input
                                placeholder="如: 水電、隔間裝修、弱電"
                                value={categoryNameInput}
                                onChange={(e) => setCategoryNameInput(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>取消</Button>
                        <Button onClick={handleSaveCategory}>儲存</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 刪除專案警示 */}
            <AlertDialog open={deleteProjectAlertOpen} onOpenChange={setDeleteProjectAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="w-5 h-5" />
                            確認刪除專案？
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            此操作將會永久刪除專案：
                            <span className="font-bold text-slate-800 dark:text-slate-100 block my-1">
                                {deletingProject?.maintenance_project_name}
                            </span>
                            刪除後將無法還原，請確認此專案並未關聯任何工單。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeleteProjectAlertOpen(false)}>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive hover:bg-destructive/95 text-white">
                            確認刪除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* 刪除類別警示 */}
            <AlertDialog open={deleteCategoryAlertOpen} onOpenChange={setDeleteCategoryAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="w-5 h-5" />
                            確認刪除主項目？
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            此操作將會永久刪除專案下之項目類別：
                            <span className="font-bold text-slate-800 dark:text-slate-100 block my-1">
                                {deletingCategory?.maintenance_category_name}
                            </span>
                            刪除後將無法還原，請確認無關聯工單。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeleteCategoryAlertOpen(false)}>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteCategory} className="bg-destructive hover:bg-destructive/95 text-white">
                            確認刪除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <ProjectWorkRecordDialog
                open={workRecordDialog.open}
                onOpenChange={(open) => setWorkRecordDialog(prev => ({ ...prev, open }))}
                projectId={workRecordDialog.projectId}
                projectCategoryId={workRecordDialog.projectCategoryId}
                projectName={workRecordDialog.projectName}
                categoryName={workRecordDialog.categoryName}
            />
        </div>
    )
}
