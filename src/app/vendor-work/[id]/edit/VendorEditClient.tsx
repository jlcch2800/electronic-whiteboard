'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { MapPin } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { vendorWorkSchema, type VendorWorkFormValues } from '@/lib/validations/schemas'
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
    entry_status: '到院/離院',
    work_date: '日期',
    arrival_time: '到院時間',
    departure_time: '離院時間',
    vendor_name: '廠商名稱',
    vendor_contact: '廠商負責人員',
    vendor_contact_phone: '負責人員電話',
    building: '棟別',
    floor: '樓層',
    location: '施工地點',
    vendor_badge_id: '工作證號',
    head_count: '施工人數',
    work_content: '施工內容',
    note: '備註',
}

export default function VendorEditClient({ initialData }: { initialData: any }) {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()

    const [isSuccess, setIsSuccess] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [pendingData, setPendingData] = useState<VendorWorkFormValues | null>(null)
    const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})

    const { register, handleSubmit, watch, trigger, formState: { errors, isSubmitting } } = useForm<VendorWorkFormValues>({
        resolver: zodResolver(vendorWorkSchema) as any,
        mode: 'onBlur',
        defaultValues: initialData || {}
    })

    const entryStatus = watch('entry_status')

    const handleFieldBlur = useCallback((fieldName: string) => {
        setTouchedFields(prev => ({ ...prev, [fieldName]: true }))
        trigger(fieldName as any)
    }, [trigger])

    const onPreSubmit = (data: VendorWorkFormValues) => {
        setPendingData(data)
        setShowConfirm(true)
    }

    const onConfirmSubmit = async () => {
        if (!pendingData) return
        setShowConfirm(false)
        try {
            const payload: any = { ...pendingData }
            if (pendingData.entry_status === 'arrival') {
                payload.departure_time = null
            } else {
                payload.arrival_time = null
                payload.building = null
                payload.floor = null
                payload.location = null
                payload.vendor_badge_id = null
                payload.head_count = null
                payload.vendor_contact_phone = null
            }

            const { error } = await supabase.from('vendor_today_work').update(payload).eq('id', initialData.id)
            if (error) throw error

            setIsSuccess(true)
            toast({ title: '修改成功', description: '廠商施工項目已更新' })
            setTimeout(() => router.push('/'), 1500)
        } catch (error: any) {
            toast({ title: '修改失敗', description: error.message, variant: 'destructive' })
        }
    }

    if (!initialData) return <div className="p-8 text-center text-muted-foreground">查無資料</div>

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
            <FormHeader title="廠商今日施工項目 - 修改" currentStep={3} totalSteps={3} themeColor="bg-blue-600">
                <BackButton />
            </FormHeader>

            <main className="max-w-3xl mx-auto p-6">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <form onSubmit={handleSubmit(onPreSubmit, (e) => console.log(e))} className="space-y-6">
                        {/* 到院/離院（不可修改） */}
                        <Card>
                            <CardHeader><CardTitle className="text-base">到院或離院 (不可修改)</CardTitle></CardHeader>
                            <CardContent>
                                <div className="flex gap-4 opacity-75 pointer-events-none">
                                    <div className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 ${entryStatus === 'arrival' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-border'}`}>
                                        <span className="font-bold">到院</span>
                                    </div>
                                    <div className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 ${entryStatus === 'departure' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-border'}`}>
                                        <span className="font-bold">離院</span>
                                    </div>
                                </div>
                                <input type="hidden" {...register('entry_status')} />
                            </CardContent>
                        </Card>

                        {/* 日期時間 */}
                        <Card>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField label="日期" required error={errors.work_date?.message} touched={touchedFields.work_date}>
                                        <Input type="date" {...register('work_date')} onBlur={() => handleFieldBlur('work_date')} />
                                    </FormField>
                                    <FormField label={entryStatus === 'arrival' ? '到院時間' : '離院時間'} required
                                        error={entryStatus === 'arrival' ? errors.arrival_time?.message : errors.departure_time?.message}
                                        touched={entryStatus === 'arrival' ? touchedFields.arrival_time : touchedFields.departure_time}>
                                        <Input type="time" {...register(entryStatus === 'arrival' ? 'arrival_time' : 'departure_time')}
                                            onBlur={() => handleFieldBlur(entryStatus === 'arrival' ? 'arrival_time' : 'departure_time')} />
                                    </FormField>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 廠商資訊 */}
                        <Card>
                            <CardHeader><CardTitle className="text-base">廠商資訊</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <FormField label="廠商名稱" required error={errors.vendor_name?.message} touched={touchedFields.vendor_name}>
                                    <Input {...register('vendor_name')} onBlur={() => handleFieldBlur('vendor_name')} />
                                </FormField>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField label="廠商負責人員" required error={errors.vendor_contact?.message} touched={touchedFields.vendor_contact}>
                                        <Input {...register('vendor_contact')} onBlur={() => handleFieldBlur('vendor_contact')} />
                                    </FormField>
                                    {entryStatus === 'arrival' && (
                                        <FormField label="負責人員電話" required error={errors.vendor_contact_phone?.message} touched={touchedFields.vendor_contact_phone}>
                                            <Input {...register('vendor_contact_phone')} onBlur={() => handleFieldBlur('vendor_contact_phone')} />
                                        </FormField>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* 施工位置 */}
                        {entryStatus === 'arrival' && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4" /> 施工位置資訊</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <FormField label="棟別" required error={errors.building?.message} touched={touchedFields.building}>
                                            <Input {...register('building')} onBlur={() => handleFieldBlur('building')} />
                                        </FormField>
                                        <FormField label="樓層" required error={errors.floor?.message} touched={touchedFields.floor}>
                                            <Input {...register('floor')} onBlur={() => handleFieldBlur('floor')} />
                                        </FormField>
                                        <FormField label="工作證號" required error={errors.vendor_badge_id?.message} touched={touchedFields.vendor_badge_id}>
                                            <Input type="number" {...register('vendor_badge_id')} onBlur={() => handleFieldBlur('vendor_badge_id')} />
                                        </FormField>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField label="施工地點" required error={errors.location?.message} touched={touchedFields.location}>
                                            <Input {...register('location')} onBlur={() => handleFieldBlur('location')} />
                                        </FormField>
                                        <FormField label="施工人數" required error={errors.head_count?.message} touched={touchedFields.head_count}>
                                            <Input type="number" {...register('head_count')} onBlur={() => handleFieldBlur('head_count')} />
                                        </FormField>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* 施工內容 */}
                        <Card>
                            <CardContent className="pt-6 space-y-4">
                                <FormField label="施工內容" required error={errors.work_content?.message} touched={touchedFields.work_content}>
                                    <Textarea {...register('work_content')} rows={4} onBlur={() => handleFieldBlur('work_content')} />
                                </FormField>
                                {entryStatus === 'arrival' && (
                                    <FormField label="備註" error={errors.note?.message} touched={touchedFields.note}>
                                        <Input {...register('note')} onBlur={() => handleFieldBlur('note')} />
                                    </FormField>
                                )}
                            </CardContent>
                        </Card>

                        <SubmitButton isSubmitting={isSubmitting} isSuccess={isSuccess} label="儲存修改" className="bg-blue-600 hover:bg-blue-700" />
                    </form>
                </motion.div>
            </main>

            <ConfirmDialog
                open={showConfirm}
                onConfirm={onConfirmSubmit}
                onCancel={() => setShowConfirm(false)}
                title="確認儲存修改"
                data={pendingData || {}}
                fieldLabels={FIELD_LABELS}
            />
        </div>
    )
}
