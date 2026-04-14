// Work File Edit Page - 編輯施工文件 (含檔案上傳)
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { Loader2, UploadCloud, ExternalLink, CheckCircle2 } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { workFileSchema, type WorkFileFormValues } from '@/lib/validations/schemas'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { logChangeRecord } from '@/lib/change-log'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

import FormField from '@/components/forms/FormField'
import FormHeader from '@/components/forms/FormHeader'
import BackButton from '@/components/forms/BackButton'
import SubmitButton from '@/components/forms/SubmitButton'
import ConfirmDialog from '@/components/forms/ConfirmDialog'

const FIELD_LABELS: Record<string, string> = {
    date: '日期', uploader_name: '上傳人員', vendor_name: '廠商名稱',
    work_item: '施工項目', description: '說明', note: '備註',
}

export default function WorkFileEditPage() {
    const router = useRouter()
    const params = useParams()
    const id = params.id as string
    const supabase = createClient()
    const { toast } = useToast()
    const [loading, setLoading] = useState(true)

    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [selectedImage, setSelectedImage] = useState<File | null>(null)
    const [selectedVideo, setSelectedVideo] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [pendingData, setPendingData] = useState<WorkFileFormValues | null>(null)
    const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})

    const [existingFileUrl, setExistingFileUrl] = useState('')
    const [existingImageUrl, setExistingImageUrl] = useState('')
    const [existingVideoUrl, setExistingVideoUrl] = useState('')

    const { register, handleSubmit, trigger, reset, setValue, formState: { errors, isSubmitting } } = useForm<WorkFileFormValues>({
        resolver: zodResolver(workFileSchema),
        mode: 'onBlur',
    })

    const handleFieldBlur = useCallback((fieldName: string) => {
        setTouchedFields(prev => ({ ...prev, [fieldName]: true }))
        trigger(fieldName as any)
    }, [trigger])

    const uploadToCloudinary = async (file: File, resourceType: 'auto' | 'image' | 'video' | 'raw' = 'auto') => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!)
        formData.append('cloud_name', process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!)
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
            { method: 'POST', body: formData }
        )
        if (!response.ok) { const error = await response.json(); throw new Error(error.message || 'Upload failed') }
        const data = await response.json()
        return data.secure_url
    }

    useEffect(() => {
        const fetchData = async () => {
            const { data, error } = await supabase.from('work_file').select('*').eq('id', id).single() as { data: any, error: any }
            if (error || !data) {
                toast({ title: '載入失敗', description: error?.message || '找不到此筆資料', variant: 'destructive' })
                router.push('/work-file')
                return
            }
            setExistingFileUrl(data.file_url || '')
            setExistingImageUrl(data.image_url || '')
            setExistingVideoUrl(data.video_url || '')
            reset({
                date: data.date, vendor_name: data.vendor_name || '', work_item: data.work_item || '',
                uploader_name: data.uploader_name, description: data.description || '',
                file_url: data.file_url || '', image_url: data.image_url || '', video_url: data.video_url || '',
                note: data.note || '',
            })
            setLoading(false)
        }
        fetchData()
    }, [id])

    const shortenUrl = (url: string) => {
        if (!url) return ''
        try { const u = new URL(url); return u.hostname + (u.pathname.length > 20 ? u.pathname.slice(0, 20) + '...' : u.pathname) }
        catch { return url.slice(0, 30) + '...' }
    }

    const onPreSubmit = (data: WorkFileFormValues) => { setPendingData(data); setShowConfirm(true) }

    const onConfirmSubmit = async () => {
        if (!pendingData) return
        setShowConfirm(false)
        try {
            setUploading(true)
            let fileUrl = existingFileUrl
            let imageUrl = existingImageUrl
            let videoUrl = existingVideoUrl
            if (selectedFile) fileUrl = await uploadToCloudinary(selectedFile, 'raw')
            if (selectedImage) imageUrl = await uploadToCloudinary(selectedImage, 'image')
            if (selectedVideo) videoUrl = await uploadToCloudinary(selectedVideo, 'video')

            const payload = {
                date: pendingData.date, vendor_name: pendingData.vendor_name || null,
                work_item: pendingData.work_item || null, uploader_name: pendingData.uploader_name,
                description: pendingData.description || null, file_url: fileUrl, image_url: imageUrl,
                video_url: videoUrl || null, note: pendingData.note || null,
            }
            const { error } = await (supabase.from('work_file') as any).update(payload).eq('id', id)
            if (error) throw error

            // 寫入系統異動紀錄 (這裡需搭配原始資料, 但 fetch 時只存了 resetData 格式，只好拿目前 DB 更新後的或直接用 payload 與 pendingData)
            logChangeRecord({ actionType: 'Update', modifyTable: 'work_file', modifyRecordId: id, oldData: {}, newData: payload })

            setIsSuccess(true)
            toast({ title: '更新成功', description: '施工文件已更新' })
            setTimeout(() => router.push('/work-file'), 1500)
        } catch (error: any) {
            console.error(error)
            toast({ title: '更新失敗', description: error.message, variant: 'destructive' })
        } finally { setUploading(false) }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted">
                <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 transition-colors duration-500">
            <FormHeader title="施工文件 - 編輯" currentStep={3} totalSteps={3} themeColor="bg-teal-600">
                <BackButton />
            </FormHeader>

            <main className="max-w-3xl mx-auto p-6">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <form onSubmit={handleSubmit(onPreSubmit)} className="space-y-6">
                        <Card>
                            <CardHeader><CardTitle className="text-base">基本資訊</CardTitle></CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField label="日期" required error={errors.date?.message} touched={touchedFields.date}>
                                        <Input type="date" {...register('date')} onBlur={() => handleFieldBlur('date')} />
                                    </FormField>
                                    <FormField label="上傳人員" required error={errors.uploader_name?.message} touched={touchedFields.uploader_name}>
                                        <Input {...register('uploader_name')} onBlur={() => handleFieldBlur('uploader_name')} />
                                    </FormField>
                                </div>
                            </CardContent>
                        </Card>

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
                                    <Textarea {...register('description')} rows={3} placeholder="選填" onBlur={() => handleFieldBlur('description')} />
                                </FormField>
                            </CardContent>
                        </Card>

                        <Card className="border-teal-200 dark:border-teal-800 bg-teal-50/80 dark:bg-teal-900/20 shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2 text-teal-700 dark:text-teal-400">
                                    <UploadCloud className="w-5 h-5" /> 檔案上傳
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-[11px] text-amber-600 dark:text-amber-300 font-bold px-1 -mt-2">
                                    提示：文件與照片請至少擇一上傳
                                </p>
                                <FormField 
                                    label="文件 (PDF/DOC)" 
                                    error={errors.file_url?.message} 
                                    touched={touchedFields.file_url}
                                >
                                    <div className="space-y-1.5">
                                        <Input
                                            type="file"
                                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0] || null
                                                setSelectedFile(file)
                                                setValue('file_url', file ? 'selected' : (existingFileUrl || ''))
                                            }}
                                            className="cursor-pointer file:cursor-pointer file:text-teal-700 dark:file:text-teal-300 file:bg-teal-100/50 dark:file:bg-teal-800/50 file:border-0 file:mr-4 file:py-1 file:px-3 file:rounded-full hover:file:bg-teal-100"
                                        />
                                        {selectedFile ? (
                                            <p className="text-[11px] text-teal-700 dark:text-teal-300 font-bold px-2 py-1 bg-teal-100/50 dark:bg-teal-900/50 rounded-lg flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2">
                                                <CheckCircle2 className="w-3.5 h-3.5" /> 已選取：{selectedFile.name}
                                            </p>
                                        ) : existingFileUrl && (
                                            <div className="px-2 py-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg">
                                                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1">現有檔案:</p>
                                                <a href={existingFileUrl} target="_blank" rel="noopener noreferrer" className="text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1.5 font-bold text-[11px] truncate">
                                                    <ExternalLink className="w-3 h-3 flex-shrink-0" /> {shortenUrl(existingFileUrl)}
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </FormField>

                                <FormField 
                                    label="照片 (Image)" 
                                    error={errors.image_url?.message} 
                                    touched={touchedFields.image_url}
                                >
                                    <div className="space-y-1.5">
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0] || null
                                                setSelectedImage(file)
                                                setValue('image_url', file ? 'selected' : (existingImageUrl || ''))
                                            }}
                                            className="cursor-pointer file:cursor-pointer file:text-blue-700 dark:file:text-blue-300 file:bg-blue-100/50 dark:file:bg-blue-800/50 file:border-0 file:mr-4 file:py-1 file:px-3 file:rounded-full hover:file:bg-blue-100"
                                        />
                                         {selectedImage ? (
                                            <p className="text-[11px] text-blue-700 dark:text-blue-300 font-bold px-2 py-1 bg-blue-100/50 dark:bg-blue-900/50 rounded-lg flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2">
                                                <CheckCircle2 className="w-3.5 h-3.5" /> 已選取：{selectedImage.name}
                                            </p>
                                        ) : existingImageUrl && (
                                            <div className="flex items-center gap-3 px-2 py-1.5 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg">
                                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">現有照片:</span>
                                                <a href={existingImageUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                                                    <img src={existingImageUrl} alt="Current" className="w-10 h-10 object-cover rounded shadow-sm border border-teal-200 dark:border-teal-800" />
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </FormField>

                                <FormField 
                                    label="影片 (Video) (選填)" 
                                    error={errors.video_url?.message} 
                                    touched={touchedFields.video_url}
                                >
                                    <div className="space-y-1.5">
                                        <Input
                                            type="file"
                                            accept="video/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0] || null
                                                setSelectedVideo(file)
                                                setValue('video_url', file ? 'selected' : (existingVideoUrl || ''))
                                            }}
                                            className="cursor-pointer file:cursor-pointer file:text-purple-700 dark:file:text-purple-300 file:bg-purple-100/50 dark:file:bg-purple-800/50 file:border-0 file:mr-4 file:py-1 file:px-3 file:rounded-full hover:file:bg-purple-100"
                                        />
                                        {selectedVideo ? (
                                            <p className="text-[11px] text-purple-700 dark:text-purple-300 font-bold px-2 py-1 bg-purple-100/50 dark:bg-purple-900/50 rounded-lg flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2">
                                                <CheckCircle2 className="w-3.5 h-3.5" /> 已選取：{selectedVideo.name}
                                            </p>
                                        ) : existingVideoUrl && (
                                            <div className="px-2 py-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg">
                                                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1">現有影片:</p>
                                                <a href={existingVideoUrl} target="_blank" rel="noopener noreferrer" className="text-purple-700 dark:text-purple-400 hover:underline flex items-center gap-1.5 font-bold text-[11px] truncate">
                                                    <ExternalLink className="w-3 h-3 flex-shrink-0" /> {shortenUrl(existingVideoUrl)}
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </FormField>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6">
                                <FormField label="備註" error={errors.note?.message} touched={touchedFields.note}>
                                    <Input {...register('note')} placeholder="選填" onBlur={() => handleFieldBlur('note')} />
                                </FormField>
                            </CardContent>
                        </Card>

                        <SubmitButton isSubmitting={isSubmitting || uploading} isSuccess={isSuccess} label="儲存變更" className="bg-teal-600 hover:bg-teal-700" />
                    </form>
                </motion.div>
            </main>

            <ConfirmDialog open={showConfirm} onConfirm={onConfirmSubmit} onCancel={() => setShowConfirm(false)}
                title="確認儲存變更" data={pendingData || {}} fieldLabels={FIELD_LABELS} />
        </div>
    )
}
