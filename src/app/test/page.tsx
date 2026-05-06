'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import SignatureInput from '@/components/forms/SignatureInput'
import FormField from '@/components/forms/FormField'
import FormHeader from '@/components/forms/FormHeader'
import BackButton from '@/components/forms/BackButton'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { motion } from 'framer-motion'
import { Info, CheckCircle2, AlertTriangle } from 'lucide-react'

export default function TestSignaturePage() {
    const { toast } = useToast()
    const [signature, setSignature] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [formResult, setFormResult] = useState<any>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!signature) {
            toast({
                title: '驗證失敗',
                description: '請完成手寫簽名後再提交',
                variant: 'destructive'
            })
            return
        }

        setIsSubmitting(true)
        try {
            // 模擬提交延遲
            await new Promise(resolve => setTimeout(resolve, 1000))
            setFormResult({
                signature: signature.substring(0, 50) + '...',
                timestamp: new Date().toLocaleString(),
                status: 'Success'
            })
            toast({
                title: '測試提交成功',
                description: '簽章資料已成功獲取',
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    // 實作 Cloudinary 上傳功能
    const handleUpload = async (blob: Blob): Promise<string> => {
        try {
            const file = new File([blob], `signature_${Date.now()}.png`, { type: 'image/png' })
            const formData = new FormData()
            
            // 雲端資料夾路徑
            formData.append('folder', 'signatures')
            formData.append('file', file)
            formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '')
            
            const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
                { method: 'POST', body: formData }
            )

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.message || '上傳失敗')
            }

            const data = await response.json()
            return data.secure_url
        } catch (error: any) {
            console.error('Cloudinary upload error:', error)
            throw error
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <FormHeader title="test" themeColor="bg-blue-600">
                <BackButton />
            </FormHeader>

            <main className="max-w-2xl mx-auto p-6 space-y-6">
                {/* 測試說明 */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-xl flex gap-3">
                    <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div className="text-sm text-amber-800 dark:text-amber-200">
                        <p className="font-bold mb-1">測試頁面說明：</p>
                        <p>此頁面用於測試新開發的 <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded text-xs font-mono">SignatureInput</code> 元件。測試完成後可直接刪除此目錄。</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <Card className="shadow-lg border-none">
                        <CardHeader>
                            <CardTitle className="text-xl">簽署測試表單</CardTitle>
                            <CardDescription>請嘗試在下方區域進行手寫簽名</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* 示範與 FormField 整合 */}
                            <FormField 
                                label="確認簽章" 
                                required 
                                tooltip="此簽名將作為審核依據"
                                touched={!!signature}
                                error={!signature ? '尚未完成簽名' : ''}
                            >
                                <SignatureInput 
                                    value={signature}
                                    onChange={setSignature}
                                    label="請簽署姓名"
                                    placeholder="點擊此處開啟簽名板"
                                    onUpload={handleUpload} // 使用真實 Cloudinary 上傳
                                />
                            </FormField>

                            <div className="pt-4">
                                <Button 
                                    type="submit" 
                                    className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all active:scale-[0.98]"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? '提交測試中...' : '提交簽署資料'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </form>

                {/* 測試結果顯示 */}
                {formResult && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xl border border-green-100 dark:border-green-900/30"
                    >
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-bold mb-4">
                            <CheckCircle2 className="w-5 h-5" />
                            提交結果回報
                        </div>
                        <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-2 py-2 border-b border-slate-100 dark:border-slate-800">
                                <span className="text-slate-500 text-sm">簽章預覽</span>
                                <div className="col-span-2">
                                    <img src={signature} alt="Result" className="max-h-20 bg-slate-50 rounded p-1" />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 py-2 border-b border-slate-100 dark:border-slate-800 text-sm">
                                <span className="text-slate-500">簽章資料 (前50字)</span>
                                <span className="col-span-2 font-mono text-xs break-all text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-1 rounded">{formResult.signature}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 py-2 text-sm">
                                <span className="text-slate-500">完成時間</span>
                                <span className="col-span-2 text-slate-700 dark:text-slate-300">{formResult.timestamp}</span>
                            </div>
                        </div>
                    </motion.div>
                )}

                <div className="flex justify-center py-10">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <AlertTriangle className="w-3 h-3" />
                        <span>測試頁面將於開發確認後移除</span>
                    </div>
                </div>
            </main>
        </div>
    )
}
