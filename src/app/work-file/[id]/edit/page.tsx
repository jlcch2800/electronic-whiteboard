// Work File Edit Page - 編輯施工文件 (含檔案上傳)
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { Loader2, UploadCloud, ExternalLink, CheckCircle2, X } from 'lucide-react'

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

    const [selectedFiles, setSelectedFiles] = useState<File[]>([])
    const [selectedImages, setSelectedImages] = useState<File[]>([])
    const [selectedVideos, setSelectedVideos] = useState<File[]>([])
    const [uploading, setUploading] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [pendingData, setPendingData] = useState<WorkFileFormValues | null>(null)
    const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})

    const [existingFileUrls, setExistingFileUrls] = useState<string[]>([])
    const [existingImageUrls, setExistingImageUrls] = useState<string[]>([])
    const [existingVideoUrls, setExistingVideoUrls] = useState<string[]>([])
    const [initialUrls, setInitialUrls] = useState<string[]>([])

    const { register, handleSubmit, trigger, reset, setValue, formState: { errors, isSubmitting } } = useForm<WorkFileFormValues>({
        resolver: zodResolver(workFileSchema),
        mode: 'onBlur',
    })

    const handleFieldBlur = useCallback((fieldName: string) => {
        setTouchedFields(prev => ({ ...prev, [fieldName]: true }))
        trigger(fieldName as any)
    }, [trigger])

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
            const parseUrls = (val: string | null | undefined): string[] => {
                if (!val) return []
                if (typeof val !== 'string') return []
                if (val.startsWith('[')) {
                    try { return JSON.parse(val) } catch { return [val] }
                }
                return [val]
            }

            // 輔助函式：從 Cloudinary URL 解析資料夾名稱 (格式: .../work-report/2026-04-28_Folder/...)
            const extractFolderNameFromUrl = (url: string | null): string => {
                if (!url) return ''
                try {
                    const decodedUrl = decodeURIComponent(url)
                    const matches = decodedUrl.match(/\/work-report\/[^/]+_([^/]+)\//)
                    return matches ? matches[1] : ''
                } catch { return '' }
            }

            const files = parseUrls(data.file_url)
            const images = parseUrls(data.image_url)
            const videos = parseUrls(data.video_url)

            setExistingFileUrls(files)
            setExistingImageUrls(images)
            setExistingVideoUrls(videos)
            setInitialUrls([...files, ...images, ...videos])

            // 優先使用資料庫的 folder_name，若無則從網址解析
            const initialFolderName = data.folder_name || extractFolderNameFromUrl(files[0] || images[0] || videos[0])

            reset({
                date: data.date, vendor_name: data.vendor_name || '', work_item: data.work_item || '',
                uploader_name: data.uploader_name, description: data.description || '',
                file_url: data.file_url || '', image_url: data.image_url || '', video_url: data.video_url || '',
                folder_name: initialFolderName, note: data.note || '',
            })
            setLoading(false)
        }
        fetchData()
    }, [id])

    // 輔助函式：從網址提取檔名
    const getFileName = (url: string | null) => {
        if (!url) return ''
        try {
            const decoded = decodeURIComponent(url)
            const parts = decoded.split('/')
            return parts[parts.length - 1]
        } catch { return url?.split('/').pop() || '' }
    }

    const onPreSubmit = (data: WorkFileFormValues) => { setPendingData(data); setShowConfirm(true) }

    const onConfirmSubmit = async () => {
        if (!pendingData) return
        setShowConfirm(false)
        try {
            setUploading(true)
            
            const sanitizedFolder = pendingData.folder_name?.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, '_') || 'work-file'
            const folderPath = `work-report/${pendingData.date}_${sanitizedFolder}`

            const uploadFiles = async (files: File[], type: 'raw' | 'image' | 'video') => {
                if (!files || files.length === 0) return []
                const urls = await Promise.all(files.map(f => uploadToCloudinary(f, type, folderPath)))
                return urls
            }

            const newFileUrls = await uploadFiles(selectedFiles, 'raw')
            const newImageUrls = await uploadFiles(selectedImages, 'image')
            const newVideoUrls = await uploadFiles(selectedVideos, 'video')

            const combinedFileUrls = [...existingFileUrls, ...newFileUrls]
            const combinedImageUrls = [...existingImageUrls, ...newImageUrls]
            const combinedVideoUrls = [...existingVideoUrls, ...newVideoUrls]

            // 找出被移除的現有網址並同步從 Cloudinary 刪除
            const finalExistingUrls = [...existingFileUrls, ...existingImageUrls, ...existingVideoUrls]
            const removedUrls = initialUrls.filter(url => !finalExistingUrls.includes(url))
            
            if (removedUrls.length > 0) {
                fetch('/api/cloudinary/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ urls: removedUrls })
                }).catch(err => console.error('Cloudinary sync delete error:', err))
            }

            const payload = {
                date: pendingData.date, 
                vendor_name: pendingData.vendor_name || null,
                work_item: pendingData.work_item || null, 
                uploader_name: pendingData.uploader_name,
                description: pendingData.description || null, 
                folder_name: pendingData.folder_name,
                file_url: combinedFileUrls.length > 0 ? JSON.stringify(combinedFileUrls) : '', 
                image_url: combinedImageUrls.length > 0 ? JSON.stringify(combinedImageUrls) : '',
                video_url: combinedVideoUrls.length > 0 ? JSON.stringify(combinedVideoUrls) : null, 
                note: pendingData.note || null,
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
                                <FormField label="上傳檔案的資料夾名稱" error={errors.folder_name?.message} touched={touchedFields.folder_name}>
                                    <Input {...register('folder_name')} placeholder="請輸入資料夾名稱 (若要補傳檔案，建議輸入相同名稱以免分散)" onBlur={() => handleFieldBlur('folder_name')} />
                                </FormField>
                                <p className="text-[11px] text-amber-600 dark:text-amber-300 font-bold px-1 -mt-2">
                                    提示：文件與照片請至少保留或上傳一項
                                </p>
                                <FormField 
                                    label="文件：(單一檔案大小限制: 10MB)" 
                                    error={errors.file_url?.message} 
                                    touched={touchedFields.file_url}
                                >
                                    <div className="space-y-2">
                                        <Input
                                            type="file"
                                            multiple
                                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                                            onChange={(e) => {
                                                const files = Array.from(e.target.files || [])
                                                if (files.length + existingFileUrls.length > 10) toast({ title: '超過數量', description: '文件總數最多 10 個', variant: 'destructive' })
                                                const finalFiles = files.slice(0, 10 - existingFileUrls.length)
                                                setSelectedFiles(finalFiles)
                                                setValue('file_url', (finalFiles.length || existingFileUrls.length) ? 'selected' : '')
                                            }}
                                            className="cursor-pointer file:cursor-pointer file:text-teal-700 dark:file:text-teal-300 file:bg-teal-100/50 dark:file:bg-teal-800/50 file:border-0 file:mr-4 file:py-1 file:px-3 file:rounded-full hover:file:bg-teal-100"
                                        />
                                        
                                        {/* 已選取的新檔案 */}
                                        {selectedFiles.length > 0 && (
                                            <ul className="space-y-1 mt-1">
                                                {selectedFiles.map((f, i) => (
                                                    <li key={i} className="text-[11px] text-teal-700 dark:text-teal-300 font-bold px-2 py-1 bg-teal-100/50 dark:bg-teal-900/50 rounded-lg flex items-center justify-between">
                                                        <span className="flex items-center gap-1.5 truncate"><CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">新增：{f.name}</span></span>
                                                        <button type="button" onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))} className="p-0.5 hover:bg-teal-200/50 rounded-md"><X className="w-3.5 h-3.5" /></button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}

                                        {existingFileUrls.length > 0 && (
                                            <div className="px-2 py-1.5 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg mt-1">
                                                <p className="text-[10px] text-muted-foreground mb-1">現有文件:</p>
                                                <ul className="space-y-1">
                                                    {existingFileUrls.map((url, i) => (
                                                        <li key={i} className="flex items-center justify-between gap-2">
                                                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1.5 font-bold text-[11px] truncate">
                                                                <ExternalLink className="w-3 h-3 flex-shrink-0" /> {getFileName(url)}
                                                            </a>
                                                            <button type="button" onClick={() => {
                                                                const nUrls = existingFileUrls.filter((_, idx) => idx !== i)
                                                                setExistingFileUrls(nUrls)
                                                                setValue('file_url', (selectedFiles.length || nUrls.length) ? 'selected' : '')
                                                            }} className="p-0.5 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded"><X className="w-3.5 h-3.5" /></button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </FormField>

                                <FormField 
                                    label="照片：(單一照片大小限制: 10MB)" 
                                    error={errors.image_url?.message} 
                                    touched={touchedFields.image_url}
                                >
                                    <div className="space-y-2">
                                        <Input
                                            type="file"
                                            multiple
                                            accept="image/*"
                                            onChange={(e) => {
                                                const files = Array.from(e.target.files || [])
                                                if (files.length + existingImageUrls.length > 10) toast({ title: '超過數量', description: '照片總數最多 10 張', variant: 'destructive' })
                                                const finalFiles = files.slice(0, 10 - existingImageUrls.length)
                                                setSelectedImages(finalFiles)
                                                setValue('image_url', (finalFiles.length || existingImageUrls.length) ? 'selected' : '')
                                            }}
                                            className="cursor-pointer file:cursor-pointer file:text-blue-700 dark:file:text-blue-300 file:bg-blue-100/50 dark:file:bg-blue-800/50 file:border-0 file:mr-4 file:py-1 file:px-3 file:rounded-full hover:file:bg-blue-100"
                                        />

                                        {selectedImages.length > 0 && (
                                            <ul className="space-y-1 mt-1">
                                                {selectedImages.map((f, i) => (
                                                    <li key={i} className="text-[11px] text-blue-700 dark:text-blue-300 font-bold px-2 py-1 bg-blue-100/50 dark:bg-blue-900/50 rounded-lg flex items-center justify-between">
                                                        <span className="flex items-center gap-1.5 truncate"><CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">新增：{f.name}</span></span>
                                                        <button type="button" onClick={() => setSelectedImages(prev => prev.filter((_, idx) => idx !== i))} className="p-0.5 hover:bg-blue-200/50 rounded-md"><X className="w-3.5 h-3.5" /></button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}

                                        {existingImageUrls.length > 0 && (
                                            <div className="px-2 py-1.5 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg mt-1">
                                                <p className="text-[10px] text-muted-foreground mb-1">現有照片:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {existingImageUrls.map((url, i) => (
                                                        <div key={i} className="relative group">
                                                            <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                                                                <img src={url} alt="Current" className="w-12 h-12 object-cover rounded shadow-sm border border-teal-200 dark:border-teal-800" />
                                                            </a>
                                                            <button type="button" onClick={() => {
                                                                const nUrls = existingImageUrls.filter((_, idx) => idx !== i)
                                                                setExistingImageUrls(nUrls)
                                                                setValue('image_url', (selectedImages.length || nUrls.length) ? 'selected' : '')
                                                            }} className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full p-0.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </FormField>

                                <FormField 
                                    label="影片：(單一影片大小限制: 100MB)" 
                                    error={errors.video_url?.message} 
                                    touched={touchedFields.video_url}
                                >
                                    <div className="space-y-2">
                                        <Input
                                            type="file"
                                            multiple
                                            accept="video/*"
                                            onChange={(e) => {
                                                const files = Array.from(e.target.files || [])
                                                if (files.length + existingVideoUrls.length > 10) toast({ title: '超過數量', description: '影片總數最多 10 部', variant: 'destructive' })
                                                const finalFiles = files.slice(0, 10 - existingVideoUrls.length)
                                                setSelectedVideos(finalFiles)
                                                setValue('video_url', (finalFiles.length || existingVideoUrls.length) ? 'selected' : '')
                                            }}
                                            className="cursor-pointer file:cursor-pointer file:text-purple-700 dark:file:text-purple-300 file:bg-purple-100/50 dark:file:bg-purple-800/50 file:border-0 file:mr-4 file:py-1 file:px-3 file:rounded-full hover:file:bg-purple-100"
                                        />

                                        {selectedVideos.length > 0 && (
                                            <ul className="space-y-1 mt-1">
                                                {selectedVideos.map((f, i) => (
                                                    <li key={i} className="text-[11px] text-purple-700 dark:text-purple-300 font-bold px-2 py-1 bg-purple-100/50 dark:bg-purple-900/50 rounded-lg flex items-center justify-between">
                                                        <span className="flex items-center gap-1.5 truncate"><CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">新增：{f.name}</span></span>
                                                        <button type="button" onClick={() => setSelectedVideos(prev => prev.filter((_, idx) => idx !== i))} className="p-0.5 hover:bg-purple-200/50 rounded-md"><X className="w-3.5 h-3.5" /></button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}

                                        {existingVideoUrls.length > 0 && (
                                            <div className="px-2 py-1.5 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg mt-1">
                                                <p className="text-[10px] text-muted-foreground mb-1">現有影片:</p>
                                                <ul className="space-y-1">
                                                    {existingVideoUrls.map((url, i) => (
                                                        <li key={i} className="flex items-center justify-between gap-2">
                                                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-purple-700 dark:text-purple-400 hover:underline flex items-center gap-1.5 font-bold text-[11px] truncate">
                                                                <ExternalLink className="w-3 h-3 flex-shrink-0" /> {getFileName(url)}
                                                            </a>
                                                            <button type="button" onClick={() => {
                                                                const nUrls = existingVideoUrls.filter((_, idx) => idx !== i)
                                                                setExistingVideoUrls(nUrls)
                                                                setValue('video_url', (selectedVideos.length || nUrls.length) ? 'selected' : '')
                                                            }} className="p-0.5 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded"><X className="w-3.5 h-3.5" /></button>
                                                        </li>
                                                    ))}
                                                </ul>
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
