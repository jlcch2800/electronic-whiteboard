// Forgot Password Client Component - handles password reset request
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, KeyRound, Mail, CheckCircle2, ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'

import { createClient } from '@/lib/supabase/client'
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '@/lib/validations/schemas'
import { loadRecaptchaScript, executeRecaptcha, verifyRecaptchaToken } from '@/lib/recaptcha'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'

export default function ForgotPasswordClient() {
    const supabase = createClient()

    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [submittedEmail, setSubmittedEmail] = useState('')

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordFormValues>({
        resolver: zodResolver(forgotPasswordSchema),
        defaultValues: {
            email: '',
        }
    })

    // 載入 reCAPTCHA v3 Script
    useEffect(() => {
        loadRecaptchaScript().catch(console.error)
    }, [])

    const onSubmit = async (data: ForgotPasswordFormValues) => {
        setError(null)

        try {
            // 0. reCAPTCHA 驗證
            const recaptchaToken = await executeRecaptcha('forgot_password')
            if (recaptchaToken) {
                const captchaResult = await verifyRecaptchaToken(recaptchaToken, 'forgot_password')
                if (!captchaResult.success) {
                    setError('人機驗證失敗，請重試')
                    return
                }
            }

            const { error: resetError } = await supabase.auth.resetPasswordForEmail(data.email, {
                redirectTo: `${window.location.origin}/reset-password`,
            })

            if (resetError) {
                setError(resetError.message)
                return
            }

            // Show success state
            setSubmittedEmail(data.email)
            setSuccess(true)

        } catch (err: any) {
            setError(err.message || '發送失敗，請稍後再試')
        }
    }

    // Success state - show confirmation message
    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                >
                    <Card className="w-full max-w-md shadow-2xl border-0">
                        <CardHeader className="space-y-1 text-center pb-8">
                            <div className="mx-auto w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-green-200">
                                <CheckCircle2 className="w-8 h-8 text-white" />
                            </div>
                            <CardTitle className="text-2xl font-black text-foreground">
                                已發送重設密碼信件
                            </CardTitle>
                            <CardDescription className="text-muted-foreground">
                                我們已將重設密碼連結寄送至
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="text-center">
                            <p className="text-blue-600 font-semibold mb-4 break-all">
                                {submittedEmail}
                            </p>
                            <p className="text-sm text-muted-foreground mb-6">
                                請檢查您的信箱（包含垃圾郵件資料夾），點擊信中連結重設密碼。連結有效期為 5 分鐘。
                            </p>
                            <Link href="/login">
                                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 rounded-xl shadow-lg shadow-blue-200">
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    返回登入頁面
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <Card className="w-full max-w-md shadow-2xl border-0">
                    <CardHeader className="space-y-1 text-center pb-8">
                        <div className="mx-auto w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-amber-200">
                            <KeyRound className="w-8 h-8 text-white" />
                        </div>
                        <CardTitle className="text-2xl font-black text-foreground">
                            忘記密碼
                        </CardTitle>
                        <CardDescription className="text-muted-foreground">
                            輸入您的 Email，我們將寄送重設密碼連結給您
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm font-medium"
                            >
                                {error}
                            </motion.div>
                        )}

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-foreground/80 font-bold">
                                    Email
                                </Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="name@example.com"
                                        className="pl-10"
                                        {...register('email')}
                                    />
                                </div>
                                {errors.email && (
                                    <p className="text-red-500 text-xs">{errors.email.message}</p>
                                )}
                            </div>

                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-6 rounded-xl shadow-lg shadow-amber-200"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    '發送重設密碼信件'
                                )}
                            </Button>
                        </form>
                    </CardContent>

                    <CardFooter className="flex flex-col gap-3 text-center text-sm pt-0">
                        <Link
                            href="/login"
                            className="text-blue-600 hover:underline font-medium flex items-center justify-center gap-1"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            返回登入
                        </Link>
                    </CardFooter>
                </Card>
            </motion.div>
        </div>
    )
}
