// Engineering Work Form - New Entry
'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2, CheckCircle } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { engineeringWorkSchema, type EngineeringWorkFormValues } from '@/lib/validations/schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

export default function EngineeringWorkNewPage() {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<EngineeringWorkFormValues>({
        resolver: zodResolver(engineeringWorkSchema),
        defaultValues: {
            start_date: format(new Date(), 'yyyy-MM-dd'),
            end_date: format(new Date(), 'yyyy-MM-dd'),
            time: format(new Date(), 'HH:mm'),
        }
    })

    const onSubmit = async (data: EngineeringWorkFormValues) => {
        try {
            const { error } = await supabase.from('engineering_today_work').insert(data)
            if (error) throw error

            toast({ title: '新增成功', description: '工務今日施工項目已新增' })
            router.push('/')
        } catch (error: any) {
            toast({ title: '新增失敗', description: error.message, variant: 'destructive' })
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 to-slate-100">
            <header className="sticky top-0 z-10 bg-amber-500 text-white px-6 py-4 shadow-lg">
                <div className="flex items-center gap-4 max-w-3xl mx-auto">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-amber-600">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-lg font-bold">工務今日施工項目 - 新增</h1>
                </div>
            </header>

            <main className="max-w-3xl mx-auto p-6">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <Card>
                            <CardHeader><CardTitle className="text-base">施工日期</CardTitle></CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>開始日期 <span className="text-red-500">*</span></Label>
                                        <Input type="date" {...register('start_date')} />
                                        {errors.start_date && <p className="text-red-500 text-xs">{errors.start_date.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>結束日期 <span className="text-red-500">*</span></Label>
                                        <Input type="date" {...register('end_date')} />
                                        {errors.end_date && <p className="text-red-500 text-xs">{errors.end_date.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>時間 <span className="text-red-500">*</span></Label>
                                        <Input type="time" {...register('time')} />
                                        {errors.time && <p className="text-red-500 text-xs">{errors.time.message}</p>}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle className="text-base">負責資訊</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>廠商 <span className="text-red-500">*</span></Label>
                                    <Input {...register('vendor_name')} placeholder="請輸入廠商名稱" />
                                    {errors.vendor_name && <p className="text-red-500 text-xs">{errors.vendor_name.message}</p>}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>單位 <span className="text-red-500">*</span></Label>
                                        <Input {...register('unit')} />
                                        {errors.unit && <p className="text-red-500 text-xs">{errors.unit.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>工務負責人員 <span className="text-red-500">*</span></Label>
                                        <Input {...register('engineering_contact')} />
                                        {errors.engineering_contact && <p className="text-red-500 text-xs">{errors.engineering_contact.message}</p>}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6 space-y-4">
                                <div className="space-y-2">
                                    <Label>內容 <span className="text-red-500">*</span></Label>
                                    <Textarea {...register('work_content')} rows={4} placeholder="請填寫詳細內容" />
                                    {errors.work_content && <p className="text-red-500 text-xs">{errors.work_content.message}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label>備註</Label>
                                    <Input {...register('note')} placeholder="選填" />
                                </div>
                            </CardContent>
                        </Card>

                        <Button type="submit" disabled={isSubmitting} className="w-full py-6 text-lg font-bold bg-amber-500 hover:bg-amber-600 shadow-lg">
                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle className="w-5 h-5 mr-2" />提交資料</>}
                        </Button>
                    </form>
                </motion.div>
            </main>
        </div>
    )
}
