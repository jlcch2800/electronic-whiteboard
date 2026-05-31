// 新增維修單表單 — 步驟 1：已轉維修單
'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { motion } from 'framer-motion'
import { Wrench } from 'lucide-react'

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

    // 表單狀態
    const [isSuccess, setIsSuccess] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [pendingData, setPendingData] = useState<MaintenanceWorkOrderFormValues | null>(null)

    // 追蹤各欄位 touched 狀態（失焦驗證用）
    const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})

    const { register, handleSubmit, trigger, getValues, formState: { errors, isSubmitting } } = useForm<MaintenanceWorkOrderFormValues>({
        resolver: zodResolver(maintenanceWorkOrderSchema) as any,
        mode: 'onBlur',
        defaultValues: {
            request_date: todayStr(),
            work_order_date: todayStr(),
            maint_mgr_date: todayStr(),
            handler_name: '',
            maint_mgr_name: '',
        }
    })

    // 失焦觸發單欄驗證
    const handleFieldBlur = useCallback((fieldName: string) => {
        setTouchedFields(prev => ({ ...prev, [fieldName]: true }))
        trigger(fieldName as any)
    }, [trigger])

    // 進度計算
    const totalSteps = 3
    const getFilledSteps = () => {
        const values = getValues()
        let step = 1
        // 步驟 1：基本資訊已填
        if (values.request_date && values.request_department && values.requester_name) step = 2
        // 步驟 2：工單資訊已填
        if (step >= 2 && values.work_order_id && values.handler_name && values.maintain_content) step = 3
        return Math.min(step, totalSteps)
    }
    const currentStep = getFilledSteps()

    // 點擊提交 → 先檢查工單編號唯一性，再開確認 Dialog
    const onPreSubmit = async (data: MaintenanceWorkOrderFormValues) => {
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
                request_department: pendingData.request_department,
                cost_center: pendingData.cost_center,
                maintain_content: pendingData.maintain_content,
                requester_name: pendingData.requester_name,
                work_order_id: pendingData.work_order_id,
                handler_name: pendingData.handler_name,
                work_order_date: pendingData.work_order_date,
                maint_mgr_name: pendingData.maint_mgr_name,
                maint_mgr_date: pendingData.maint_mgr_date,
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
        <div className="min-h-screen bg-gradient-to-br from-orange-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
            {/* Header + 進度條（不用 sticky，避免行動版被狀態列遮住） */}
            <header className="bg-orange-600 text-white shadow-lg">
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
                                <CardTitle className="text-base flex items-center gap-2 text-orange-700 dark:text-orange-400">
                                    <Wrench className="w-4 h-4" />
                                    基本資訊
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField label="開單日" required error={errors.request_date?.message} touched={touchedFields.request_date}>
                                        <Input type="date" {...register('request_date')} onBlur={() => handleFieldBlur('request_date')} />
                                    </FormField>
                                    <FormField label="開單部門" required error={errors.request_department?.message} touched={touchedFields.request_department}>
                                        <Input {...register('request_department')} placeholder="請輸入開單部門" onBlur={() => handleFieldBlur('request_department')} />
                                    </FormField>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField label="成本中心" required error={errors.cost_center?.message} touched={touchedFields.cost_center}>
                                        <Input {...register('cost_center')} placeholder="請輸入成本中心" onBlur={() => handleFieldBlur('cost_center')} />
                                    </FormField>
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
                                        <Input {...register('work_order_id')} placeholder="請輸入工單編號" onBlur={() => handleFieldBlur('work_order_id')} />
                                    </FormField>
                                    <FormField label="接單日期" required error={errors.work_order_date?.message} touched={touchedFields.work_order_date}>
                                        <Input type="date" {...register('work_order_date')} onBlur={() => handleFieldBlur('work_order_date')} />
                                    </FormField>
                                </div>
                                <FormField label="承辦人" required error={errors.handler_name?.message} touched={touchedFields.handler_name}>
                                    <select
                                        {...register('handler_name')}
                                        onBlur={() => handleFieldBlur('handler_name')}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    >
                                        <option value="">請選擇承辦人</option>
                                        {HANDLER_OPTIONS.map(name => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                    </select>
                                </FormField>
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

                        {/* 區塊 4：主管簽核 */}
                        <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900/50 dark:bg-orange-950/20">
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2 text-orange-700 dark:text-orange-400">
                                    工務單位主管簽核
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField label="工務單位主管" required error={errors.maint_mgr_name?.message} touched={touchedFields.maint_mgr_name}>
                                        <select
                                            {...register('maint_mgr_name')}
                                            onBlur={() => handleFieldBlur('maint_mgr_name')}
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                        >
                                            <option value="">請選擇主管</option>
                                            {MAINT_MGR_OPTIONS.map(name => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                        </select>
                                    </FormField>
                                    <FormField label="工務單位主管日期" required error={errors.maint_mgr_date?.message} touched={touchedFields.maint_mgr_date}>
                                        <Input type="date" {...register('maint_mgr_date')} onBlur={() => handleFieldBlur('maint_mgr_date')} />
                                    </FormField>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 提交按鈕 */}
                        <SubmitButton
                            isSubmitting={isSubmitting}
                            isSuccess={isSuccess}
                            label="提交維修單"
                            className="bg-orange-600 hover:bg-orange-700"
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
        </div>
    )
}
