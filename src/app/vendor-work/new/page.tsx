// Vendor Work Form - New Entry
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
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

export default function VendorWorkNewPage() {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()

    const { register, handleSubmit, watch, formState: { errors, isSubmitting }, reset } = useForm<VendorWorkFormValues>({
        resolver: zodResolver(vendorWorkSchema),
        defaultValues: {
            entry_status: 'arrival',
            work_date: format(new Date(), 'yyyy-MM-dd'),
            arrival_time: format(new Date(), 'HH:mm'),
            departure_time: format(new Date(), 'HH:mm'),
            head_count: 1,
        }
    })

    const entryStatus = watch('entry_status')

    const onSubmit = async (data: VendorWorkFormValues) => {
        try {
            const payload: any = { ...data }

            // Clear irrelevant fields based on entry status
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

            const { error } = await supabase.from('vendor_today_work').insert(payload)

            if (error) throw error

            toast({
                title: '新增成功',
                description: '廠商今日施工項目已新增',
            })

            router.push('/')
        } catch (error: any) {
            toast({
                title: '新增失敗',
                description: error.message,
                variant: 'destructive',
            })
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-blue-600 text-white px-6 py-4 shadow-lg">
                <div className="flex items-center gap-4 max-w-3xl mx-auto">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-blue-700">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-lg font-bold">廠商今日施工項目 - 新增</h1>
                </div>
            </header>

            {/* Form */}
            <main className="max-w-3xl mx-auto p-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        {/* Entry Status */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">到院或離院</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex gap-4">
                                    <label className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${entryStatus === 'arrival' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 hover:border-slate-300'}`}>
                                        <input type="radio" value="arrival" {...register('entry_status')} className="sr-only" />
                                        <span className="font-bold">到院 (Arrival)</span>
                                    </label>
                                    <label className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${entryStatus === 'departure' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 hover:border-slate-300'}`}>
                                        <input type="radio" value="departure" {...register('entry_status')} className="sr-only" />
                                        <span className="font-bold">離院 (Departure)</span>
                                    </label>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Date & Time */}
                        <Card>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>日期 <span className="text-red-500">*</span></Label>
                                        <Input type="date" {...register('work_date')} />
                                        {errors.work_date && <p className="text-red-500 text-xs">{errors.work_date.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{entryStatus === 'arrival' ? '到院時間' : '離院時間'} <span className="text-red-500">*</span></Label>
                                        <Input
                                            type="time"
                                            {...register(entryStatus === 'arrival' ? 'arrival_time' : 'departure_time')}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Vendor Info */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">廠商資訊</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>廠商名稱 <span className="text-red-500">*</span></Label>
                                    <Input {...register('vendor_name')} placeholder="請輸入廠商名稱" />
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

                        {/* Location Info - Only for Arrival */}
                        {entryStatus === 'arrival' && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                            >
                                <Card className="border-blue-200 bg-blue-50/50">
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2 text-blue-700">
                                            <MapPin className="w-4 h-4" />
                                            施工位置資訊
                                        </CardTitle>
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
                            </motion.div>
                        )}

                        {/* Work Content */}
                        <Card>
                            <CardContent className="pt-6 space-y-4">
                                <div className="space-y-2">
                                    <Label>施工內容 <span className="text-red-500">*</span></Label>
                                    <Textarea {...register('work_content')} rows={4} placeholder="請填寫詳細施工內容" />
                                    {errors.work_content && <p className="text-red-500 text-xs">{errors.work_content.message}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label>備註</Label>
                                    <Input {...register('note')} placeholder="選填" />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Submit */}
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-6 text-lg font-bold bg-blue-600 hover:bg-blue-700 shadow-lg"
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <CheckCircle className="w-5 h-5 mr-2" />
                                    提交資料
                                </>
                            )}
                        </Button>
                    </form>
                </motion.div>
            </main>
        </div>
    )
}
