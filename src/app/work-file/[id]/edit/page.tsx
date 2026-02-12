// Work File Edit Page - 編輯施工文件 (含檔案上傳)
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2, CheckCircle, UploadCloud, ExternalLink } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { workFileSchema, type WorkFileFormValues } from '@/lib/validations/schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

export default function WorkFileEditPage() {
    const router = useRouter()
    const params = useParams()
    const id = params.id as string
    const supabase = createClient()
    const { toast } = useToast()
    const [loading, setLoading] = useState(true)
    const [originalData, setOriginalData] = useState<any>(null)

    // File States - 用於新上傳檔案
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [selectedImage, setSelectedImage] = useState<File | null>(null)
    const [selectedVideo, setSelectedVideo] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)

    // 現有檔案 URL (從資料庫載入)
    const [existingFileUrl, setExistingFileUrl] = useState('')
    const [existingImageUrl, setExistingImageUrl] = useState('')
    const [existingVideoUrl, setExistingVideoUrl] = useState('')

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<WorkFileFormValues>({
        resolver: zodResolver(workFileSchema),
    })

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

    // 載入現有資料
    useEffect(() => {
        const fetchData = async () => {
            const { data, error } = await supabase.from('work_file').select('*').eq('id', id).single() as { data: any, error: any }
            if (error || !data) {
                toast({ title: '載入失敗', description: error?.message || '找不到此筆資料', variant: 'destructive' })
                router.push('/work-file')
                return
            }
            setOriginalData(data)
            setExistingFileUrl(data.file_url || '')
            setExistingImageUrl(data.image_url || '')
            setExistingVideoUrl(data.video_url || '')
            reset({
                date: data.date,
                vendor_name: data.vendor_name || '',
                work_item: data.work_item || '',
                uploader_name: data.uploader_name,
                description: data.description || '',
                file_url: data.file_url || '',
                image_url: data.image_url || '',
                video_url: data.video_url || '',
                note: data.note || '',
            })
            setLoading(false)
        }
        fetchData()
    }, [id])

    const onSubmit = async (data: WorkFileFormValues) => {
        try {
            setUploading(true)

            // 1. 若有選擇新檔案則上傳，否則沿用現有 URL
            let fileUrl = existingFileUrl
            let imageUrl = existingImageUrl
            let videoUrl = existingVideoUrl

            if (selectedFile) {
                fileUrl = await uploadToCloudinary(selectedFile, 'raw')
            }
            if (selectedImage) {
                imageUrl = await uploadToCloudinary(selectedImage, 'image')
            }
            if (selectedVideo) {
                videoUrl = await uploadToCloudinary(selectedVideo, 'video')
            }

            // 2. 組合 payload
            const payload = {
                date: data.date,
                vendor_name: data.vendor_name || null,
                work_item: data.work_item || null,
                uploader_name: data.uploader_name,
                description: data.description || null,
                file_url: fileUrl,
                image_url: imageUrl,
                video_url: videoUrl || null,
                note: data.note || null,
            }

            const { error } = await (supabase.from('work_file') as any).update(payload).eq('id', id)
            if (error) throw error

            toast({ title: '更新成功', description: '施工文件已更新' })
            router.push('/work-file')
        } catch (error: any) {
            console.error(error)
            toast({ title: '更新失敗', description: error.message, variant: 'destructive' })
        } finally {
            setUploading(false)
        }
    }

    // 縮短 URL 顯示
    const shortenUrl = (url: string) => {
        if (!url) return ''
        try { const u = new URL(url); return u.hostname + (u.pathname.length > 20 ? u.pathname.slice(0, 20) + '...' : u.pathname) }
        catch { return url.slice(0, 30) + '...' }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-100">
                <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100">
            <header className="sticky top-0 z-10 bg-teal-600 text-white px-6 py-4 shadow-lg">
                <div className="flex items-center gap-4 max-w-3xl mx-auto">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-teal-700">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-lg font-bold">施工文件 - 編輯</h1>
                </div>
            </header>

            <main className="max-w-3xl mx-auto p-6">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <Card>
                            <CardHeader><CardTitle className="text-base">基本資訊</CardTitle></CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>日期 <span className="text-red-500">*</span></Label>
                                        <Input type="date" {...register('date')} />
                                        {errors.date && <p className="text-red-500 text-xs">{errors.date.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>上傳人員 <span className="text-red-500">*</span></Label>
                                        <Input {...register('uploader_name')} placeholder="請輸入上傳人員姓名" />
                                        {errors.uploader_name && <p className="text-red-500 text-xs">{errors.uploader_name.message}</p>}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle className="text-base">施工資訊</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>廠商名稱</Label>
                                        <Input {...register('vendor_name')} placeholder="選填" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>施工項目</Label>
                                        <Input {...register('work_item')} placeholder="選填" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>說明</Label>
                                    <Textarea {...register('description')} rows={3} placeholder="選填，說明此文件內容" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-teal-200 bg-teal-50/50">
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2 text-teal-700">
                                    <UploadCloud className="w-5 h-5" />
                                    檔案上傳
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* File Upload */}
                                <div className="space-y-2">
                                    <Label className="flex items-center justify-between">
                                        <span>文件 (PDF/DOC)</span>
                                        {selectedFile && <span className="text-xs text-teal-600 font-bold">{selectedFile.name}</span>}
                                    </Label>
                                    <Input
                                        type="file"
                                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                        className="cursor-pointer file:cursor-pointer file:text-teal-700 file:bg-teal-100/50 file:border-0 file:mr-4 file:py-1 file:px-3 file:rounded-full hover:file:bg-teal-100"
                                    />
                                    {existingFileUrl && !selectedFile && (
                                        <p className="text-xs text-slate-500 flex items-center gap-1">
                                            現有檔案: <a href={existingFileUrl} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" />{shortenUrl(existingFileUrl)}</a>
                                        </p>
                                    )}
                                    <input type="hidden" {...register('file_url')} />
                                </div>

                                {/* Image Upload */}
                                <div className="space-y-2">
                                    <Label className="flex items-center justify-between">
                                        <span>照片 (Image)</span>
                                        {selectedImage && <span className="text-xs text-blue-600 font-bold">{selectedImage.name}</span>}
                                    </Label>
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => setSelectedImage(e.target.files?.[0] || null)}
                                        className="cursor-pointer file:cursor-pointer file:text-blue-700 file:bg-blue-100/50 file:border-0 file:mr-4 file:py-1 file:px-3 file:rounded-full hover:file:bg-blue-100"
                                    />
                                    {existingImageUrl && !selectedImage && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500">現有照片:</span>
                                            <a href={existingImageUrl} target="_blank" rel="noopener noreferrer">
                                                <img src={existingImageUrl} alt="Current" className="w-16 h-16 object-cover rounded-md border border-slate-200 shadow-sm" />
                                            </a>
                                        </div>
                                    )}
                                    <input type="hidden" {...register('image_url')} />
                                </div>

                                {/* Video Upload */}
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
                                    {existingVideoUrl && !selectedVideo && (
                                        <p className="text-xs text-slate-500 flex items-center gap-1">
                                            現有影片: <a href={existingVideoUrl} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" />{shortenUrl(existingVideoUrl)}</a>
                                        </p>
                                    )}
                                    <input type="hidden" {...register('video_url')} />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6">
                                <div className="space-y-2">
                                    <Label>備註</Label>
                                    <Input {...register('note')} placeholder="選填" />
                                </div>
                            </CardContent>
                        </Card>

                        <Button type="submit" disabled={isSubmitting || uploading} className="w-full py-6 text-lg font-bold bg-teal-600 hover:bg-teal-700 shadow-lg">
                            {(isSubmitting || uploading) ? (
                                <><Loader2 className="w-5 h-5 animate-spin mr-2" /> 上傳中...</>
                            ) : (
                                <><CheckCircle className="w-5 h-5 mr-2" /> 儲存變更</>
                            )}
                        </Button>
                    </form>
                </motion.div>
            </main>
        </div>
    )
}
