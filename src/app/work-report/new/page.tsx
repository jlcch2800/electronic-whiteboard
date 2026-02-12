// Work Report Form - New Entry
'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2, CheckCircle } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { workReportSchema, type WorkReportFormValues } from '@/lib/validations/schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

export default function WorkReportNewPage() {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()

    const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<WorkReportFormValues>({
        resolver: zodResolver(workReportSchema),
        defaultValues: {
            report_date: format(new Date(), 'yyyy-MM-dd'),
            report_time: format(new Date(), 'HH:mm'),
            work_status: 'incomplete',
        }
    })

    const workStatus = watch('work_status')

    const onSubmit = async (data: WorkReportFormValues) => {
        try {
            const { error } = await (supabase.from('work_report') as any).insert(data)
            if (error) throw error

            toast({ title: '回報成功', description: '施工回報已記錄' })
            router.push('/')
        } catch (error: any) {
            toast({ title: '回報失敗', description: error.message, variant: 'destructive' })
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-slate-100">
            <header className="sticky top-0 z-10 bg-indigo-600 text-white px-6 py-4 shadow-lg">
                <div className="flex items-center gap-4 max-w-3xl mx-auto">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-indigo-700">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-lg font-bold">施工回報記錄 - 新增</h1>
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
                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle className="w-5 h-5 mr-2" />提交回報</>}
                        </Button>
                    </form>
                </motion.div>
            </main>
        </div>
    )
}
