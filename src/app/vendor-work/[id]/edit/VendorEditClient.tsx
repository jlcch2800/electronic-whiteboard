'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2, CheckCircle, MapPin } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { vendorWorkSchema, type VendorWorkFormValues } from '@/lib/validations/schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

export default function VendorEditClient({ initialData }: { initialData: any }) {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()

    const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<VendorWorkFormValues>({
        resolver: zodResolver(vendorWorkSchema),
        defaultValues: initialData || {}
    })

    const entryStatus = watch('entry_status')

    const onSubmit = async (data: VendorWorkFormValues) => {
        try {
            const payload: any = { ...data }

            // Clean up payload based on status
            if (data.entry_status === 'arrival') {
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

            const { error } = await supabase
                .from('vendor_today_work')
                .update(payload)
                .eq('id', initialData.id)

            if (error) throw error

            toast({ title: '修改成功', description: '廠商施工項目已更新' })
            router.push('/')
        } catch (error: any) {
            toast({ title: '修改失敗', description: error.message, variant: 'destructive' })
        }
    }

    if (!initialData) return <div className="p-8 text-center text-slate-500">查無資料</div>

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
            <header className="sticky top-0 z-10 bg-blue-600 text-white px-6 py-4 shadow-lg">
                <div className="flex items-center gap-4 max-w-3xl mx-auto">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-blue-700">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-lg font-bold">廠商今日施工項目 - 修改</h1>
                </div>
            </header>

            <main className="max-w-3xl mx-auto p-6">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <form onSubmit={handleSubmit(onSubmit, (e) => console.log(e))} className="space-y-6">
                        {/* Status Check - Read Only in Edit Mode as per requirement */}
                        <Card>
                            <CardHeader><CardTitle className="text-base">到院或離院 (不可修改)</CardTitle></CardHeader>
                            <CardContent>
                                <div className="flex gap-4 opacity-75 pointer-events-none">
                                    <div className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 ${entryStatus === 'arrival' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200'}`}>
                                        <span className="font-bold">到院</span>
                                    </div>
                                    <div className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 ${entryStatus === 'departure' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200'}`}>
                                        <span className="font-bold">離院</span>
                                    </div>
                                </div>
                                <input type="hidden" {...register('entry_status')} />
                            </CardContent>
                        </Card>

                        {/* Date & Time */}
                        <Card>
                            <CardContent className="pt-6 grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>日期 <span className="text-red-500">*</span></Label>
                                    <Input type="date" {...register('work_date')} />
                                    {errors.work_date && <p className="text-red-500 text-xs">{errors.work_date.message}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label>{entryStatus === 'arrival' ? '到院時間' : '離院時間'} <span className="text-red-500">*</span></Label>
                                    <Input type="time" {...register(entryStatus === 'arrival' ? 'arrival_time' : 'departure_time')} />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Form Fields based on Status */}
                        <Card>
                            <CardHeader><CardTitle className="text-base">廠商資訊</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>廠商名稱 <span className="text-red-500">*</span></Label>
                                    <Input {...register('vendor_name')} />
                                    {errors.vendor_name && <p className="text-red-500 text-xs">{errors.vendor_name.message}</p>}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>廠商負責人員 <span className="text-red-500">*</span></Label>
                                        <Input {...register('vendor_contact')} />
                                        {errors.vendor_contact && <p className="text-red-500 text-xs">{errors.vendor_contact.message}</p>}
                                    </div>
                                    {entryStatus === 'arrival' && (
                                        <div className="space-y-2">
                                            <Label>負責人員電話 <span className="text-red-500">*</span></Label>
                                            <Input {...register('vendor_contact_phone')} />
                                            {errors.vendor_contact_phone && <p className="text-red-500 text-xs">{errors.vendor_contact_phone.message}</p>}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {entryStatus === 'arrival' && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4" /> 施工位置資訊</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <Label>棟別 <span className="text-red-500">*</span></Label>
                                            <Input {...register('building')} />
                                            {errors.building && <p className="text-red-500 text-xs">{errors.building.message}</p>}
                                        </div>
                                        <div className="space-y-2">
                                            <Label>樓層 <span className="text-red-500">*</span></Label>
                                            <Input {...register('floor')} />
                                            {errors.floor && <p className="text-red-500 text-xs">{errors.floor.message}</p>}
                                        </div>
                                        <div className="space-y-2">
                                            <Label>工作證號 <span className="text-red-500">*</span></Label>
                                            <Input type="number" {...register('vendor_badge_id')} />
                                            {errors.vendor_badge_id && <p className="text-red-500 text-xs">{errors.vendor_badge_id.message}</p>}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>施工地點 <span className="text-red-500">*</span></Label>
                                            <Input {...register('location')} />
                                            {errors.location && <p className="text-red-500 text-xs">{errors.location.message}</p>}
                                        </div>
                                        <div className="space-y-2">
                                            <Label>施工人數 <span className="text-red-500">*</span></Label>
                                            <Input type="number" {...register('head_count')} />
                                            {errors.head_count && <p className="text-red-500 text-xs">{errors.head_count.message}</p>}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardContent className="pt-6 space-y-4">
                                <div className="space-y-2">
                                    <Label>施工內容 <span className="text-red-500">*</span></Label>
                                    <Textarea {...register('work_content')} rows={4} />
                                    {errors.work_content && <p className="text-red-500 text-xs">{errors.work_content.message}</p>}
                                </div>
                                {entryStatus === 'arrival' && (
                                    <div className="space-y-2">
                                        <Label>備註</Label>
                                        <Input {...register('note')} />
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Button type="submit" disabled={isSubmitting} className="w-full py-6 text-lg font-bold bg-blue-600 hover:bg-blue-700 shadow-lg">
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <><CheckCircle className="mr-2" /> 儲存修改</>}
                        </Button>
                    </form>
                </motion.div>
            </main>
        </div>
    )
}
