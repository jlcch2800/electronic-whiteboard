'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'

import { createClient } from '@/lib/supabase/client'
import { sendTelegramNotify, formatUpdateMessage, PENDING_WORK_LABELS } from '@/lib/telegram-notify'
import { logChangeRecord } from '@/lib/change-log'
import { engineeringWorkSchema, type EngineeringWorkFormValues } from '@/lib/validations/schemas'
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
    start_date: '開始日期', end_date: '結束日期', time: '時間',
    vendor_name: '廠商', unit: '單位', engineering_contact: '工務負責人員',
    work_content: '內容', note: '備註',
}

export default function PendingEditClient({ initialData }: { initialData: any }) {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()

    const [isSuccess, setIsSuccess] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [pendingData, setPendingData] = useState<EngineeringWorkFormValues | null>(null)
    const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})

    // Reusing engineering schema as fields are identical
    const { register, handleSubmit, trigger, formState: { errors, isSubmitting } } = useForm<EngineeringWorkFormValues>({
        resolver: zodResolver(engineeringWorkSchema),
        mode: 'onBlur',
        defaultValues: initialData || {}
    })

    const handleFieldBlur = useCallback((fieldName: string) => {
        setTouchedFields(prev => ({ ...prev, [fieldName]: true }))
        trigger(fieldName as any)
    }, [trigger])

    const onPreSubmit = (data: EngineeringWorkFormValues) => { setPendingData(data); setShowConfirm(true) }

    const onConfirmSubmit = async () => {
        if (!pendingData) return
        setShowConfirm(false)
        try {
            const { error } = await supabase.from('pending_work').update(pendingData).eq('id', initialData.id)
            if (error) throw error

            // 發送 Telegram 通知（修改前後對照）
            sendTelegramNotify(formatUpdateMessage('待處理工作項目', initialData, pendingData, PENDING_WORK_LABELS))

            // 寫入系統異動紀錄
            logChangeRecord({ actionType: 'Update', modifyTable: 'pending_work', modifyRecordId: initialData.id, oldData: initialData, newData: pendingData })

            setIsSuccess(true)
            toast({ title: '修改成功', description: '待處理工作項目已更新' })
            setTimeout(() => router.push('/'), 1500)
        } catch (error: any) {
            toast({ title: '修改失敗', description: error.message, variant: 'destructive' })
        }
    }

    if (!initialData) return <div className="p-8 text-center text-muted-foreground">查無資料</div>

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
            <FormHeader title="待處理工作項目 - 修改" currentStep={3} totalSteps={3} themeColor="bg-purple-600">
                <BackButton />
            </FormHeader>

            <main className="max-w-3xl mx-auto p-6">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <form onSubmit={handleSubmit(onPreSubmit)} className="space-y-6">
                        <Card>
                            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField label="開始日期" required error={errors.start_date?.message} touched={touchedFields.start_date}>
                                    <Input type="date" {...register('start_date')} onBlur={() => handleFieldBlur('start_date')} />
                                </FormField>
                                <FormField label="結束日期" required error={errors.end_date?.message} touched={touchedFields.end_date}>
                                    <Input type="date" {...register('end_date')} onBlur={() => handleFieldBlur('end_date')} />
                                </FormField>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle className="text-base">工作資訊</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField label="時間" required error={errors.time?.message} touched={touchedFields.time}>
                                        <Input type="time" {...register('time')} onBlur={() => handleFieldBlur('time')} />
                                    </FormField>
                                    <FormField label="單位" required error={errors.unit?.message} touched={touchedFields.unit}>
                                        <Input {...register('unit')} onBlur={() => handleFieldBlur('unit')} />
                                    </FormField>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField label="廠商" required error={errors.vendor_name?.message} touched={touchedFields.vendor_name}>
                                        <Input {...register('vendor_name')} onBlur={() => handleFieldBlur('vendor_name')} />
                                    </FormField>
                                    <FormField label="工務負責人員" required error={errors.engineering_contact?.message} touched={touchedFields.engineering_contact}>
                                        <Input {...register('engineering_contact')} onBlur={() => handleFieldBlur('engineering_contact')} />
                                    </FormField>
                                </div>
                                <FormField label="內容" required error={errors.work_content?.message} touched={touchedFields.work_content}>
                                    <Textarea {...register('work_content')} rows={4} onBlur={() => handleFieldBlur('work_content')} />
                                </FormField>
                                <FormField label="備註" error={errors.note?.message} touched={touchedFields.note}>
                                    <Input {...register('note')} placeholder="選填" onBlur={() => handleFieldBlur('note')} />
                                </FormField>
                            </CardContent>
                        </Card>

                        <SubmitButton isSubmitting={isSubmitting} isSuccess={isSuccess} label="儲存修改" className="bg-purple-600 hover:bg-purple-700" />
                    </form>
                </motion.div>
            </main>

            <ConfirmDialog open={showConfirm} onConfirm={onConfirmSubmit} onCancel={() => setShowConfirm(false)}
                title="確認儲存修改" data={pendingData || {}} fieldLabels={FIELD_LABELS} />
        </div>
    )
}
