// Pending Work Form - New Entry
'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { motion } from 'framer-motion'

import { createClient } from '@/lib/supabase/client'
import { pendingWorkSchema, type PendingWorkFormValues } from '@/lib/validations/schemas'
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
    start_date: '開始日期',
    end_date: '結束日期',
    time: '時間',
    vendor_name: '廠商',
    unit: '單位',
    engineering_contact: '工務負責人員',
    work_content: '內容',
    note: '備註',
}

export default function PendingWorkNewPage() {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()

    const [isSuccess, setIsSuccess] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [pendingData, setPendingData] = useState<PendingWorkFormValues | null>(null)
    const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})

    const { register, handleSubmit, trigger, getValues, formState: { errors, isSubmitting } } = useForm<PendingWorkFormValues>({
        resolver: zodResolver(pendingWorkSchema),
        mode: 'onBlur',
        defaultValues: {
            start_date: format(new Date(), 'yyyy-MM-dd'),
            end_date: format(new Date(), 'yyyy-MM-dd'),
            time: format(new Date(), 'HH:mm'),
        }
    })

    const handleFieldBlur = useCallback((fieldName: string) => {
        setTouchedFields(prev => ({ ...prev, [fieldName]: true }))
        trigger(fieldName as any)
    }, [trigger])

    const totalSteps = 3
    const getFilledSteps = () => {
        const v = getValues()
        let step = 1
        if (v.start_date && v.end_date && v.time) step = 2
        if (step >= 2 && v.vendor_name && v.unit && v.engineering_contact) step = 3
        return Math.min(step, totalSteps)
    }

    const onPreSubmit = (data: PendingWorkFormValues) => {
        setPendingData(data)
        setShowConfirm(true)
    }

    const onConfirmSubmit = async () => {
        if (!pendingData) return
        setShowConfirm(false)
        try {
            const { error } = await supabase.from('pending_work').insert(pendingData)
            if (error) throw error
            setIsSuccess(true)
            toast({ title: '新增成功', description: '待處理工作項目已新增' })
            setTimeout(() => router.push('/'), 1500)
        } catch (error: any) {
            toast({ title: '新增失敗', description: error.message, variant: 'destructive' })
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-slate-100">
            <FormHeader title="待處理工作項目 - 新增" currentStep={getFilledSteps()} totalSteps={totalSteps} themeColor="bg-purple-600">
                <BackButton />
            </FormHeader>

            <main className="max-w-3xl mx-auto p-6">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <form onSubmit={handleSubmit(onPreSubmit)} className="space-y-6">
                        <Card>
                            <CardHeader><CardTitle className="text-base">施工日期</CardTitle></CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-3 gap-4">
                                    <FormField label="開始日期" required error={errors.start_date?.message} touched={touchedFields.start_date}>
                                        <Input type="date" {...register('start_date')} onBlur={() => handleFieldBlur('start_date')} />
                                    </FormField>
                                    <FormField label="結束日期" required error={errors.end_date?.message} touched={touchedFields.end_date}>
                                        <Input type="date" {...register('end_date')} onBlur={() => handleFieldBlur('end_date')} />
                                    </FormField>
                                    <FormField label="時間" required error={errors.time?.message} touched={touchedFields.time}>
                                        <Input type="time" {...register('time')} onBlur={() => handleFieldBlur('time')} />
                                    </FormField>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle className="text-base">負責資訊</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <FormField label="廠商" required error={errors.vendor_name?.message} touched={touchedFields.vendor_name}>
                                    <Input {...register('vendor_name')} placeholder="請輸入廠商名稱" onBlur={() => handleFieldBlur('vendor_name')} />
                                </FormField>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField label="單位" required error={errors.unit?.message} touched={touchedFields.unit}>
                                        <Input {...register('unit')} onBlur={() => handleFieldBlur('unit')} />
                                    </FormField>
                                    <FormField label="工務負責人員" required error={errors.engineering_contact?.message} touched={touchedFields.engineering_contact}>
                                        <Input {...register('engineering_contact')} onBlur={() => handleFieldBlur('engineering_contact')} />
                                    </FormField>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6 space-y-4">
                                <FormField label="內容" required error={errors.work_content?.message} touched={touchedFields.work_content}>
                                    <Textarea {...register('work_content')} rows={4} placeholder="請填寫詳細內容" onBlur={() => handleFieldBlur('work_content')} />
                                </FormField>
                                <FormField label="備註" error={errors.note?.message} touched={touchedFields.note}>
                                    <Input {...register('note')} placeholder="選填" onBlur={() => handleFieldBlur('note')} />
                                </FormField>
                            </CardContent>
                        </Card>

                        <SubmitButton isSubmitting={isSubmitting} isSuccess={isSuccess} label="提交資料" className="bg-purple-600 hover:bg-purple-700" />
                    </form>
                </motion.div>
            </main>

            <ConfirmDialog
                open={showConfirm}
                onConfirm={onConfirmSubmit}
                onCancel={() => setShowConfirm(false)}
                title="確認提交待處理工作項目"
                data={pendingData || {}}
                fieldLabels={FIELD_LABELS}
            />
        </div>
    )
}
