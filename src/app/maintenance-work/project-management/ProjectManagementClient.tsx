'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
    FolderKanban, Plus, Edit2, Trash2, ChevronDown, ChevronRight,
    FolderPlus, Wrench, Loader2, RefreshCw, AlertTriangle, FileText, CheckCircle
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { logChangeRecord } from '@/lib/change-log'
import { useAppStore } from '@/stores/useAppStore'
import Navbar from '@/components/Navbar'
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
}

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
                .select('id, work_order_id, status, requester_name, handler_name, work_order_date')
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

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <Navbar />
            <main className="max-w-7xl mx-auto p-4 md:p-6 pb-20">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <FolderKanban className="w-8 h-8 text-primary" />
                            專案管理
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
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
                            className="bg-white dark:bg-slate-900"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                            onClick={handleOpenAddProject}
                            className="gap-2 bg-primary text-primary-foreground font-semibold"
                        >
                            <Plus className="w-4 h-4" />
                            新增專案
                        </Button>
                    </div>
                </div>

                {/* 篩選標籤 */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm mb-6 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">專案狀態：</span>
                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setFilterStatus('all')}
                                className={`px-3 py-1 rounded-md text-xs font-semibold h-7 ${filterStatus === 'all' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                            >
                                全部 ({projects.length})
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setFilterStatus('active')}
                                className={`px-3 py-1 rounded-md text-xs font-semibold h-7 ${filterStatus === 'active' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                            >
                                進行中 ({projects.filter(p => !p.is_closed).length})
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setFilterStatus('closed')}
                                className={`px-3 py-1 rounded-md text-xs font-semibold h-7 ${filterStatus === 'closed' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                            >
                                已結案 ({projects.filter(p => p.is_closed).length})
                            </Button>
                        </div>
                    </div>
                </div>

                {/* 專案列表 Table */}
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
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
                                        <span className="text-xs text-slate-400 mt-2 block">載入中...</span>
                                    </TableCell>
                                </TableRow>
                            ) : filteredProjects.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10 text-slate-400">
                                        尚無符合條件的專案
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredProjects.map((project) => {
                                    const isExpanded = expandedProjects.has(project.id)
                                    const cats = projectCategories[project.id] || []
                                    const orders = projectOrders[project.id] || []
                                    const isDetailLoading = detailLoading[project.id]

                                    return (
                                        <>
                                            <TableRow
                                                key={project.id}
                                                className={`group hover:bg-slate-50/50 dark:hover:bg-slate-900/30 ${isExpanded ? 'bg-slate-50/50 dark:bg-slate-900/20' : ''}`}
                                            >
                                                <TableCell className="p-0 text-center">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => toggleExpand(project.id)}
                                                        className="w-10 h-10"
                                                    >
                                                        {isExpanded ? (
                                                            <ChevronDown className="w-4 h-4 text-slate-500" />
                                                        ) : (
                                                            <ChevronRight className="w-4 h-4 text-slate-500" />
                                                        )}
                                                    </Button>
                                                </TableCell>
                                                <TableCell className="font-semibold text-slate-800 dark:text-slate-200">
                                                    {project.maintenance_project_name}
                                                </TableCell>
                                                <TableCell className="text-slate-500 dark:text-slate-400 max-w-[300px] truncate">
                                                    {project.description || '-'}
                                                </TableCell>
                                                <TableCell>
                                                    {project.is_closed ? (
                                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400">
                                                            已結案
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400">
                                                            進行中
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-slate-400 text-xs">
                                                    {format(new Date(project.created_at), 'yyyy/MM/dd HH:mm')}
                                                </TableCell>
                                                <TableCell className="text-right space-x-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleOpenEditProject(project)}
                                                        className="hover:text-primary"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleConfirmDeleteProject(project)}
                                                        className="hover:text-destructive"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>

                                            {/* 展開之細節區塊 */}
                                            {isExpanded && (
                                                <TableRow key={`${project.id}-details`} className="bg-slate-50/30 dark:bg-slate-900/10">
                                                    <TableCell colSpan={6} className="p-6">
                                                        {isDetailLoading ? (
                                                            <div className="flex items-center gap-2 justify-center py-4">
                                                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                                                <span className="text-xs text-slate-400">載入專案項目與關聯工單中...</span>
                                                            </div>
                                                        ) : (
                                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                                {/* 左半：主項目類別管理 */}
                                                                <div>
                                                                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
                                                                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                                                            <FolderPlus className="w-4 h-4 text-primary" />
                                                                            專案主項目分類 ({cats.length})
                                                                        </h3>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            onClick={() => handleOpenAddCategory(project.id)}
                                                                            className="h-7 text-xs gap-1 border-slate-200 dark:border-slate-800"
                                                                        >
                                                                            <Plus className="w-3 h-3" />
                                                                            新增主項目
                                                                        </Button>
                                                                    </div>

                                                                    {cats.length === 0 ? (
                                                                        <div className="text-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-slate-400 text-xs">
                                                                            尚未新增任何專案主項目（如水電、隔間裝修等）
                                                                        </div>
                                                                    ) : (
                                                                        <div className="max-h-[250px] overflow-y-auto space-y-1.5 pr-2">
                                                                            {cats.map((cat) => (
                                                                                <div
                                                                                    key={cat.id}
                                                                                    className="flex items-center justify-between bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-slate-200"
                                                                                >
                                                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                                                        {cat.maintenance_category_name}
                                                                                    </span>
                                                                                    <div className="flex items-center gap-1">
                                                                                        <Button
                                                                                            variant="ghost"
                                                                                            size="icon"
                                                                                            onClick={() => handleOpenEditCategory(project.id, cat)}
                                                                                            className="w-7 h-7 hover:text-primary"
                                                                                        >
                                                                                            <Edit2 className="w-3.5 h-3.5" />
                                                                                        </Button>
                                                                                        <Button
                                                                                            variant="ghost"
                                                                                            size="icon"
                                                                                            onClick={() => handleConfirmDeleteCategory(cat)}
                                                                                            className="w-7 h-7 hover:text-destructive"
                                                                                        >
                                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                                        </Button>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* 右半：關聯維修單列表 */}
                                                                <div>
                                                                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
                                                                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                                                            <Wrench className="w-4 h-4 text-primary" />
                                                                            關聯的工務維修單 ({orders.length})
                                                                        </h3>
                                                                    </div>

                                                                    {orders.length === 0 ? (
                                                                        <div className="text-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-slate-400 text-xs">
                                                                            目前無任何維修單關聯至此專案
                                                                        </div>
                                                                    ) : (
                                                                        <div className="max-h-[250px] overflow-y-auto space-y-2 pr-2">
                                                                            {orders.map((ord) => (
                                                                                <div
                                                                                    key={ord.id}
                                                                                    onClick={() => router.push(`/maintenance-work/edit/${ord.id}`)}
                                                                                    className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-primary/50 dark:hover:border-primary/50 cursor-pointer transition-all flex items-center justify-between"
                                                                                >
                                                                                    <div className="flex flex-col gap-0.5">
                                                                                        <span className="text-sm font-bold text-primary font-mono">
                                                                                            {ord.work_order_id}
                                                                                        </span>
                                                                                        <span className="text-xs text-slate-400">
                                                                                            開單人: {ord.requester_name} | 接單日: {ord.work_order_date}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        {ord.handler_name && (
                                                                                            <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-300">
                                                                                                {ord.handler_name}
                                                                                            </span>
                                                                                        )}
                                                                                        <Badge variant="outline" className="text-[10px] scale-90">
                                                                                            {ord.status}
                                                                                        </Badge>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
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
                            <span className="text-sm font-semibold">專案名稱 <span className="text-destructive">*</span></span>
                            <Input
                                placeholder="如: 新建C棟工程"
                                value={projectNameInput}
                                onChange={(e) => setProjectNameInput(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <span className="text-sm font-semibold">描述/說明</span>
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
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">專案結案</span>
                                    <span className="text-xs text-slate-400">當勾選結案時，此專案將不顯示於可選擇之下拉選單</span>
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
                            <span className="text-sm font-semibold">主項目名稱 <span className="text-destructive">*</span></span>
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
        </div>
    )
}
