'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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

export default function PendingEditClient({ initialData }: { initialData: any }) {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()

    // Reusing engineering schema as fields are identical
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<EngineeringWorkFormValues>({
        resolver: zodResolver(engineeringWorkSchema),
        defaultValues: initialData || {}
    })

    const onSubmit = async (data: EngineeringWorkFormValues) => {
        try {
            const { error } = await supabase
                .from('pending_work')
                .update(data)
                .eq('id', initialData.id)

            if (error) throw error

            toast({ title: '修改成功', description: '待處理工作項目已更新' })
            router.push('/')
        } catch (error: any) {
            toast({ title: '修改失敗', description: error.message, variant: 'destructive' })
        }
    }

    if (!initialData) return <div className="p-8 text-center text-slate-500">查無資料</div>

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
            <header className="sticky top-0 z-10 bg-purple-600 text-white px-6 py-4 shadow-lg">
                <div className="flex items-center gap-4 max-w-3xl mx-auto">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-purple-700">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-lg font-bold">待處理工作項目 - 修改</h1>
                </div>
            </header>

            <main className="max-w-3xl mx-auto p-6">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <Card>
                            <CardContent className="pt-6 grid grid-cols-2 gap-4">
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
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle className="text-base">工作資訊</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>時間 <span className="text-red-500">*</span></Label>
                                        <Input type="time" {...register('time')} />
                                        {errors.time && <p className="text-red-500 text-xs">{errors.time.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>單位 <span className="text-red-500">*</span></Label>
                                        <Input {...register('unit')} />
                                        {errors.unit && <p className="text-red-500 text-xs">{errors.unit.message}</p>}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>廠商 <span className="text-red-500">*</span></Label>
                                        <Input {...register('vendor_name')} />
                                        {errors.vendor_name && <p className="text-red-500 text-xs">{errors.vendor_name.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>工務負責人員 <span className="text-red-500">*</span></Label>
                                        <Input {...register('engineering_contact')} />
                                        {errors.engineering_contact && <p className="text-red-500 text-xs">{errors.engineering_contact.message}</p>}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>內容 <span className="text-red-500">*</span></Label>
                                    <Textarea {...register('work_content')} rows={4} />
                                    {errors.work_content && <p className="text-red-500 text-xs">{errors.work_content.message}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label>備註</Label>
                                    <Input {...register('note')} placeholder="選填" />
                                </div>
                            </CardContent>
                        </Card>

                        <Button type="submit" disabled={isSubmitting} className="w-full py-6 text-lg font-bold bg-purple-600 hover:bg-purple-700 shadow-lg">
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <><CheckCircle className="mr-2" /> 儲存修改</>}
                        </Button>
                    </form>
                </motion.div>
            </main>
        </div>
    )
}
