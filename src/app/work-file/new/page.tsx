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
    const [selectedFiles, setSelectedFiles] = useState<File[]>([])
    const [selectedImages, setSelectedImages] = useState<File[]>([])
    const [selectedVideos, setSelectedVideos] = useState<File[]>([])
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
            file_url: '',
            image_url: '',
            uploader_name: '',
            folder_name: '',
        }
    })

    const handleFieldBlur = useCallback((fieldName: string) => {
        setTouchedFields(prev => ({ ...prev, [fieldName]: true }))
        trigger(fieldName as any)
    }, [trigger])

    // Cloudinary Upload Helper
    const uploadToCloudinary = async (file: File, resourceType: 'auto' | 'image' | 'video' | 'raw' = 'auto', folderPath?: string) => {
        const formData = new FormData()
        
        // 關鍵：folder 必須在 file 之前加入 FormData
        if (folderPath) {
            const cleanPath = folderPath.replace(/^\/+|\/+$/g, '')
            formData.append('folder', cleanPath)
        }
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
        if (step >= 2 && (selectedFiles.length > 0 || selectedImages.length > 0)) step = 3
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

            // Build folder name
            const sanitizedFolder = pendingData.folder_name?.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, '_') || 'work-file'
            const folderPath = `work-report/${pendingData.date}_${sanitizedFolder}`

            const uploadFiles = async (files: File[], type: 'raw' | 'image' | 'video') => {
                if (!files || files.length === 0) return ''
                const urls = await Promise.all(files.map(f => uploadToCloudinary(f, type, folderPath)))
                return JSON.stringify(urls)
            }

            const fileUrl = await uploadFiles(selectedFiles, 'raw')
            const imageUrl = await uploadFiles(selectedImages, 'image')
            const videoUrl = await uploadFiles(selectedVideos, 'video')

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
        file_url: selectedFiles.length ? `${selectedFiles.length} 份文件` : '未選擇',
        image_url: selectedImages.length ? `${selectedImages.length} 張照片` : '未選擇',
        video_url: selectedVideos.length ? `${selectedVideos.length} 部影片` : '未選擇',
    } : {}

    const displayLabels = {
        ...FIELD_LABELS,
        folder_name: '資料夾名稱',
        file_url: '文件檔案',
        image_url: '照片檔案',
        video_url: '影片檔案',
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 transition-colors duration-500">
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
                        <Card className="border-teal-200 dark:border-teal-800 bg-teal-50/80 dark:bg-teal-900/20 shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2 text-teal-700 dark:text-teal-400">
                                    <UploadCloud className="w-5 h-5" />
                                    檔案上傳
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <FormField label="上傳檔案的資料夾名稱" required error={errors.folder_name?.message} touched={touchedFields.folder_name}>
                                    <Input {...register('folder_name')} placeholder="請輸入資料夾名稱 (不需輸入日期)" onBlur={() => handleFieldBlur('folder_name')} />
                                </FormField>
                                <p className="text-[11px] text-amber-600 dark:text-amber-300 font-bold px-1 -mt-2">
                                    提示：文件與照片請至少擇一上傳，每種最多10個檔案
                                </p>
                                <FormField 
                                    label="文件：(單一檔案大小限制: 10MB)" 
                                    error={errors.file_url?.message} 
                                    touched={touchedFields.file_url}
                                >
                                    <div className="space-y-1.5">
                                        <Input
                                            type="file"
                                            multiple
                                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                                            onChange={(e) => {
                                                const files = Array.from(e.target.files || [])
                                                if (files.length > 10) toast({ title: '超過數量', description: '最多只能上傳10個文件', variant: 'destructive' })
                                                const finalFiles = files.slice(0, 10)
                                                setSelectedFiles(finalFiles)
                                                setValue('file_url', finalFiles.length ? 'selected' : '', { shouldValidate: true })
                                                setTouchedFields(prev => ({ ...prev, file_url: true }))
                                            }}
                                            className="cursor-pointer file:cursor-pointer file:text-teal-700 dark:file:text-teal-300 file:bg-teal-100/50 dark:file:bg-teal-800/50 file:border-0 file:mr-4 file:py-1 file:px-3 file:rounded-full hover:file:bg-teal-100"
                                        />
                                        {selectedFiles.length > 0 && (
                                            <ul className="mt-2 space-y-1">
                                                {selectedFiles.map((f, i) => (
                                                    <li key={i} className="text-[11px] text-teal-700 dark:text-teal-300 font-bold px-2 py-1 bg-teal-100/50 dark:bg-teal-900/50 rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-left-2">
                                                        <span className="flex items-center gap-1.5 truncate pr-2"><CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{f.name}</span></span>
                                                        <button type="button" onClick={() => {
                                                            const nf = selectedFiles.filter((_, idx) => idx !== i)
                                                            setSelectedFiles(nf)
                                                            setValue('file_url', nf.length ? 'selected' : '', { shouldValidate: true })
                                                        }} className="p-0.5 hover:bg-teal-200/50 rounded-md transition-colors"><X className="w-3.5 h-3.5" /></button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </FormField>

                                <FormField 
                                    label="照片：(單一照片大小限制: 10MB)" 
                                    error={errors.image_url?.message} 
                                    touched={touchedFields.image_url}
                                >
                                    <div className="space-y-1.5">
                                        <Input
                                            type="file"
                                            multiple
                                            accept="image/*"
                                            onChange={(e) => {
                                                const files = Array.from(e.target.files || [])
                                                if (files.length > 10) toast({ title: '超過數量', description: '最多只能上傳10張照片', variant: 'destructive' })
                                                const finalFiles = files.slice(0, 10)
                                                setSelectedImages(finalFiles)
                                                setValue('image_url', finalFiles.length ? 'selected' : '', { shouldValidate: true })
                                                setTouchedFields(prev => ({ ...prev, image_url: true }))
                                            }}
                                            className="cursor-pointer file:cursor-pointer file:text-blue-700 dark:file:text-blue-300 file:bg-blue-100/50 dark:file:bg-blue-800/50 file:border-0 file:mr-4 file:py-1 file:px-3 file:rounded-full hover:file:bg-blue-100"
                                        />
                                        {selectedImages.length > 0 && (
                                            <ul className="mt-2 space-y-1">
                                                {selectedImages.map((f, i) => (
                                                    <li key={i} className="text-[11px] text-blue-700 dark:text-blue-300 font-bold px-2 py-1 bg-blue-100/50 dark:bg-blue-900/50 rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-left-2">
                                                        <span className="flex items-center gap-1.5 truncate pr-2"><CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{f.name}</span></span>
                                                        <button type="button" onClick={() => {
                                                            const nf = selectedImages.filter((_, idx) => idx !== i)
                                                            setSelectedImages(nf)
                                                            setValue('image_url', nf.length ? 'selected' : '', { shouldValidate: true })
                                                        }} className="p-0.5 hover:bg-blue-200/50 rounded-md transition-colors"><X className="w-3.5 h-3.5" /></button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </FormField>

                                <FormField 
                                    label="影片：(單一影片大小限制: 100MB)" 
                                    error={errors.video_url?.message} 
                                    touched={touchedFields.video_url}
                                >
                                    <div className="space-y-1.5">
                                        <Input
                                            type="file"
                                            multiple
                                            accept="video/*"
                                            onChange={(e) => {
                                                const files = Array.from(e.target.files || [])
                                                if (files.length > 10) toast({ title: '超過數量', description: '最多只能上傳10部影片', variant: 'destructive' })
                                                const finalFiles = files.slice(0, 10)
                                                setSelectedVideos(finalFiles)
                                                setValue('video_url', finalFiles.length ? 'selected' : '')
                                            }}
                                            className="cursor-pointer file:cursor-pointer file:text-purple-700 dark:file:text-purple-300 file:bg-purple-100/50 dark:file:bg-purple-800/50 file:border-0 file:mr-4 file:py-1 file:px-3 file:rounded-full hover:file:bg-purple-100"
                                        />
                                        {selectedVideos.length > 0 && (
                                            <ul className="mt-2 space-y-1">
                                                {selectedVideos.map((f, i) => (
                                                    <li key={i} className="text-[11px] text-purple-700 dark:text-purple-300 font-bold px-2 py-1 bg-purple-100/50 dark:bg-purple-900/50 rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-left-2">
                                                        <span className="flex items-center gap-1.5 truncate pr-2"><CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{f.name}</span></span>
                                                        <button type="button" onClick={() => {
                                                            const nf = selectedVideos.filter((_, idx) => idx !== i)
                                                            setSelectedVideos(nf)
                                                            setValue('video_url', nf.length ? 'selected' : '')
                                                        }} className="p-0.5 hover:bg-purple-200/50 rounded-md transition-colors"><X className="w-3.5 h-3.5" /></button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </FormField>
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
