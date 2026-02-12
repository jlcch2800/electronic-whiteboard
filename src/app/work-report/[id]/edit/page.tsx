// Work Report Edit Page - 編輯施工回報
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2, CheckCircle } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { workReportSchema, type WorkReportFormValues } from '@/lib/validations/schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

export default function WorkReportEditPage() {
    const router = useRouter()
    const params = useParams()
    const id = params.id as string
    const supabase = createClient()
    const { toast } = useToast()
    const [loading, setLoading] = useState(true)
    const [originalData, setOriginalData] = useState<any>(null) // Store original data for logging

    const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<WorkReportFormValues>({
        resolver: zodResolver(workReportSchema),
        defaultValues: { work_status: 'incomplete' }
    })

    const workStatus = watch('work_status')

    // 載入現有資料
    useEffect(() => {
        const fetchData = async () => {
            const { data, error } = await supabase.from('work_report').select('*').eq('id', id).single() as { data: any, error: any }
            if (error || !data) {
                toast({ title: '載入失敗', description: error?.message || '找不到此筆資料', variant: 'destructive' })
                router.push('/work-report')
                return
            }
            // Store original for logging
            setOriginalData(data)
            // 填入表單
            reset({
                report_date: data.report_date,
                report_time: data.report_time?.slice(0, 5) || '',
                vendor_name: data.vendor_name,
                work_location: data.work_location,
                engineering_contact: data.engineering_contact,
                work_status: data.work_status,
                work_content: data.work_content,
                note: data.note || '',
            })
            setLoading(false)
        }
        fetchData()
    }, [id])

    const onSubmit = async (data: WorkReportFormValues) => {
        try {
            const { error } = await (supabase.from('work_report') as any).update(data).eq('id', id)
            if (error) throw error

            toast({ title: '更新成功', description: '施工回報已更新' })
            router.push('/work-report')
        } catch (error: any) {
            toast({ title: '更新失敗', description: error.message, variant: 'destructive' })
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-100">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-slate-100">
            <header className="sticky top-0 z-10 bg-indigo-600 text-white px-6 py-4 shadow-lg">
                <div className="flex items-center gap-4 max-w-3xl mx-auto">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-indigo-700">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-lg font-bold">施工回報記錄 - 編輯</h1>
                </div>
            </header>

            <main className="max-w-3xl mx-auto p-6">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <Card>
                            <CardHeader><CardTitle className="text-base">回報時間</CardTitle></CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>日期 <span className="text-red-500">*</span></Label>
                                        <Input type="date" {...register('report_date')} />
                                        {errors.report_date && <p className="text-red-500 text-xs">{errors.report_date.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>時間 <span className="text-red-500">*</span></Label>
                                        <Input type="time" {...register('report_time')} />
                                        {errors.report_time && <p className="text-red-500 text-xs">{errors.report_time.message}</p>}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle className="text-base">施工資訊</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>廠商 <span className="text-red-500">*</span></Label>
                                        <Input {...register('vendor_name')} placeholder="請輸入廠商名稱" />
                                        {errors.vendor_name && <p className="text-red-500 text-xs">{errors.vendor_name.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>工務負責人員 <span className="text-red-500">*</span></Label>
                                        <Input {...register('engineering_contact')} />
                                        {errors.engineering_contact && <p className="text-red-500 text-xs">{errors.engineering_contact.message}</p>}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>施工地點 <span className="text-red-500">*</span></Label>
                                    <Input {...register('work_location')} placeholder="請輸入施工地點" />
                                    {errors.work_location && <p className="text-red-500 text-xs">{errors.work_location.message}</p>}
                                </div>
                            </CardContent>
                        </Card>

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
                                                : 'border-slate-200 hover:border-slate-300'
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                value={status}
                                                {...register('work_status')}
                                                className="sr-only"
                                            />
                                            <span className="font-bold">
                                                {status === 'incomplete' ? '未完成' : status === 'completed' ? '完成' : '異常'}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6 space-y-4">
                                <div className="space-y-2">
                                    <Label>工作內容 <span className="text-red-500">*</span></Label>
                                    <Textarea {...register('work_content')} rows={4} placeholder="請填寫詳細工作內容" />
                                    {errors.work_content && <p className="text-red-500 text-xs">{errors.work_content.message}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label>備註</Label>
                                    <Input {...register('note')} placeholder="選填" />
                                </div>
                            </CardContent>
                        </Card>

                        <Button type="submit" disabled={isSubmitting} className="w-full py-6 text-lg font-bold bg-indigo-600 hover:bg-indigo-700 shadow-lg">
                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle className="w-5 h-5 mr-2" />儲存變更</>}
                        </Button>
                    </form>
                </motion.div>
            </main>
        </div>
    )
}
