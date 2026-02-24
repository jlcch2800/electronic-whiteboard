// Admin User Management Client Component
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { ArrowLeft, UserCog, Plus, Edit, Trash2, Search, RefreshCw, Check, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

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
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [showForm, setShowForm] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [editingUser, setEditingUser] = useState<any | null>(null)
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)

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
        if (!selectedId) return
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
        if (!selectedId) return
        setShowDeleteConfirm(true)
    }

    const handleDeleteConfirm = async () => {
        if (!selectedId) return

        try {
            const res = await fetch(`/api/admin/users?id=${selectedId}`, { method: 'DELETE' })
            const result = await res.json()

            if (!res.ok) throw new Error(result.error)

            toast({ title: '刪除成功' })
            setSelectedId(null)
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
            setSelectedId(null)
            fetchUsers()
        } catch (error: any) {
            toast({ title: '操作失敗', description: error.message, variant: 'destructive' })
        }
    }

    const filteredUsers = users.filter(user => {
        const term = searchTerm.toLowerCase()
        return user.user_name?.toLowerCase().includes(term) ||
            user.email?.toLowerCase().includes(term) ||
            user.unit?.toLowerCase().includes(term)
    })

    const totalPages = Math.ceil(filteredUsers.length / pageSize)
    const paginatedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize)

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10 shadow-sm">
                <div className="flex justify-between items-center max-w-7xl mx-auto">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <UserCog className="w-6 h-6 text-green-600" />
                            帳號管理
                        </h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                            <Button variant="ghost" size="sm" onClick={handleEdit} disabled={!selectedId} className="text-blue-600">
                                <Edit className="w-4 h-4 mr-1" /> 修改
                            </Button>
                            <Button variant="ghost" size="sm" onClick={handleDeleteClick} disabled={!selectedId} className="text-red-600">
                                <Trash2 className="w-4 h-4 mr-1" /> 刪除
                            </Button>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="搜尋..."
                                className="pl-9 w-64"
                            />
                        </div>

                        <Button onClick={handleCreate} className="bg-green-600 hover:bg-green-700">
                            <Plus className="w-4 h-4 mr-1" /> 新增帳號
                        </Button>

                        <Button variant="outline" size="icon" onClick={fetchUsers} disabled={loading}>
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>
            </header>

            {/* Table */}
            <main className="max-w-7xl mx-auto p-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
                >
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50">
                                    <TableHead className="w-12">選取</TableHead>
                                    <TableHead className="text-xs">ID</TableHead>
                                    <TableHead>建立時間</TableHead>
                                    <TableHead>單位</TableHead>
                                    <TableHead>姓名</TableHead>
                                    <TableHead>帳號</TableHead>
                                    <TableHead className="text-xs">密碼雜湊</TableHead>
                                    <TableHead>群組</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead className="text-center">啟用</TableHead>
                                    <TableHead className="text-center">失敗計次</TableHead>
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
                                        <TableCell colSpan={17} className="text-center py-10 text-slate-400">
                                            沒有找到使用者
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedUsers.map((user) => (
                                        <TableRow
                                            key={user.id}
                                            className={`cursor-pointer transition-colors ${selectedId === user.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                                            onClick={() => setSelectedId(selectedId === user.id ? null : user.id)}
                                        >
                                            <TableCell>
                                                <Checkbox checked={selectedId === user.id} />
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-slate-400 max-w-[80px] truncate" title={user.id}>
                                                {user.id?.slice(0, 8)}...
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-slate-500 whitespace-nowrap">
                                                {format(new Date(user.created_at), 'yyyy-MM-dd HH:mm')}
                                            </TableCell>
                                            <TableCell className="font-bold">{user.unit}</TableCell>
                                            <TableCell className="font-bold text-slate-800">{user.user_name}</TableCell>
                                            <TableCell className="font-mono">{user.user_account}</TableCell>
                                            <TableCell className="font-mono text-xs text-slate-400 max-w-[80px] truncate" title={user.password_hash}>
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
                                            <TableCell className="font-mono text-xs text-slate-500 whitespace-nowrap">
                                                {user.last_failed_at ? format(new Date(user.last_failed_at), 'yyyy-MM-dd HH:mm') : '-'}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-slate-500 whitespace-nowrap">
                                                {user.locked_until ? format(new Date(user.locked_until), 'yyyy-MM-dd HH:mm') : '-'}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-slate-400 max-w-[60px] truncate" title={user.reset_token_hash}>
                                                {user.reset_token_hash ? user.reset_token_hash.slice(0, 8) + '...' : '-'}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-slate-500 whitespace-nowrap">
                                                {user.reset_token_expire ? format(new Date(user.reset_token_expire), 'yyyy-MM-dd HH:mm') : '-'}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-slate-400 max-w-[60px] truncate" title={user.verify_token_hash}>
                                                {user.verify_token_hash ? user.verify_token_hash.slice(0, 8) + '...' : '-'}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-slate-500 whitespace-nowrap">
                                                {user.verify_token_expire ? format(new Date(user.verify_token_expire), 'yyyy-MM-dd HH:mm') : '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="p-4 border-t border-slate-100">
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
                            selectedCount={selectedId ? 1 : 0}
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
                                <p className="text-xs text-slate-400">密碼需8字元以上，需包含大寫、小寫、數字及特殊符號</p>
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
                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 mt-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-semibold text-slate-700">帳號狀態</h4>
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
                                        <div className="text-slate-500">失敗計次</div>
                                        <div className="font-mono">{watch('failed_attempts') || 0} 次</div>
                                        <div className="text-slate-500">最後失敗</div>
                                        <div className="font-mono">
                                            {watch('last_failed_at') ? format(new Date(watch('last_failed_at')!), 'yyyy-MM-dd HH:mm:ss') : '-'}
                                        </div>
                                        <div className="text-slate-500">鎖定至</div>
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
                            確定要刪除 <strong>{users.find(u => u.id === selectedId)?.user_name}</strong> 嗎？
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
