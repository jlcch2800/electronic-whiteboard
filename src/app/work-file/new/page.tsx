// Work File New Page - 新增施工文件
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2, CheckCircle, FileUp, UploadCloud, X } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { workFileSchema, type WorkFileFormValues } from '@/lib/validations/schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

export default function WorkFileNewPage() {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()

    // File States
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [selectedImage, setSelectedImage] = useState<File | null>(null)
    const [selectedVideo, setSelectedVideo] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)

    const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<WorkFileFormValues>({
        resolver: zodResolver(workFileSchema),
        defaultValues: {
            date: format(new Date(), 'yyyy-MM-dd'),
            file_url: 'pending...', // 暫用，最後會被覆蓋
            image_url: 'pending...', // 暫用，最後會被覆蓋
            uploader_name: '',
        }
    })

    // Cloudinary Upload Helper
    const uploadToCloudinary = async (file: File, resourceType: 'auto' | 'image' | 'video' | 'raw' = 'auto') => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!)
        formData.append('cloud_name', process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!)

        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
            {
                method: 'POST',
                body: formData,
            }
        )

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.message || 'Upload failed')
        }

        const data = await response.json()
        return data.secure_url
    }

    const onSubmit = async (data: WorkFileFormValues) => {
        try {
            setUploading(true)

            // 1. Upload Files
            let fileUrl = ''
            let imageUrl = ''
            let videoUrl = ''

            if (selectedFile) {
                fileUrl = await uploadToCloudinary(selectedFile, 'raw') // Use 'raw' for non-image files like PDF, DOC
            }
            if (selectedImage) {
                imageUrl = await uploadToCloudinary(selectedImage, 'image')
            }
            if (selectedVideo) {
                videoUrl = await uploadToCloudinary(selectedVideo, 'video')
            }

            // 2. Prepare Payload
            const payload = {
                ...data,
                file_url: fileUrl, // 必填，若未上傳則為空字串，Schema 可能需調整或在此擋下
                image_url: imageUrl,
                video_url: videoUrl || null,
            }

            // 簡單驗證：如果必填檔案沒選
            // 注意：Schema 定義 file_url / image_url 為 optional，但 DB 為 NOT NULL (依據先前 sql 記錄)
            // 這裡做個防呆，如果 DB 允許空字串則沒問題

            const { error } = await (supabase.from('work_file') as any).insert(payload)
            if (error) throw error

            toast({ title: '新增成功', description: '施工文件已上傳並記錄' })
            router.push('/work-file')
        } catch (error: any) {
            console.error(error)
            toast({ title: '新增失敗', description: error.message, variant: 'destructive' })
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100">
            <header className="sticky top-0 z-10 bg-teal-600 text-white px-6 py-4 shadow-lg">
                <div className="flex items-center gap-4 max-w-3xl mx-auto">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-teal-700">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-lg font-bold">施工文件 - 新增 (上傳)</h1>
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
                                        <span>文件 (PDF/DOC) <span className="text-red-500">*</span></span>
                                        {selectedFile && <span className="text-xs text-teal-600 font-bold">{selectedFile.name}</span>}
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            type="file"
                                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                            className="cursor-pointer file:cursor-pointer file:text-teal-700 file:bg-teal-100/50 file:border-0 file:mr-4 file:py-1 file:px-3 file:rounded-full hover:file:bg-teal-100"
                                        />
                                        {/* Register dummy input for validation if needed, or rely on manual check */}
                                        <input type="hidden" {...register('file_url')} />
                                    </div>
                                    <p className="text-xs text-slate-500">支援 PDF, Word, Excel 等文件格式</p>
                                </div>

                                {/* Image Upload */}
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
                                <><CheckCircle className="w-5 h-5 mr-2" /> 提交文件</>
                            )}
                        </Button>
                    </form>
                </motion.div>
            </main>
        </div>
    )
}
