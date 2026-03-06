// Work Report Form - New Entry
'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { motion } from 'framer-motion'

import { createClient } from '@/lib/supabase/client'
import { workReportSchema, type WorkReportFormValues } from '@/lib/validations/schemas'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

import FormField from '@/components/forms/FormField'
import FormHeader from '@/components/forms/FormHeader'
import BackButton from '@/components/forms/BackButton'
import SubmitButton from '@/components/forms/SubmitButton'
import ConfirmDialog from '@/components/forms/ConfirmDialog'

const FIELD_LABELS: Record<string, string> = {
    report_date: '日期',
    report_time: '時間',
    vendor_name: '廠商',
    engineering_contact: '工務負責人員',
    work_location: '施工地點',
    work_status: '施工狀態',
    work_content: '工作內容',
    note: '備註',
}

const STATUS_MAP: Record<string, string> = {
    incomplete: '未完成',
    completed: '完成',
    abnormal: '異常',
}

export default function WorkReportNewPage() {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()

    const [isSuccess, setIsSuccess] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [pendingData, setPendingData] = useState<WorkReportFormValues | null>(null)
    const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})

    const { register, handleSubmit, setValue, watch, trigger, getValues, formState: { errors, isSubmitting } } = useForm<WorkReportFormValues>({
        resolver: zodResolver(workReportSchema),
        mode: 'onBlur',
        defaultValues: {
            report_date: format(new Date(), 'yyyy-MM-dd'),
            report_time: format(new Date(), 'HH:mm'),
            work_status: 'incomplete',
        }
    })

    const workStatus = watch('work_status')

    const handleFieldBlur = useCallback((fieldName: string) => {
        setTouchedFields(prev => ({ ...prev, [fieldName]: true }))
        trigger(fieldName as any)
    }, [trigger])

    const totalSteps = 3
    const getFilledSteps = () => {
        const v = getValues()
        let step = 1
        if (v.report_date && v.report_time) step = 2
        if (step >= 2 && v.vendor_name && v.engineering_contact && v.work_location) step = 3
        return Math.min(step, totalSteps)
    }

    const onPreSubmit = (data: WorkReportFormValues) => {
        // 在 ConfirmDialog 中顯示中文狀態
        setPendingData(data)
        setShowConfirm(true)
    }

    const onConfirmSubmit = async () => {
        if (!pendingData) return
        setShowConfirm(false)
        try {
            const { error } = await (supabase.from('work_report') as any).insert(pendingData)
            if (error) throw error
            setIsSuccess(true)
            toast({ title: '回報成功', description: '施工回報已記錄' })
            setTimeout(() => router.push('/'), 1500)
        } catch (error: any) {
            toast({ title: '回報失敗', description: error.message, variant: 'destructive' })
        }
    }

    // 為 ConfirmDialog 準備顯示用資料（將 status enum 轉中文）
    const displayData = pendingData ? {
        ...pendingData,
        work_status: STATUS_MAP[pendingData.work_status] || pendingData.work_status,
    } : {}

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-slate-100">
            <FormHeader title="施工回報記錄 - 新增" currentStep={getFilledSteps()} totalSteps={totalSteps} themeColor="bg-indigo-600">
                <BackButton />
            </FormHeader>

            <main className="max-w-3xl mx-auto p-6">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <form onSubmit={handleSubmit(onPreSubmit)} className="space-y-6">
                        {/* 回報時間 */}
                        <Card>
                            <CardHeader><CardTitle className="text-base">回報時間</CardTitle></CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField label="日期" required error={errors.report_date?.message} touched={touchedFields.report_date}>
                                        <Input type="date" {...register('report_date')} onBlur={() => handleFieldBlur('report_date')} />
                                    </FormField>
                                    <FormField label="時間" required error={errors.report_time?.message} touched={touchedFields.report_time}>
                                        <Input type="time" {...register('report_time')} onBlur={() => handleFieldBlur('report_time')} />
                                    </FormField>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 施工資訊 */}
                        <Card>
                            <CardHeader><CardTitle className="text-base">施工資訊</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField label="廠商" required error={errors.vendor_name?.message} touched={touchedFields.vendor_name}>
                                        <Input {...register('vendor_name')} placeholder="請輸入廠商名稱" onBlur={() => handleFieldBlur('vendor_name')} />
                                    </FormField>
                                    <FormField label="工務負責人員" required error={errors.engineering_contact?.message} touched={touchedFields.engineering_contact}>
                                        <Input {...register('engineering_contact')} onBlur={() => handleFieldBlur('engineering_contact')} />
                                    </FormField>
                                </div>
                                <FormField label="施工地點" required error={errors.work_location?.message} touched={touchedFields.work_location}>
                                    <Input {...register('work_location')} placeholder="請輸入施工地點" onBlur={() => handleFieldBlur('work_location')} />
                                </FormField>
                            </CardContent>
                        </Card>

                        {/* 施工狀態 */}
                        <Card>
                            <CardHeader><CardTitle className="text-base">施工狀態</CardTitle></CardHeader>
                            <CardContent>
                                <div className="flex gap-4">
                                    {(['incomplete', 'completed', 'abnormal'] as const).map((status) => (
                                        <label
                                            key={status}
                                            className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${workStatus === status
                                                ? status === 'completed' ? 'border-green-500 bg-green-50 text-green-700'
                                                    : status === 'abnormal' ? 'border-red-500 bg-red-50 text-red-700'
                                                        : 'border-orange-500 bg-orange-50 text-orange-700'
                                                : 'border-border hover:border-slate-300'
                                                }`}
                                        >
                                            <input type="radio" value={status} {...register('work_status')} className="sr-only" />
                                            <span className="font-bold">
                                                {STATUS_MAP[status]}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* 內容 */}
                        <Card>
                            <CardContent className="pt-6 space-y-4">
                                <FormField label="工作內容" required error={errors.work_content?.message} touched={touchedFields.work_content}>
                                    <Textarea {...register('work_content')} rows={4} placeholder="請填寫詳細工作內容" onBlur={() => handleFieldBlur('work_content')} />
                                </FormField>
                                <FormField label="備註" error={errors.note?.message} touched={touchedFields.note}>
                                    <Input {...register('note')} placeholder="選填" onBlur={() => handleFieldBlur('note')} />
                                </FormField>
                            </CardContent>
                        </Card>

                        <SubmitButton isSubmitting={isSubmitting} isSuccess={isSuccess} label="提交回報" className="bg-indigo-600 hover:bg-indigo-700" />
                    </form>
                </motion.div>
            </main>

            <ConfirmDialog
                open={showConfirm}
                onConfirm={onConfirmSubmit}
                onCancel={() => setShowConfirm(false)}
                title="確認提交施工回報"
                data={displayData}
                fieldLabels={FIELD_LABELS}
            />
        </div>
    )
}
