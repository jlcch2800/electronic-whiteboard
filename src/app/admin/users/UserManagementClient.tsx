// Admin User Management Client Component
'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { ArrowLeft, UserCog, Plus, Edit, Trash2, Search, RefreshCw, Check, X, Filter, Download } from 'lucide-react'
import { MobileTableCard } from '@/components/MobileTableCard'
import { EmptyState } from '@/components/EmptyState'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { exportToExcelFile, exportToPdfFile } from '@/lib/export-utils'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"

import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { createClient } from '@/lib/supabase/client'
import { userManagementSchema, type UserManagementFormValues } from '@/lib/validations/schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataTablePagination } from '@/components/DataTablePagination'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { SortableTableHead } from '@/components/ui/sortable-table-head'

interface UserManagementClientProps {
    initialUsers: any[]
}

export default function UserManagementClient({ initialUsers }: UserManagementClientProps) {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()

    const [users, setUsers] = useState(initialUsers)
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [showForm, setShowForm] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [editingUser, setEditingUser] = useState<any | null>(null)
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [isFiltersOpen, setIsFiltersOpen] = useState(false)

    const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<UserManagementFormValues>({
        resolver: zodResolver(userManagementSchema),
        defaultValues: { role: 'staff', is_active: true }
    })

    const fetchUsers = async () => {
        setLoading(true)
        const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false })
        if (data) setUsers(data)
        setLoading(false)
    }

    const handleCreate = () => {
        setEditingUser(null)
        reset({ role: 'staff', is_active: true, password: '', confirmPassword: '' })
        setShowForm(true)
    }

    const handleEdit = () => {
        if (selectedIds.length !== 1) return
        const selectedId = selectedIds[0]
        const user = users.find(u => u.id === selectedId)
        if (!user) return

        setEditingUser(user)
        reset({
            unit: user.unit,
            user_name: user.user_name,
            user_account: user.user_account,
            role: user.role,
            email: user.email,
            is_active: user.is_active,
            password: '', // 修改時密碼為選填
            confirmPassword: '',
            failed_attempts: user.failed_attempts,
            last_failed_at: user.last_failed_at,
            locked_until: user.locked_until,
        })
        setShowForm(true)
    }

    const handleDeleteClick = () => {
        if (selectedIds.length === 0) return
        setShowDeleteConfirm(true)
    }

    const handleDeleteConfirm = async () => {
        if (selectedIds.length === 0) return

        try {
            const res = await fetch(`/api/admin/users?id=${selectedIds.join(',')}`, { method: 'DELETE' })
            const result = await res.json()

            if (!res.ok) throw new Error(result.error)

            toast({ title: '刪除成功' })
            setSelectedIds([])
            setShowDeleteConfirm(false)
            fetchUsers()
        } catch (error: any) {
            toast({ title: '刪除失敗', description: error.message, variant: 'destructive' })
        }
    }

    const onSubmit = async (data: UserManagementFormValues) => {
        try {
            // 新增帳號時密碼為必填
            if (!editingUser && (!data.password || data.password.length === 0)) {
                toast({ title: '驗證失敗', description: '新增帳號時密碼為必填', variant: 'destructive' })
                return
            }

            const payload = {
                id: editingUser?.id,
                unit: data.unit,
                user_name: data.user_name,
                user_account: data.user_account,
                role: data.role,
                email: data.email,
                is_active: data.is_active,
                password: data.password || undefined, // 空白表示不變更密碼
                failed_attempts: data.failed_attempts,
                last_failed_at: data.last_failed_at,
                locked_until: data.locked_until,
            }

            const res = await fetch('/api/admin/users', {
                method: editingUser ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            const result = await res.json()
            if (!res.ok) throw new Error(result.error)

            toast({ title: editingUser ? '更新成功' : '建立帳號成功' })
            setShowForm(false)
            setEditingUser(null)
            setSelectedIds([])
            fetchUsers()
        } catch (error: any) {
            toast({ title: '操作失敗', description: error.message, variant: 'destructive' })
        }
    }

    const exportToExcel = () => {
        const dataToExport = selectedIds.length > 0 ? filteredUsers.filter(u => selectedIds.includes(u.id)) : filteredUsers
        if (dataToExport.length === 0) {
            toast({ title: '無資料可匯出', variant: 'destructive' })
            return
        }

        const sheetData = dataToExport.map((u, i) => ({
            '#': i + 1,
            'ID': u.id,
            '建立時間': format(new Date(u.created_at), 'yyyy-MM-dd HH:mm:ss'),
            '單位': u.unit || '',
            '姓名': u.user_name || '',
            '帳號': u.user_account || '',
            '群組': u.role === 'admin' ? 'Admin' : 'Staff',
            'Email': u.email || '',
            '啟用狀態': u.is_active ? '啟用' : '停用',
            '失敗計次': u.failed_attempts || 0,
            '最後失敗時間': u.last_failed_at ? format(new Date(u.last_failed_at), 'yyyy-MM-dd HH:mm:ss') : '',
            '鎖定至': u.locked_until ? format(new Date(u.locked_until), 'yyyy-MM-dd HH:mm:ss') : ''
        }))

        exportToExcelFile(sheetData, '帳號清單')
        toast({ title: '匯出成功', description: `已匯出 ${dataToExport.length} 筆記錄` })
    }

    const exportToPdf = async () => {
        const dataToExport = selectedIds.length > 0 ? filteredUsers.filter(u => selectedIds.includes(u.id)) : filteredUsers
        if (dataToExport.length === 0) {
            toast({ title: '無資料可匯出', variant: 'destructive' })
            return
        }

        const sheetData = dataToExport.map((u, i) => ({
            '#': i + 1,
            'ID': u.id,
            '建立時間': format(new Date(u.created_at), 'yyyy-MM-dd HH:mm:ss'),
            '單位': u.unit || '',
            '姓名': u.user_name || '',
            '帳號': u.user_account || '',
            '群組': u.role === 'admin' ? 'Admin' : 'Staff',
            'Email': u.email || '',
            '狀態': u.is_active ? '啟用' : '停用',
            '失敗計次': u.failed_attempts || 0,
            '最後失敗時間': u.last_failed_at ? format(new Date(u.last_failed_at), 'yyyy-MM-dd HH:mm:ss') : '',
            '鎖定至': u.locked_until ? format(new Date(u.locked_until), 'yyyy-MM-dd HH:mm:ss') : ''
        }))

        toast({ title: '正在準備匯出 PDF...', description: '正在載入中文字型，請稍候...' })

        try {
            await exportToPdfFile({
                title: '使用者帳號清單',
                sheetData,
                filenamePrefix: '帳號清單',
                orientation: 'landscape',
                themeColor: [75, 85, 99], // 鐵灰色品牌色
                excludeColumns: ['ID', '建立時間']
            })
            toast({ title: 'PDF 匯出成功', description: `已匯出 ${dataToExport.length} 筆記錄` })
        } catch (error: any) {
            toast({ title: 'PDF 匯出失敗', description: error.message, variant: 'destructive' })
        }
    }

    const filteredUsers = users.filter(user => {
        const term = searchTerm.toLowerCase()
        return user.user_name?.toLowerCase().includes(term) ||
            user.email?.toLowerCase().includes(term) ||
            user.unit?.toLowerCase().includes(term) ||
            user.user_account?.toLowerCase().includes(term) ||
            user.role?.toLowerCase().includes(term) ||
            (term === '是' && user.is_active) ||
            (term === '否' && !user.is_active)
    })

    const totalPages = Math.ceil(filteredUsers.length / pageSize)

    // 排序狀態
    const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
    const handleSort = (key: string) => {
        setSort(prev => {
            if (prev?.key === key && prev.direction === 'asc') return { key, direction: 'desc' }
            if (prev?.key === key && prev.direction === 'desc') return null
            return { key, direction: 'asc' }
        })
    }
    const sortedUsers = useMemo(() => {
        if (!sort) return filteredUsers
        return [...filteredUsers].sort((a, b) => {
            const valA = (a as any)[sort.key] ?? ''
            const valB = (b as any)[sort.key] ?? ''
            if (valA < valB) return sort.direction === 'asc' ? -1 : 1
            if (valA > valB) return sort.direction === 'asc' ? 1 : -1
            return 0
        })
    }, [filteredUsers, sort])
    const paginatedUsers = sortedUsers.slice((page - 1) * pageSize, page * pageSize)

    return (
        <div className="min-h-screen bg-muted">
            {/* Header */}
            <header className="bg-background border-b border-border px-4 md:px-6 py-4 sticky top-0 z-50 shadow-sm">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 max-w-7xl mx-auto">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                            <h1 className="text-xl font-black text-foreground flex items-center gap-2">
                                <UserCog className="w-6 h-6 text-green-600" />
                                帳號管理
                            </h1>
                        </div>
                        <Button variant="outline" size="sm" className="md:hidden" onClick={() => setIsFiltersOpen(!isFiltersOpen)}>
                            <Filter className="w-4 h-4 mr-1" />{isFiltersOpen ? '隱藏' : '篩選'}
                        </Button>
                    </div>

                    <div className={`flex-col md:flex-row items-stretch md:items-center gap-3 ${isFiltersOpen ? 'flex' : 'hidden md:flex'}`}>
                        <div className="flex items-center gap-2 bg-muted p-1 rounded-xl">
                            <Button variant="ghost" size="sm" onClick={handleEdit} disabled={selectedIds.length !== 1} className="text-blue-600">
                                <Edit className="w-4 h-4 mr-1" /> 修改
                            </Button>
                            <Button variant="ghost" size="sm" onClick={handleDeleteClick} disabled={selectedIds.length === 0} className="text-red-600">
                                <Trash2 className="w-4 h-4 mr-1" /> 刪除
                            </Button>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="搜尋..."
                                className="pl-9 w-full md:w-64"
                            />
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button className="bg-green-600 hover:bg-green-700 flex-1 md:flex-none text-white">
                                        <Download className="w-4 h-4 mr-1" /> 匯出
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={exportToExcel}>
                                        匯出 Excel (.xlsx)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={exportToPdf}>
                                        匯出 PDF (.pdf)
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700 flex-1 md:flex-none">
                                <Plus className="w-4 h-4 mr-1" /> 新增帳號
                            </Button>
                            <Button variant="outline" size="icon" onClick={fetchUsers} disabled={loading}>
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
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
                                    <TableHead className="w-12">
                                        <Checkbox 
                                            checked={paginatedUsers.length > 0 && paginatedUsers.every(u => selectedIds.includes(u.id))}
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    const pageIds = paginatedUsers.map(u => u.id)
                                                    setSelectedIds(prev => Array.from(new Set([...prev, ...pageIds])))
                                                } else {
                                                    const pageIds = paginatedUsers.map(u => u.id)
                                                    setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)))
                                                }
                                            }}
                                        />
                                    </TableHead>
                                    <TableHead className="w-12">#</TableHead>
                                    <SortableTableHead label="建立時間" sortKey="created_at" currentSort={sort} onSort={handleSort} />
                                    <SortableTableHead label="單位" sortKey="unit" currentSort={sort} onSort={handleSort} />
                                    <SortableTableHead label="姓名" sortKey="user_name" currentSort={sort} onSort={handleSort} />
                                    <SortableTableHead label="帳號" sortKey="account" currentSort={sort} onSort={handleSort} />
                                    <TableHead className="text-xs">密碼雜湊</TableHead>
                                    <SortableTableHead label="群組" sortKey="group_name" currentSort={sort} onSort={handleSort} />
                                    <SortableTableHead label="Email" sortKey="email" currentSort={sort} onSort={handleSort} />
                                    <SortableTableHead label="啟用" sortKey="is_active" currentSort={sort} onSort={handleSort} />
                                    <SortableTableHead label="失敗計次" sortKey="failed_login_attempts" currentSort={sort} onSort={handleSort} />
                                    <TableHead>最後失敗時間</TableHead>
                                    <TableHead>鎖定至</TableHead>
                                    <TableHead className="text-xs">resetTokenHash</TableHead>
                                    <TableHead>resetExpire</TableHead>
                                    <TableHead className="text-xs">verifyTokenHash</TableHead>
                                    <TableHead>verifyExpire</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedUsers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={17} className="p-0">
                                            <EmptyState icon={UserCog} title="沒有找到使用者" description="目前沒有符合條件的使用者，請調整篩選條件或新增帳號。" />
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedUsers.map((user, index) => (
                                        <TableRow
                                            key={user.id}
                                            className={`cursor-pointer transition-colors ${selectedIds.includes(user.id) ? 'bg-blue-50 dark:bg-blue-900/40' : 'hover:bg-muted dark:hover:bg-slate-800/50'}`}
                                            onClick={() => {
                                                const isSelected = selectedIds.includes(user.id)
                                                if (isSelected) {
                                                    setSelectedIds(prev => prev.filter(id => id !== user.id))
                                                } else {
                                                    setSelectedIds(prev => [...prev, user.id])
                                                }
                                            }}
                                        >
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <Checkbox 
                                                    checked={selectedIds.includes(user.id)}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) {
                                                            setSelectedIds(prev => [...prev, user.id])
                                                        } else {
                                                            setSelectedIds(prev => prev.filter(id => id !== user.id))
                                                        }
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell className="font-mono text-muted-foreground">
                                                {(page - 1) * pageSize + index + 1}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                                                {format(new Date(user.created_at), 'yyyy-MM-dd HH:mm')}
                                            </TableCell>
                                            <TableCell className="font-bold">{user.unit}</TableCell>
                                            <TableCell className="font-bold text-foreground">{user.user_name}</TableCell>
                                            <TableCell className="font-mono">{user.user_account}</TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground max-w-[80px] truncate" title={user.password_hash}>
                                                {user.password_hash?.slice(0, 10)}...
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'}>
                                                    {user.role}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs">{user.email}</TableCell>
                                            <TableCell className="text-center">
                                                {user.is_active ? (
                                                    <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
                                                ) : (
                                                    <span className="inline-block w-3 h-3 rounded-full bg-slate-300" />
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center font-mono">
                                                {user.failed_attempts || 0}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                                                {user.last_failed_at ? format(new Date(user.last_failed_at), 'yyyy-MM-dd HH:mm') : '-'}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                                                {user.locked_until ? format(new Date(user.locked_until), 'yyyy-MM-dd HH:mm') : '-'}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground max-w-[60px] truncate" title={user.reset_token_hash}>
                                                {user.reset_token_hash ? user.reset_token_hash.slice(0, 8) + '...' : '-'}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                                                {user.reset_token_expire ? format(new Date(user.reset_token_expire), 'yyyy-MM-dd HH:mm') : '-'}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground max-w-[60px] truncate" title={user.verify_token_hash}>
                                                {user.verify_token_hash ? user.verify_token_hash.slice(0, 8) + '...' : '-'}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                                                {user.verify_token_expire ? format(new Date(user.verify_token_expire), 'yyyy-MM-dd HH:mm') : '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>

                        {/* 手機版卡片列表 */}
                        <div className="md:hidden mt-4 space-y-3 px-2 pb-4">
                            {paginatedUsers.length === 0 ? (
                                <EmptyState icon={UserCog} title="沒有找到使用者" description="目前沒有符合條件的使用者，請調整篩選條件或新增帳號。" />
                            ) : (
                                paginatedUsers.map((user, index) => (
                                    <MobileTableCard
                                        key={user.id}
                                        id={user.id}
                                        title={`#${(page - 1) * pageSize + index + 1} ${user.user_name}`}
                                        subtitle={user.user_account}
                                        status={{
                                            label: user.role === 'admin' ? '管理員' : '員工',
                                            variant: user.role === 'admin' ? 'destructive' : 'secondary',
                                        }}
                                        date={format(new Date(user.created_at), 'yyyy-MM-dd')}
                                        time={format(new Date(user.created_at), 'HH:mm')}
                                        isSelected={selectedIds.includes(user.id)}
                                        onSelect={() => {
                                            if (selectedIds.includes(user.id)) {
                                                setSelectedIds(prev => prev.filter(id => id !== user.id))
                                            } else {
                                                setSelectedIds(prev => [...prev, user.id])
                                            }
                                        }}
                                        details={[
                                            { label: '單位', value: user.unit },
                                            { label: 'Email', value: user.email },
                                            { label: '啟用', value: user.is_active ? '✅ 啟用' : '⛔ 停用' },
                                            { label: '密碼雜湊', value: user.password_hash?.slice(0, 10) + '...' },
                                            { label: '失敗計次', value: String(user.failed_attempts || 0) },
                                            { label: '最後失敗', value: user.last_failed_at ? format(new Date(user.last_failed_at), 'yyyy-MM-dd HH:mm') : '-' },
                                            { label: '鎖定至', value: user.locked_until ? format(new Date(user.locked_until), 'yyyy-MM-dd HH:mm') : '-' },
                                            { label: 'resetToken', value: user.reset_token_hash ? user.reset_token_hash.slice(0, 8) + '...' : '-' },
                                            { label: 'resetExpire', value: user.reset_token_expire ? format(new Date(user.reset_token_expire), 'yyyy-MM-dd HH:mm') : '-' },
                                            { label: 'verifyToken', value: user.verify_token_hash ? user.verify_token_hash.slice(0, 8) + '...' : '-' },
                                            { label: 'verifyExpire', value: user.verify_token_expire ? format(new Date(user.verify_token_expire), 'yyyy-MM-dd HH:mm') : '-' },
                                        ]}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                    <div className="p-4 border-t border-border/50">
                        <DataTablePagination
                            currentPage={page}
                            totalPages={totalPages || 1}
                            totalItems={filteredUsers.length}
                            itemsPerPage={pageSize}
                            onPageChange={setPage}
                            onItemsPerPageChange={(size) => {
                                setPageSize(size)
                                setPage(1)
                            }}
                            selectedCount={selectedIds.length}
                        />
                    </div>
                </motion.div>
            </main>

            {/* Edit/Create Dialog */}
            <Dialog open={showForm} onOpenChange={setShowForm}>
                <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {editingUser ? <Edit className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5 text-green-600" />}
                            {editingUser ? '修改帳號' : '新增帳號'}
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden space-y-4">
                        <div className="flex-1 overflow-y-auto px-1 pr-2 space-y-4">
                            <div className="space-y-2">
                                <Label>單位 <span className="text-red-500">*</span></Label>
                                <Input {...register('unit')} />
                                {errors.unit && <p className="text-red-500 text-xs">{errors.unit.message}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label>姓名 <span className="text-red-500">*</span></Label>
                                <Input {...register('user_name')} />
                                {errors.user_name && <p className="text-red-500 text-xs">{errors.user_name.message}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label>帳號 <span className="text-red-500">*</span></Label>
                                <Input {...register('user_account')} />
                                {errors.user_account && <p className="text-red-500 text-xs">{errors.user_account.message}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label>Email <span className="text-red-500">*</span></Label>
                                <Input type="email" {...register('email')} />
                                {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
                            </div>

                            {/* 密碼欄位：新增時必填，修改時選填 */}
                            <div className="space-y-2">
                                <Label>
                                    {editingUser ? '新密碼（留空不變更）' : '密碼'}
                                    {!editingUser && <span className="text-red-500">*</span>}
                                </Label>
                                <Input type="password" {...register('password')} placeholder={editingUser ? '留空表示不變更密碼' : ''} />
                                {errors.password && <p className="text-red-500 text-xs">{errors.password.message}</p>}
                                <p className="text-xs text-muted-foreground">密碼需8字元以上，需包含大寫、小寫、數字及特殊符號</p>
                            </div>

                            <div className="space-y-2">
                                <Label>確認密碼</Label>
                                <Input type="password" {...register('confirmPassword')} />
                                {errors.confirmPassword && <p className="text-red-500 text-xs">{errors.confirmPassword.message}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label>權限群組</Label>
                                <Select value={watch('role')} onValueChange={(v: any) => setValue('role', v)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="staff">Staff (一般員工)</SelectItem>
                                        <SelectItem value="admin">Admin (管理員)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="is_active"
                                    checked={watch('is_active')}
                                    onCheckedChange={(checked: boolean) => setValue('is_active', checked)}
                                />
                                <Label htmlFor="is_active">啟用此帳號</Label>
                            </div>

                            {/* Lockout Status Section */}
                            {editingUser && (
                                <div className="p-4 bg-muted rounded-lg border border-border mt-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-semibold text-foreground/80">帳號狀態</h4>
                                        {(watch('failed_attempts') || 0) > 0 && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                                                onClick={() => {
                                                    setValue('failed_attempts', 0)
                                                    setValue('last_failed_at', null)
                                                    setValue('locked_until', null)
                                                }}
                                            >
                                                <RefreshCw className="w-3 h-3 mr-1" />
                                                解除鎖定 / 清除計次
                                            </Button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="text-muted-foreground">失敗計次</div>
                                        <div className="font-mono">{watch('failed_attempts') || 0} 次</div>
                                        <div className="text-muted-foreground">最後失敗</div>
                                        <div className="font-mono">
                                            {watch('last_failed_at') ? format(new Date(watch('last_failed_at')!), 'yyyy-MM-dd HH:mm:ss') : '-'}
                                        </div>
                                        <div className="text-muted-foreground">鎖定至</div>
                                        <div className={`font-mono ${watch('locked_until') ? 'text-red-600 font-bold' : ''}`}>
                                            {watch('locked_until') ? format(new Date(watch('locked_until')!), 'yyyy-MM-dd HH:mm:ss') : '-'}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="pt-2 border-t mt-4">
                            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                                取消
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {editingUser ? '儲存變更' : '建立帳號'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* 刪除確認對話框 */}
            <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>確認刪除帳號</AlertDialogTitle>
                        <AlertDialogDescription>
                            {selectedIds.length === 1 ? (
                                <>
                                    確定要刪除 <strong>{users.find(u => u.id === selectedIds[0])?.user_name}</strong> 嗎？
                                </>
                            ) : (
                                <>
                                    確定要刪除選取的 <strong>{selectedIds.length}</strong> 筆帳號嗎？
                                </>
                            )}
                            <br />此操作無法復原。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
                            確認刪除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
