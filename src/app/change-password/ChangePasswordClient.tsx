// Change Password Client Component
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Lock, Eye, EyeOff, ShieldCheck, CheckCircle2, AlertCircle, XCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import * as z from 'zod'

import { createClient } from '@/lib/supabase/client'
import { hashPassword } from '@/lib/crypto'
import { useAppStore } from '@/stores/useAppStore'
import Navbar from '@/components/Navbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

// Password strength schema
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

// Change password form schema
const changePasswordSchema = z.object({
    password: passwordSchema,
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: '密碼不一致',
    path: ['confirmPassword'],
})

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>

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
                    <div key={i} className={`flex items-center gap-1 ${check.test ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {check.test ? (
                            <CheckCircle2 className="w-3 h-3" />
                        ) : (
                            <XCircle className="w-3 h-3" />
                        )}
                        <span>{check.label}</span>
                    </div>
                ))}
            </div>
            <p className="text-xs text-muted-foreground">
                <AlertCircle className="w-3 h-3 inline mr-1" />
                需符合至少 3 項條件
            </p>
        </motion.div>
    )
}

export default function ChangePasswordClient() {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()
    const { profile } = useAppStore()

    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<ChangePasswordFormValues>({
        resolver: zodResolver(changePasswordSchema),
        defaultValues: {
            password: '',
            confirmPassword: '',
        }
    })

    const watchPassword = watch('password')

    if (!profile) {
        return (
            <div className="min-h-screen bg-background flex flex-col">
                <Navbar />
                <div className="flex-1 flex flex-col items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
                    <p className="text-muted-foreground">檢查登入狀態...</p>
                </div>
            </div>
        )
    }

    const onSubmit = async (data: ChangePasswordFormValues) => {
        setError(null)
        try {
            const hashedPassword = await hashPassword(data.password)

            const { error: updateError } = await supabase.auth.updateUser({
                password: hashedPassword
            })

            if (updateError) {
                setError(updateError.message)
                return
            }

            setSuccess(true)
            toast({
                title: "密碼修改成功",
                description: "您的密碼已經成功更新",
                variant: "default",
            })

            // Return to home page after a short delay
            setTimeout(() => {
                router.push('/')
            }, 2000)

        } catch (err: any) {
            setError(err.message || '修改密碼失敗，請稍後再試')
        }
    }

    // Success state
    if (success) {
        return (
            <div className="min-h-screen bg-background flex flex-col">
                <Navbar />
                <div className="flex-1 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4 }}
                    >
                        <Card className="w-full max-w-md shadow-2xl border-0">
                            <CardHeader className="space-y-1 text-center pb-8 border-b border-border/50">
                                <div className="mx-auto w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-green-200">
                                    <CheckCircle2 className="w-8 h-8 text-white" />
                                </div>
                                <CardTitle className="text-2xl font-black text-foreground">
                                    密碼修改成功！
                                </CardTitle>
                                <CardDescription className="text-muted-foreground">
                                    系統即將跳轉回首頁...
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="text-center pt-6">
                                <Button
                                    onClick={() => router.push('/')}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 rounded-xl shadow-lg shadow-blue-200"
                                >
                                    立即返回首頁
                                </Button>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Navbar />
            <div className="flex-1 flex items-center justify-center p-4 bg-slate-50/50 dark:bg-background">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="w-full max-w-md"
                >
                    <Card className="shadow-2xl border-0 overflow-hidden">
                        <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-500 w-full" />
                        <CardHeader className="space-y-1 text-center pb-6 bg-card">
                            <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-2">
                                <ShieldCheck className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                            </div>
                            <CardTitle className="text-2xl font-black text-foreground">
                                修改密碼
                            </CardTitle>
                            <CardDescription className="text-muted-foreground">
                                保護您的帳戶，請設定一組高強度的密碼
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="bg-card">
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm font-medium flex items-start gap-2"
                                >
                                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                    <span>{error}</span>
                                </motion.div>
                            )}

                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                                {/* New Password */}
                                <div className="space-y-2">
                                    <Label htmlFor="password" className="text-foreground/80 font-bold">
                                        新密碼 <span className="text-red-500">*</span>
                                    </Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="••••••••"
                                            className="pl-10 pr-10 bg-muted/30 focus-visible:bg-background"
                                            {...register('password')}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground/70"
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
                                    <Label htmlFor="confirmPassword" className="text-foreground/80 font-bold">
                                        確認新密碼 <span className="text-red-500">*</span>
                                    </Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            id="confirmPassword"
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            placeholder="••••••••"
                                            className="pl-10 pr-10 bg-muted/30 focus-visible:bg-background"
                                            {...register('confirmPassword')}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground/70"
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
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 rounded-xl shadow-lg shadow-blue-200 mt-2"
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        '儲存新密碼'
                                    )}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    )
}
