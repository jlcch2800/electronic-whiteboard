// Reset Password Client Component - handles actual password reset
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, ShieldCheck, Eye, EyeOff, Lock, CheckCircle2, XCircle, AlertCircle, ArrowLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import * as z from 'zod'

import { createClient } from '@/lib/supabase/client'
import { hashPassword } from '@/lib/crypto'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'

// Password strength schema (same as register)
const passwordSchema = z.string()
    .min(8, '密碼至少需要8個字元')
    .refine((val) => {
        let count = 0
        if (/[a-z]/.test(val)) count++
        if (/[A-Z]/.test(val)) count++
        if (/[0-9]/.test(val)) count++
        if (/[!@#$%^&*(),.?":{}|<>]/.test(val)) count++
        return count >= 3
    }, '密碼需包含至少3種：大寫、小寫、數字、特殊符號')

// Reset password form schema
const resetPasswordSchema = z.object({
    password: passwordSchema,
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: '密碼不一致',
    path: ['confirmPassword'],
})

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>

// Password strength indicator component
function PasswordStrength({ password }: { password: string }) {
    const checks = [
        { label: '至少 8 個字元', test: password.length >= 8 },
        { label: '包含小寫字母', test: /[a-z]/.test(password) },
        { label: '包含大寫字母', test: /[A-Z]/.test(password) },
        { label: '包含數字', test: /[0-9]/.test(password) },
        { label: '包含特殊符號', test: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
    ]

    const passedCount = checks.filter(c => c.test).length
    const strengthLevel = passedCount <= 2 ? 'weak' : passedCount <= 3 ? 'medium' : 'strong'
    const strengthColors = {
        weak: 'bg-red-500',
        medium: 'bg-yellow-500',
        strong: 'bg-green-500'
    }
    const strengthLabels = {
        weak: '弱',
        medium: '中',
        strong: '強'
    }

    if (!password) return null

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 space-y-2"
        >
            {/* Strength bar */}
            <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(passedCount / 5) * 100}%` }}
                        className={`h-full ${strengthColors[strengthLevel]} transition-colors`}
                    />
                </div>
                <span className={`text-xs font-medium ${strengthLevel === 'weak' ? 'text-red-600' :
                    strengthLevel === 'medium' ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                    {strengthLabels[strengthLevel]}
                </span>
            </div>

            {/* Checklist */}
            <div className="grid grid-cols-2 gap-1 text-xs">
                {checks.map((check, i) => (
                    <div key={i} className={`flex items-center gap-1 ${check.test ? 'text-green-600' : 'text-slate-400'}`}>
                        {check.test ? (
                            <CheckCircle2 className="w-3 h-3" />
                        ) : (
                            <XCircle className="w-3 h-3" />
                        )}
                        <span>{check.label}</span>
                    </div>
                ))}
            </div>
            <p className="text-xs text-slate-500">
                <AlertCircle className="w-3 h-3 inline mr-1" />
                需符合至少 3 項條件
            </p>
        </motion.div>
    )
}

export default function ResetPasswordClient() {
    const router = useRouter()
    const supabase = createClient()

    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [isValidSession, setIsValidSession] = useState<boolean | null>(null)

    const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<ResetPasswordFormValues>({
        resolver: zodResolver(resetPasswordSchema),
        defaultValues: {
            password: '',
            confirmPassword: '',
        }
    })

    const watchPassword = watch('password')

    // Check if user has a valid reset session
    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            // For password reset flow, Supabase creates a temporary session
            setIsValidSession(!!session)
        }
        checkSession()
    }, [supabase])

    const onSubmit = async (data: ResetPasswordFormValues) => {
        setError(null)

        try {
            // SHA-256 + Key-stretching 前端預處理
            const hashedPassword = await hashPassword(data.password)

            const { error: updateError } = await supabase.auth.updateUser({
                password: hashedPassword
            })

            if (updateError) {
                setError(updateError.message)
                return
            }

            // Sign out after password reset
            await supabase.auth.signOut()
            setSuccess(true)

        } catch (err: any) {
            setError(err.message || '重設密碼失敗，請稍後再試')
        }
    }

    // Loading state
    if (isValidSession === null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <p className="text-slate-500">驗證中...</p>
                </div>
            </div>
        )
    }

    // Invalid session - show error
    if (!isValidSession) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                >
                    <Card className="w-full max-w-md shadow-2xl border-0">
                        <CardHeader className="space-y-1 text-center pb-8">
                            <div className="mx-auto w-16 h-16 bg-red-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-red-200">
                                <XCircle className="w-8 h-8 text-white" />
                            </div>
                            <CardTitle className="text-2xl font-black text-slate-800">
                                連結已失效
                            </CardTitle>
                            <CardDescription className="text-slate-500">
                                重設密碼連結已過期或無效，請重新申請
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="text-center">
                            <Link href="/forgot-password">
                                <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-6 rounded-xl shadow-lg shadow-amber-200">
                                    重新申請重設密碼
                                </Button>
                            </Link>
                            <Link href="/login" className="block mt-4 text-blue-600 hover:underline font-medium">
                                返回登入頁面
                            </Link>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        )
    }

    // Success state - password was reset
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
                            <CardTitle className="text-2xl font-black text-slate-800">
                                密碼重設成功！
                            </CardTitle>
                            <CardDescription className="text-slate-500">
                                您的密碼已成功更新，請使用新密碼登入
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="text-center">
                            <Button
                                onClick={() => router.push('/login')}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 rounded-xl shadow-lg shadow-blue-200"
                            >
                                前往登入
                            </Button>
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
                    <CardHeader className="space-y-1 text-center pb-6">
                        <div className="mx-auto w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
                            <ShieldCheck className="w-8 h-8 text-white" />
                        </div>
                        <CardTitle className="text-2xl font-black text-slate-800">
                            重設密碼
                        </CardTitle>
                        <CardDescription className="text-slate-500">
                            請輸入您的新密碼
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
                            {/* New Password */}
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-slate-700 font-bold">
                                    新密碼 <span className="text-red-500">*</span>
                                </Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        className="pl-10 pr-10"
                                        {...register('password')}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {errors.password && (
                                    <p className="text-red-500 text-xs">{errors.password.message}</p>
                                )}
                                <AnimatePresence>
                                    <PasswordStrength password={watchPassword || ''} />
                                </AnimatePresence>
                            </div>

                            {/* Confirm Password */}
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword" className="text-slate-700 font-bold">
                                    確認新密碼 <span className="text-red-500">*</span>
                                </Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        id="confirmPassword"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        className="pl-10 pr-10"
                                        {...register('confirmPassword')}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {errors.confirmPassword && (
                                    <p className="text-red-500 text-xs">{errors.confirmPassword.message}</p>
                                )}
                            </div>

                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 rounded-xl shadow-lg shadow-blue-200"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    '確認重設密碼'
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
