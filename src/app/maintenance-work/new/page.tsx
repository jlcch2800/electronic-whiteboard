// 新增維修單表單 — 步驟 1：已轉維修單
'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { motion } from 'framer-motion'
import { Wrench, FolderKanban, Plus, FolderPlus } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { logChangeRecord } from '@/lib/change-log'
import {
    maintenanceWorkOrderSchema,
    type MaintenanceWorkOrderFormValues,
    HANDLER_OPTIONS,
    MAINT_MGR_OPTIONS,
    MAINTENANCE_FIELD_LABELS,
} from '@/lib/validations/schemas'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { useAppStore } from '@/stores/useAppStore'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

// 共用表單元件
import FormField from '@/components/forms/FormField'
import BackButton from '@/components/forms/BackButton'
import SubmitButton from '@/components/forms/SubmitButton'
import ConfirmDialog from '@/components/forms/ConfirmDialog'

// 今日日期字串（台灣時區）
const todayStr = () => format(new Date(), 'yyyy-MM-dd')

export default function MaintenanceWorkNewPage() {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()
    const { profile } = useAppStore()

    // 表單狀態
    const [isSuccess, setIsSuccess] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [pendingData, setPendingData] = useState<MaintenanceWorkOrderFormValues | null>(null)

    // 專案相關狀態
    const [projects, setProjects] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])
    
    // 快速新增 Dialog 狀態
    const [quickProjectOpen, setQuickProjectOpen] = useState(false)
    const [quickCategoryOpen, setQuickCategoryOpen] = useState(false)
    const [newProjectName, setNewProjectName] = useState('')
    const [newCategoryName, setNewCategoryName] = useState('')

    // 追蹤各欄位 touched 狀態（失焦驗證用）
    const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})

    const [otherSelected, setOtherSelected] = useState<Record<string, boolean>>({})

    const isOtherSelected = (fieldKey: string, currentValue: string, defaultOptions: readonly string[]) => {
        if (otherSelected[fieldKey]) return true
        if (currentValue && !defaultOptions.includes(currentValue)) return true
        return false
    }

    const { register, handleSubmit, trigger, getValues, setValue, watch, formState: { errors, isSubmitting } } = useForm<MaintenanceWorkOrderFormValues>({
        resolver: zodResolver(maintenanceWorkOrderSchema) as any,
        mode: 'onBlur',
        defaultValues: {
            request_date: todayStr(),
            work_order_date: todayStr(),
            maint_mgr_date: todayStr(),
            submit_date: todayStr(),
            handler_name: '',
            maint_mgr_name: '',
            printer_name: '',
            is_maintenance_project: false,
            maintenance_project_id: '',
            maintenance_project_category_id: '',
        }
    })

    // 初始載入未結案專案
    useEffect(() => {
        const loadProjects = async () => {
            const { data } = await supabase
                .from('maintenance_project')
                .select('*')
                .eq('is_closed', false)
                .order('created_at', { ascending: false })
            setProjects(data || [])
        }
        loadProjects()
    }, [supabase])

    // 當選擇專案 ID 改變時，動態讀取類別
    const selectedProjectId = watch('maintenance_project_id')
    useEffect(() => {
        if (selectedProjectId) {
            const loadCategories = async () => {
                const { data } = await supabase
                    .from('maintenance_project_category')
                    .select('*')
                    .eq('maintenance_project_id', selectedProjectId)
                    .order('created_at', { ascending: true })
                setCategories(data || [])
            }
            loadCategories()
        } else {
            setCategories([])
            setValue('maintenance_project_category_id', '')
        }
    }, [selectedProjectId, supabase, setValue])

    // 快速新增專案處理
    const handleQuickAddProject = async () => {
        if (!newProjectName.trim()) return
        try {
            const payload = {
                maintenance_project_name: newProjectName.trim(),
                description: '由工單新增快速建立',
                is_closed: false,
                closed_at: null
            }
            const { data, error } = await supabase
                .from('maintenance_project')
                .insert(payload)
                .select('id, maintenance_project_name')
                .single()

            if (error) throw error

            logChangeRecord({
                actionType: 'Insert',
                modifyTable: 'maintenance_project',
                modifyRecordId: data.id,
                newData: payload
            })

            // 更新下拉選單
            setProjects(prev => [data, ...prev])
            setValue('maintenance_project_id', data.id)
            setValue('is_maintenance_project', true)
            setNewProjectName('')
            setQuickProjectOpen(false)
            toast({ title: '專案建立成功', description: `專案「${data.maintenance_project_name}」已建立並選取` })
        } catch (err: any) {
            toast({
                title: '快速建立專案失敗',
                description: err.message,
                variant: 'destructive'
            })
        }
    }

    // 快速新增主項目處理
    const handleQuickAddCategory = async () => {
        if (!newCategoryName.trim() || !selectedProjectId) return
        try {
            const payload = {
                maintenance_project_id: selectedProjectId,
                maintenance_category_name: newCategoryName.trim()
            }
            const { data, error } = await supabase
                .from('maintenance_project_category')
                .insert(payload)
                .select('id, maintenance_category_name')
                .single()

            if (error) throw error

            logChangeRecord({
                actionType: 'Insert',
                modifyTable: 'maintenance_project_category',
                modifyRecordId: data.id,
                newData: payload
            })

            // 更新類別下拉選單
            setCategories(prev => [...prev, data])
            setValue('maintenance_project_category_id', data.id)
            setNewCategoryName('')
            setQuickCategoryOpen(false)
            toast({ title: '主項目建立成功', description: `主項目「${data.maintenance_category_name}」已建立並選取` })
        } catch (err: any) {
            toast({
                title: '快速建立主項目失敗',
                description: err.message,
                variant: 'destructive'
            })
        }
    }

    // 當 profile 載入且角色是 staff 時，自動將印單人與承辦人預設填入自己
    useEffect(() => {
        if (profile?.role === 'staff' && profile?.user_name) {
            setValue('printer_name', profile.user_name)
            setValue('handler_name', profile.user_name)

            const updates: Record<string, boolean> = {}
            if (!HANDLER_OPTIONS.includes(profile.user_name)) {
                updates.printer_name = true
                updates.handler_name = true
            }
            if (Object.keys(updates).length > 0) {
                setOtherSelected(prev => ({ ...prev, ...updates }))
            }
        }
    }, [profile, setValue])

    // 工單編號自動大小寫轉換（依使用者單位區分）
    const transformWorkOrderId = (value: string): string => {
        if (!value) return value;
        let result = value;
        const unit = profile?.unit || '';

        if (unit === '醫工組') {
            // 醫工組：第六碼小寫 f 自動轉大寫 F
            if (result.length >= 6 && result.charAt(5) === 'f') {
                result = result.slice(0, 5) + 'F' + result.slice(6);
            }
        } else {
            // 工務室（預設）：第一碼 f→F，最後一碼 A→a
            if (result.charAt(0) === 'f') {
                result = 'F' + result.slice(1);
            }
            if (result.length > 0 && result.charAt(result.length - 1) === 'A') {
                result = result.slice(0, -1) + 'a';
            }
        }
        return result;
    };

    // 工單編號輸入時自動轉換大小寫
    const handleWorkOrderIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const transformed = transformWorkOrderId(e.target.value);
        setValue('work_order_id', transformed, { shouldValidate: false });
    };

    // 失焦觸發單欄驗證
    const handleFieldBlur = useCallback((fieldName: string) => {
        setTouchedFields(prev => ({ ...prev, [fieldName]: true }))
        trigger(fieldName as any)

        if (fieldName === 'work_order_id') {
            const val = (getValues('work_order_id') || '').trim();
            if (val) {
                const errs: string[] = [];
                const unit = profile?.unit || '';

                if (/[\uFF00-\uFFEF\u3000\u4E00-\u9FFF]/.test(val)) {
                    errs.push("請勿輸入全型字！");
                }

                if (unit === '醫工組') {
                    // 醫工組驗證規則：10碼、第六碼大寫F、只允許 F/f 和數字 0-9
                    if (val.length !== 10) {
                        errs.push("總字數必須為 10 字元！");
                    }
                    if (val.length >= 6 && val.charAt(5) !== 'F') {
                        errs.push("第六碼需為大寫 F！");
                    }
                    if (!/^[F0-9]+$/.test(val)) {
                        errs.push("只能輸入大寫 F 和數字 0-9！");
                    }
                    // 除第六碼以外，只能輸入數字 0-9
                    for (let i = 0; i < val.length; i++) {
                        if (i === 5) continue; // 跳過第六碼
                        if (!/^[0-9]$/.test(val.charAt(i))) {
                            errs.push("除第六碼以外，只能輸入數字 0-9！");
                            break;
                        }
                    }
                } else {
                    // 工務室驗證規則：12碼、第一碼大寫F、最後一碼小寫a、只允許 F/f/A/a 和數字 0-9
                    if (val.length !== 12) {
                        errs.push("總字數必須為 12 字元！");
                    }
                    if (!val.startsWith('F')) {
                        errs.push("第一個字需為大寫 F！");
                    }
                    if (!val.endsWith('a')) {
                        errs.push("最後一個字需為小寫 a！");
                    }
                    if (!/^[Fa0-9]+$/.test(val)) {
                        errs.push("只能輸入大寫 F、小寫 a 和數字 0-9！");
                    }
                    // 除第一碼和最後一碼以外，只能輸入數字 0-9
                    for (let i = 1; i < val.length - 1; i++) {
                        if (!/^[0-9]$/.test(val.charAt(i))) {
                            errs.push("除第一碼和最後一碼以外，只能輸入數字 0-9！");
                            break;
                        }
                    }
                }

                if (errs.length > 0) {
                    alert(`工單編號不符合規則：\n${errs.map(e => `- ${e}`).join('\n')}`);
                }
            }
        }
    }, [trigger, getValues, profile])

    // 進度計算
    const totalSteps = 3
    const getFilledSteps = () => {
        const values = getValues()
        let step = 1
        // 步驟 1：基本資訊已填
        if (values.request_date && values.requester_name) step = 2
        // 步驟 2：工單資訊已填
        if (step >= 2 && values.work_order_id && values.handler_name && values.printer_name && values.maintain_content) step = 3
        return Math.min(step, totalSteps)
    }
    const currentStep = getFilledSteps()

    // 點擊提交 → 先檢查工單編號唯一性，再開確認 Dialog
    const onPreSubmit = async (data: MaintenanceWorkOrderFormValues) => {
        // 驗證工單編號邏輯，一次顯示所有違反的規則
        const workOrderVal = (data.work_order_id || '').trim();
        if (workOrderVal) {
            const errs: string[] = [];
            const unit = profile?.unit || '';

            if (/[\uFF00-\uFFEF\u3000\u4E00-\u9FFF]/.test(workOrderVal)) {
                errs.push("請勿輸入全型字！");
            }

            if (unit === '醫工組') {
                // 醫工組驗證規則：10碼、第六碼大寫F、只允許 F/f 和數字 0-9
                if (workOrderVal.length !== 10) {
                    errs.push("總字數必須為 10 字元！");
                }
                if (workOrderVal.length >= 6 && workOrderVal.charAt(5) !== 'F') {
                    errs.push("第六碼需為大寫 F！");
                }
                if (!/^[F0-9]+$/.test(workOrderVal)) {
                    errs.push("只能輸入大寫 F 和數字 0-9！");
                }
                // 除第六碼以外，只能輸入數字 0-9
                for (let i = 0; i < workOrderVal.length; i++) {
                    if (i === 5) continue; // 跳過第六碼
                    if (!/^[0-9]$/.test(workOrderVal.charAt(i))) {
                        errs.push("除第六碼以外，只能輸入數字 0-9！");
                        break;
                    }
                }
            } else {
                // 工務室驗證規則：12碼、第一碼大寫F、最後一碼小寫a、只允許 F/f/A/a 和數字 0-9
                if (workOrderVal.length !== 12) {
                    errs.push("總字數必須為 12 字元！");
                }
                if (!workOrderVal.startsWith('F')) {
                    errs.push("第一個字需為大寫 F！");
                }
                if (!workOrderVal.endsWith('a')) {
                    errs.push("最後一個字需為小寫 a！");
                }
                if (!/^[Fa0-9]+$/.test(workOrderVal)) {
                    errs.push("只能輸入大寫 F、小寫 a 和數字 0-9！");
                }
                // 除第一碼和最後一碼以外，只能輸入數字 0-9
                for (let i = 1; i < workOrderVal.length - 1; i++) {
                    if (!/^[0-9]$/.test(workOrderVal.charAt(i))) {
                        errs.push("除第一碼和最後一碼以外，只能輸入數字 0-9！");
                        break;
                    }
                }
            }

            if (errs.length > 0) {
                alert(`工單編號不符合規則：\n${errs.map(e => `- ${e}`).join('\n')}`);
                return;
            }
        }

        // 檢查工單編號是否已存在
        const { data: existing } = await supabase
            .from('maintenance_work_orders')
            .select('id')
            .eq('work_order_id', data.work_order_id)
            .limit(1)

        if (existing && existing.length > 0) {
            toast({
                title: '工單編號重複',
                description: `工單編號 "${data.work_order_id}" 已存在，請使用其他編號。`,
                variant: 'destructive'
            })
            return
        }

        // 同時檢查歷史表
        const { data: existingHistory } = await supabase
            .from('maintenance_work_orders_history')
            .select('id')
            .eq('work_order_id', data.work_order_id)
            .limit(1)

        if (existingHistory && existingHistory.length > 0) {
            toast({
                title: '工單編號重複',
                description: `工單編號 "${data.work_order_id}" 已存在於歷史記錄中，請使用其他編號。`,
                variant: 'destructive'
            })
            return
        }

        setPendingData(data)
        setShowConfirm(true)
    }

    // 確認 Dialog 後實際送出
    const onConfirmSubmit = async () => {
        if (!pendingData) return
        setShowConfirm(false)

        try {
            const payload = {
                status: '已轉維修單' as const,
                request_date: pendingData.request_date,
                cost_center: pendingData.cost_center,
                maintain_content: pendingData.maintain_content,
                requester_name: pendingData.requester_name,
                work_order_id: pendingData.work_order_id,
                handler_name: pendingData.handler_name,
                work_order_date: pendingData.work_order_date,
                maint_mgr_name: pendingData.maint_mgr_name,
                maint_mgr_date: pendingData.maint_mgr_date,
                printer_name: pendingData.printer_name,
                submit_date: pendingData.submit_date,
                is_maintenance_project: pendingData.is_maintenance_project || false,
                maintenance_project_id: pendingData.is_maintenance_project ? (pendingData.maintenance_project_id || null) : null,
                maintenance_project_category_id: pendingData.is_maintenance_project ? (pendingData.maintenance_project_category_id || null) : null,
            }

            const { data: inserted, error } = await supabase
                .from('maintenance_work_orders')
                .insert(payload)
                .select('id')
                .single()

            if (error) throw error

            // 寫入系統異動紀錄
            logChangeRecord({
                actionType: 'Insert',
                modifyTable: 'maintenance_work_orders',
                modifyRecordId: inserted?.id || '',
                newData: payload
            })

            // 成功動畫
            setIsSuccess(true)
            toast({ title: '新增成功', description: '維修單已成功建立，狀態為「已轉維修單」' })

            // 1.5 秒後跳轉
            setTimeout(() => router.push('/maintenance-work/status'), 1500)
        } catch (error: any) {
            toast({ title: '新增失敗', description: error.message, variant: 'destructive' })
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#fff1ed] to-slate-100 dark:from-slate-900 dark:to-slate-950">
            {/* Header + 進度條（不用 sticky，避免行動版被狀態列遮住） */}
            <header className="bg-[#ffb09c] text-white shadow-lg">
                <div className="max-w-3xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-4">
                        <BackButton />
                        <div className="flex-1">
                            <h1 className="text-lg font-bold">新增維修單</h1>
                            <p className="text-sm opacity-80 mt-0.5">
                                步驟 {currentStep} / {totalSteps}
                            </p>
                        </div>
                    </div>
                    {/* 進度條 */}
                    <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-white rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${(currentStep / totalSteps) * 100}%` }}
                            transition={{ duration: 0.4, ease: 'easeOut' }}
                        />
                    </div>
                </div>
            </header>
 
            {/* 表單 */}
            <main className="max-w-3xl mx-auto p-6 pb-16">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <form onSubmit={handleSubmit(onPreSubmit)} className="space-y-6">
 
                        {/* 區塊 1：基本資訊 */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2 text-[#d8725b] dark:text-[#ffbdae]">
                                    <Wrench className="w-4 h-4" />
                                    基本資訊
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField label="開單日" required error={errors.request_date?.message} touched={touchedFields.request_date}>
                                        <Input type="date" {...register('request_date')} onBlur={() => handleFieldBlur('request_date')} />
                                    </FormField>
                                    <FormField label="成本中心" required error={errors.cost_center?.message} touched={touchedFields.cost_center}>
                                        <Input {...register('cost_center')} placeholder="請輸入成本中心" onBlur={() => handleFieldBlur('cost_center')} />
                                    </FormField>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField label="開單人" required error={errors.requester_name?.message} touched={touchedFields.requester_name}>
                                        <Input {...register('requester_name')} placeholder="請輸入開單人姓名" onBlur={() => handleFieldBlur('requester_name')} />
                                    </FormField>
                                </div>
                            </CardContent>
                        </Card>
 
                        {/* 區塊 2：工單資訊 */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">工單資訊</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField label="工單編號" required error={errors.work_order_id?.message} touched={touchedFields.work_order_id} tooltip="工單編號不得重複">
                                        <Input {...register('work_order_id', { onChange: handleWorkOrderIdChange })} placeholder="請輸入工單編號" onBlur={() => handleFieldBlur('work_order_id')} />
                                    </FormField>
                                    <FormField label="接單日期" required error={errors.work_order_date?.message} touched={touchedFields.work_order_date}>
                                        <Input type="date" {...register('work_order_date')} onBlur={() => handleFieldBlur('work_order_date')} />
                                    </FormField>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField label="印單人" required error={errors.printer_name?.message} touched={touchedFields.printer_name}>
                                        <select
                                            value={isOtherSelected('printer_name', watch('printer_name'), HANDLER_OPTIONS) ? '其他' : watch('printer_name')}
                                            onChange={(e) => {
                                                const val = e.target.value
                                                if (val === '其他') {
                                                    setOtherSelected(prev => ({ ...prev, printer_name: true }))
                                                    setValue('printer_name', '')
                                                } else {
                                                    setOtherSelected(prev => ({ ...prev, printer_name: false }))
                                                    setValue('printer_name', val)
                                                }
                                                trigger('printer_name')
                                            }}
                                            onBlur={() => handleFieldBlur('printer_name')}
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                        >
                                            <option value="" disabled hidden>請選擇印單人</option>
                                            {HANDLER_OPTIONS.map(name => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                            <option value="其他">其他</option>
                                        </select>
                                        {isOtherSelected('printer_name', watch('printer_name'), HANDLER_OPTIONS) && (
                                            <Input
                                                placeholder="請輸入印單人姓名"
                                                value={watch('printer_name')}
                                                onChange={(e) => {
                                                    setValue('printer_name', e.target.value)
                                                    trigger('printer_name')
                                                }}
                                                onBlur={() => handleFieldBlur('printer_name')}
                                                className="mt-2"
                                            />
                                        )}
                                    </FormField>
                                    <FormField label="承辦人" required error={errors.handler_name?.message} touched={touchedFields.handler_name}>
                                        <select
                                            value={isOtherSelected('handler_name', watch('handler_name'), HANDLER_OPTIONS) ? '其他' : watch('handler_name')}
                                            onChange={(e) => {
                                                const val = e.target.value
                                                if (val === '其他') {
                                                    setOtherSelected(prev => ({ ...prev, handler_name: true }))
                                                    setValue('handler_name', '')
                                                } else {
                                                    setOtherSelected(prev => ({ ...prev, handler_name: false }))
                                                    setValue('handler_name', val)
                                                }
                                                trigger('handler_name')
                                            }}
                                            onBlur={() => handleFieldBlur('handler_name')}
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                        >
                                            <option value="" disabled hidden>請選擇承辦人</option>
                                            {HANDLER_OPTIONS.map(name => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                            <option value="其他">其他</option>
                                        </select>
                                        {isOtherSelected('handler_name', watch('handler_name'), HANDLER_OPTIONS) && (
                                            <Input
                                                placeholder="請輸入承辦人姓名"
                                                value={watch('handler_name')}
                                                onChange={(e) => {
                                                    setValue('handler_name', e.target.value)
                                                    trigger('handler_name')
                                                }}
                                                onBlur={() => handleFieldBlur('handler_name')}
                                                className="mt-2"
                                            />
                                        )}
                                    </FormField>
                                </div>
                            </CardContent>
                        </Card>
 
                        {/* 區塊 3：維修內容 */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">維修內容</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <FormField label="維修內容" required error={errors.maintain_content?.message} touched={touchedFields.maintain_content}>
                                    <Textarea
                                        {...register('maintain_content')}
                                        rows={5}
                                        placeholder="請填寫詳細維修內容"
                                        onBlur={() => handleFieldBlur('maintain_content')}
                                    />
                                </FormField>
                            </CardContent>
                        </Card>

                        {/* 專案資訊區塊 (非必填) */}
                        <Card className="border-[#ffe3db] dark:border-[#5c3c33]">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-base flex items-center gap-2 text-[#d8725b] dark:text-[#ffbdae]">
                                    <FolderKanban className="w-4 h-4" />
                                    專案維修單資訊 (選填)
                                </CardTitle>
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="is_maintenance_project"
                                        checked={watch('is_maintenance_project') || false}
                                        onCheckedChange={(checked) => {
                                            setValue('is_maintenance_project', checked === true)
                                            if (checked !== true) {
                                                setValue('maintenance_project_id', '')
                                                setValue('maintenance_project_category_id', '')
                                            }
                                        }}
                                    />
                                    <Label htmlFor="is_maintenance_project" className="text-sm font-semibold cursor-pointer">
                                        此為專案維修單
                                    </Label>
                                </div>
                            </CardHeader>
                            {watch('is_maintenance_project') && (
                                <CardContent className="space-y-4 pt-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField label="所屬專案" required={watch('is_maintenance_project')}>
                                            <div className="flex gap-2">
                                                <select
                                                    value={watch('maintenance_project_id') || ''}
                                                    onChange={(e) => {
                                                        setValue('maintenance_project_id', e.target.value)
                                                        setValue('maintenance_project_category_id', '')
                                                    }}
                                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 flex-1"
                                                >
                                                    <option value="">請選擇專案</option>
                                                    {projects.map(proj => (
                                                        <option key={proj.id} value={proj.id}>
                                                            {proj.maintenance_project_name}
                                                        </option>
                                                    ))}
                                                </select>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => setQuickProjectOpen(true)}
                                                    title="快速建立專案"
                                                    className="border-slate-200 dark:border-slate-800 shrink-0"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </FormField>

                                        <FormField label="專案主項目" required={watch('is_maintenance_project')}>
                                            <div className="flex gap-2">
                                                <select
                                                    value={watch('maintenance_project_category_id') || ''}
                                                    onChange={(e) => setValue('maintenance_project_category_id', e.target.value)}
                                                    disabled={!selectedProjectId}
                                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 flex-1 disabled:opacity-50"
                                                >
                                                    <option value="">請選擇專案主項目</option>
                                                    {categories.map(cat => (
                                                        <option key={cat.id} value={cat.id}>
                                                            {cat.maintenance_category_name}
                                                        </option>
                                                    ))}
                                                </select>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => setQuickCategoryOpen(true)}
                                                    disabled={!selectedProjectId}
                                                    title="快速建立主項目"
                                                    className="border-slate-200 dark:border-slate-800 shrink-0 disabled:opacity-50"
                                                >
                                                    <FolderPlus className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </FormField>
                                    </div>
                                </CardContent>
                            )}
                        </Card>

                        {/* 區塊 4：主管簽核 */}
                        <Card className="border-[#ffe3db] bg-[#fff7f5]/80 dark:border-[#5c3c33] dark:bg-[#2c1d1a]/20">
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2 text-[#d8725b] dark:text-[#ffbdae]">
                                    工務單位主管簽核
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField label="工務單位主管" required error={errors.maint_mgr_name?.message} touched={touchedFields.maint_mgr_name}>
                                        <select
                                            value={isOtherSelected('maint_mgr_name', watch('maint_mgr_name'), MAINT_MGR_OPTIONS) ? '其他' : watch('maint_mgr_name')}
                                            onChange={(e) => {
                                                const val = e.target.value
                                                if (val === '其他') {
                                                    setOtherSelected(prev => ({ ...prev, maint_mgr_name: true }))
                                                    setValue('maint_mgr_name', '')
                                                } else {
                                                    setOtherSelected(prev => ({ ...prev, maint_mgr_name: false }))
                                                    setValue('maint_mgr_name', val)
                                                }
                                                trigger('maint_mgr_name')
                                            }}
                                            onBlur={() => handleFieldBlur('maint_mgr_name')}
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                        >
                                            <option value="">請選擇主管</option>
                                            {MAINT_MGR_OPTIONS.map(name => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                            <option value="其他">其他</option>
                                        </select>
                                        {isOtherSelected('maint_mgr_name', watch('maint_mgr_name'), MAINT_MGR_OPTIONS) && (
                                            <Input
                                                placeholder="請輸入工務單位主管姓名"
                                                value={watch('maint_mgr_name')}
                                                onChange={(e) => {
                                                    setValue('maint_mgr_name', e.target.value)
                                                    trigger('maint_mgr_name')
                                                }}
                                                onBlur={() => handleFieldBlur('maint_mgr_name')}
                                                className="mt-2"
                                            />
                                        )}
                                    </FormField>
                                    <FormField label="工務單位主管日期" required error={errors.maint_mgr_date?.message} touched={touchedFields.maint_mgr_date}>
                                        <Input type="date" {...register('maint_mgr_date')} onBlur={() => handleFieldBlur('maint_mgr_date')} />
                                    </FormField>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField label="送呈日期" required error={errors.submit_date?.message} touched={touchedFields.submit_date}>
                                        <Input type="date" {...register('submit_date')} onBlur={() => handleFieldBlur('submit_date')} />
                                    </FormField>
                                </div>
                            </CardContent>
                        </Card>
 
                        {/* 提交按鈕 */}
                        <SubmitButton
                            isSubmitting={isSubmitting}
                            isSuccess={isSuccess}
                            label="提交維修單"
                            className="bg-[#ffb09c] hover:bg-[#ff9d84]"
                        />
                    </form>
                </motion.div>
            </main>
 
            {/* 確認對話框 */}
            <ConfirmDialog
                open={showConfirm}
                onConfirm={onConfirmSubmit}
                onCancel={() => setShowConfirm(false)}
                title="確認提交維修單"
                data={pendingData || {}}
                fieldLabels={MAINTENANCE_FIELD_LABELS}
            />

            {/* 快速新增專案 Dialog */}
            <Dialog open={quickProjectOpen} onOpenChange={setQuickProjectOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>快速新增專案</DialogTitle>
                        <DialogDescription>建立新專案以歸類此張維修單。</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-3">
                        <div className="grid gap-1.5">
                            <Label htmlFor="projectName" className="font-semibold text-sm">專案名稱</Label>
                            <Input
                                id="projectName"
                                placeholder="例如: 新建C棟工程"
                                value={newProjectName}
                                onChange={(e) => setNewProjectName(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setQuickProjectOpen(false)}>取消</Button>
                        <Button onClick={handleQuickAddProject} className="bg-primary text-white">建立</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 快速新增主項目 Dialog */}
            <Dialog open={quickCategoryOpen} onOpenChange={setQuickCategoryOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>快速新增主項目</DialogTitle>
                        <DialogDescription>在此專案下新增主項目（例如: 水電、隔間裝修）。</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-3">
                        <div className="grid gap-1.5">
                            <Label htmlFor="categoryName" className="font-semibold text-sm">項目名稱</Label>
                            <Input
                                id="categoryName"
                                placeholder="例如: 水電、隔間裝修"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setQuickCategoryOpen(false)}>取消</Button>
                        <Button onClick={handleQuickAddCategory} className="bg-primary text-white">建立</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
