// Register Client Component - handles user registration
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, UserPlus, Eye, EyeOff, Mail, Lock, User, Building, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { createClient } from '@/lib/supabase/client'
import { registerSchema, type RegisterFormValues } from '@/lib/validations/schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'

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

export default function RegisterClient() {
    const router = useRouter()
    const supabase = createClient()

    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<RegisterFormValues>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            unit: '',
            user_name: '',
            user_account: '',
            password: '',
            confirmPassword: '',
            email: '',
        }
    })

    const watchPassword = watch('password')

    const onSubmit = async (data: RegisterFormValues) => {
        setError(null)

        try {
            // 1. Create auth user in Supabase
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: data.email,
                password: data.password,
                options: {
                    emailRedirectTo: `${window.location.origin}/login`,
                    data: {
                        user_name: data.user_name,
                        user_account: data.user_account,
                        unit: data.unit,
                    }
                }
            })

            if (authError) {
                if (authError.message.includes('already registered')) {
                    setError('此 Email 已被註冊')
                } else {
                    setError(authError.message)
                }
                return
            }

            // 2. Insert user record into users table
            if (authData.user) {
                const { error: insertError } = await supabase
                    .from('users')
                    .insert({
                        id: authData.user.id,
                        unit: data.unit,
                        user_name: data.user_name,
                        user_account: data.user_account,
                        email: data.email,
                        role: 'staff', // Default role
                        is_active: true,
                        failed_login_attempts: 0,
                    })

                if (insertError) {
                    console.error('Insert user error:', insertError)
                    // Don't show this error to user, auth was successful
                }
            }

            // Show success message
            setSuccess(true)

        } catch (err: any) {
            setError(err.message || '註冊失敗，請稍後再試')
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
                            <CardTitle className="text-2xl font-black text-slate-800">
                                註冊成功！
                            </CardTitle>
                            <CardDescription className="text-slate-500">
                                我們已發送驗證信至您的 Email，請點擊信中連結完成驗證。
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="text-center">
                            <p className="text-sm text-slate-500 mb-6">
                                若未收到驗證信，請檢查垃圾郵件資料夾。
                            </p>
                            <Button
                                onClick={() => router.push('/login')}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 rounded-xl shadow-lg shadow-blue-200"
                            >
                                前往登入頁面
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
                        <div className="mx-auto w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-200">
                            <UserPlus className="w-8 h-8 text-white" />
                        </div>
                        <CardTitle className="text-2xl font-black text-slate-800">
                            建立帳號
                        </CardTitle>
                        <CardDescription className="text-slate-500">
                            工務室電子白板管理系統
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
                            {/* Unit */}
                            <div className="space-y-2">
                                <Label htmlFor="unit" className="text-slate-700 font-bold">
                                    單位 <span className="text-red-500">*</span>
                                </Label>
                                <div className="relative">
                                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        id="unit"
                                        type="text"
                                        placeholder="例如：工務室"
                                        className="pl-10"
                                        {...register('unit')}
                                    />
                                </div>
                                {errors.unit && (
                                    <p className="text-red-500 text-xs">{errors.unit.message}</p>
                                )}
                            </div>

                            {/* User Name */}
                            <div className="space-y-2">
                                <Label htmlFor="user_name" className="text-slate-700 font-bold">
                                    姓名 <span className="text-red-500">*</span>
                                </Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        id="user_name"
                                        type="text"
                                        placeholder="請輸入姓名"
                                        className="pl-10"
                                        {...register('user_name')}
                                    />
                                </div>
                                {errors.user_name && (
                                    <p className="text-red-500 text-xs">{errors.user_name.message}</p>
                                )}
                            </div>

                            {/* User Account */}
                            <div className="space-y-2">
                                <Label htmlFor="user_account" className="text-slate-700 font-bold">
                                    帳號 <span className="text-red-500">*</span>
                                </Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        id="user_account"
                                        type="text"
                                        placeholder="請輸入帳號"
                                        className="pl-10"
                                        {...register('user_account')}
                                    />
                                </div>
                                {errors.user_account && (
                                    <p className="text-red-500 text-xs">{errors.user_account.message}</p>
                                )}
                            </div>

                            {/* Email */}
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-slate-700 font-bold">
                                    Email <span className="text-red-500">*</span>
                                </Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
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

                            {/* Password */}
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-slate-700 font-bold">
                                    密碼 <span className="text-red-500">*</span>
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
                                    確認密碼 <span className="text-red-500">*</span>
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
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-6 rounded-xl shadow-lg shadow-emerald-200"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    '建立帳號'
                                )}
                            </Button>
                        </form>
                    </CardContent>

                    <CardFooter className="flex flex-col gap-3 text-center text-sm pt-0">
                        <div className="text-slate-500">
                            已經有帳號？{' '}
                            <Link href="/login" className="text-blue-600 hover:underline font-medium">
                                登入
                            </Link>
                        </div>
                    </CardFooter>
                </Card>
            </motion.div>
        </div>
    )
}
