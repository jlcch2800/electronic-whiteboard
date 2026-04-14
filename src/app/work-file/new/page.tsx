// Work File New Page - 新增施工文件
'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { Download, UploadCloud, File as FileIcon, X, CheckCircle2, ChevronRight, HardHat } from 'lucide-react'
import { logChangeRecord } from '@/lib/change-log'
import { motion } from 'framer-motion'

import { createClient } from '@/lib/supabase/client'
import { workFileSchema, type WorkFileFormValues } from '@/lib/validations/schemas'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

import FormField from '@/components/forms/FormField'
import FormHeader from '@/components/forms/FormHeader'
import BackButton from '@/components/forms/BackButton'
import SubmitButton from '@/components/forms/SubmitButton'
import ConfirmDialog from '@/components/forms/ConfirmDialog'

const FIELD_LABELS: Record<string, string> = {
    date: '日期',
    uploader_name: '上傳人員',
    vendor_name: '廠商名稱',
    work_item: '施工項目',
    description: '說明',
    note: '備註',
}

export default function WorkFileNewPage() {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()

    // File States
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [selectedImage, setSelectedImage] = useState<File | null>(null)
    const [selectedVideo, setSelectedVideo] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [pendingData, setPendingData] = useState<WorkFileFormValues | null>(null)
    const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})

    const { register, handleSubmit, setValue, trigger, getValues, formState: { errors, isSubmitting } } = useForm<WorkFileFormValues>({
        resolver: zodResolver(workFileSchema),
        mode: 'onBlur',
        defaultValues: {
            date: format(new Date(), 'yyyy-MM-dd'),
            file_url: 'pending...',
            image_url: 'pending...',
            uploader_name: '',
        }
    })

    const handleFieldBlur = useCallback((fieldName: string) => {
        setTouchedFields(prev => ({ ...prev, [fieldName]: true }))
        trigger(fieldName as any)
    }, [trigger])

    // Cloudinary Upload Helper
    const uploadToCloudinary = async (file: File, resourceType: 'auto' | 'image' | 'video' | 'raw' = 'auto') => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!)
        formData.append('cloud_name', process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!)

        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
            { method: 'POST', body: formData }
        )

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.message || 'Upload failed')
        }

        const data = await response.json()
        return data.secure_url
    }

    const totalSteps = 3
    const getFilledSteps = () => {
        const v = getValues()
        let step = 1
        if (v.date && v.uploader_name) step = 2
        if (step >= 2 && (selectedFile || selectedImage)) step = 3
        return Math.min(step, totalSteps)
    }

    const onPreSubmit = (data: WorkFileFormValues) => {
        setPendingData(data)
        setShowConfirm(true)
    }

    const onConfirmSubmit = async () => {
        if (!pendingData) return
        setShowConfirm(false)
        try {
            setUploading(true)

            let fileUrl = ''
            let imageUrl = ''
            let videoUrl = ''

            if (selectedFile) fileUrl = await uploadToCloudinary(selectedFile, 'raw')
            if (selectedImage) imageUrl = await uploadToCloudinary(selectedImage, 'image')
            if (selectedVideo) videoUrl = await uploadToCloudinary(selectedVideo, 'video')

            const payload = {
                ...pendingData,
                file_url: fileUrl,
                image_url: imageUrl,
                video_url: videoUrl || null,
            }

            const { data: inserted, error } = await (supabase.from('work_file') as any).insert(payload).select('id').single()
            if (error) throw error

            // 寫入系統異動紀錄
            logChangeRecord({ actionType: 'Insert', modifyTable: 'work_file', modifyRecordId: inserted?.id || '', newData: payload })

            setIsSuccess(true)
            toast({ title: '新增成功', description: '施工文件已上傳並記錄' })
            setTimeout(() => router.push('/work-file'), 1500)
        } catch (error: any) {
            console.error(error)
            toast({ title: '新增失敗', description: error.message, variant: 'destructive' })
        } finally {
            setUploading(false)
        }
    }

    // 為 ConfirmDialog 準備顯示用資料（加入檔案名稱）
    const displayData = pendingData ? {
        ...pendingData,
        file_url: selectedFile?.name || '未選擇',
        image_url: selectedImage?.name || '未選擇',
        video_url: selectedVideo?.name || '未選擇',
    } : {}

    const displayLabels = {
        ...FIELD_LABELS,
        file_url: '文件檔案',
        image_url: '照片檔案',
        video_url: '影片檔案',
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100">
            <FormHeader title="施工文件 - 新增 (上傳)" currentStep={getFilledSteps()} totalSteps={totalSteps} themeColor="bg-teal-600">
                <BackButton />
            </FormHeader>

            <main className="max-w-3xl mx-auto p-6">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <form onSubmit={handleSubmit(onPreSubmit)} className="space-y-6">
                        {/* 基本資訊 */}
                        <Card>
                            <CardHeader><CardTitle className="text-base">基本資訊</CardTitle></CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField label="日期" required error={errors.date?.message} touched={touchedFields.date}>
                                        <Input type="date" {...register('date')} onBlur={() => handleFieldBlur('date')} />
                                    </FormField>
                                    <FormField label="上傳人員" required error={errors.uploader_name?.message} touched={touchedFields.uploader_name}>
                                        <Input {...register('uploader_name')} placeholder="請輸入上傳人員姓名" onBlur={() => handleFieldBlur('uploader_name')} />
                                    </FormField>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 施工資訊 */}
                        <Card>
                            <CardHeader><CardTitle className="text-base">施工資訊</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField label="廠商名稱" error={errors.vendor_name?.message} touched={touchedFields.vendor_name}>
                                        <Input {...register('vendor_name')} placeholder="選填" onBlur={() => handleFieldBlur('vendor_name')} />
                                    </FormField>
                                    <FormField label="施工項目" error={errors.work_item?.message} touched={touchedFields.work_item}>
                                        <Input {...register('work_item')} placeholder="選填" onBlur={() => handleFieldBlur('work_item')} />
                                    </FormField>
                                </div>
                                <FormField label="說明" error={errors.description?.message} touched={touchedFields.description}>
                                    <Textarea {...register('description')} rows={3} placeholder="選填，說明此文件內容" onBlur={() => handleFieldBlur('description')} />
                                </FormField>
                            </CardContent>
                        </Card>

                        {/* 檔案上傳 */}
                        <Card className="border-teal-200 bg-teal-50/50">
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2 text-teal-700">
                                    <UploadCloud className="w-5 h-5" />
                                    檔案上傳
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <Label className="flex items-center justify-between">
                                        <span>文件 (PDF/DOC) <span className="text-red-500">*</span></span>
                                        {selectedFile && <span className="text-xs text-teal-600 font-bold">{selectedFile.name}</span>}
                                    </Label>
                                    <Input
                                        type="file"
                                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                        className="cursor-pointer file:cursor-pointer file:text-teal-700 file:bg-teal-100/50 file:border-0 file:mr-4 file:py-1 file:px-3 file:rounded-full hover:file:bg-teal-100"
                                    />
                                    <input type="hidden" {...register('file_url')} />
                                    <p className="text-xs text-muted-foreground">支援 PDF, Word, Excel 等文件格式</p>
                                </div>

                                <div className="space-y-2">
                                    <Label className="flex items-center justify-between">
                                        <span>照片 (Image) <span className="text-red-500">*</span></span>
                                        {selectedImage && <span className="text-xs text-blue-600 font-bold">{selectedImage.name}</span>}
                                    </Label>
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => setSelectedImage(e.target.files?.[0] || null)}
                                        className="cursor-pointer file:cursor-pointer file:text-blue-700 file:bg-blue-100/50 file:border-0 file:mr-4 file:py-1 file:px-3 file:rounded-full hover:file:bg-blue-100"
                                    />
                                    <input type="hidden" {...register('image_url')} />
                                </div>

                                <div className="space-y-2">
                                    <Label className="flex items-center justify-between">
                                        <span>影片 (Video) (選填)</span>
                                        {selectedVideo && <span className="text-xs text-purple-600 font-bold">{selectedVideo.name}</span>}
                                    </Label>
                                    <Input
                                        type="file"
                                        accept="video/*"
                                        onChange={(e) => setSelectedVideo(e.target.files?.[0] || null)}
                                        className="cursor-pointer file:cursor-pointer file:text-purple-700 file:bg-purple-100/50 file:border-0 file:mr-4 file:py-1 file:px-3 file:rounded-full hover:file:bg-purple-100"
                                    />
                                    <input type="hidden" {...register('video_url')} />
                                </div>
                            </CardContent>
                        </Card>

                        {/* 備註 */}
                        <Card>
                            <CardContent className="pt-6">
                                <FormField label="備註" error={errors.note?.message} touched={touchedFields.note}>
                                    <Input {...register('note')} placeholder="選填" onBlur={() => handleFieldBlur('note')} />
                                </FormField>
                            </CardContent>
                        </Card>

                        <SubmitButton
                            isSubmitting={isSubmitting || uploading}
                            isSuccess={isSuccess}
                            label="提交文件"
                            className="bg-teal-600 hover:bg-teal-700"
                        />
                    </form>
                </motion.div>
            </main>

            <ConfirmDialog
                open={showConfirm}
                onConfirm={onConfirmSubmit}
                onCancel={() => setShowConfirm(false)}
                title="確認提交施工文件"
                data={displayData}
                fieldLabels={displayLabels}
            />
        </div>
    )
}
