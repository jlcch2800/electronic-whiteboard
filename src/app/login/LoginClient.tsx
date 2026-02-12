// Login Client Component - handles useSearchParams which requires Suspense
'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, LogIn, Eye, EyeOff, Mail, Lock } from 'lucide-react'
import { motion } from 'framer-motion'

import { createClient } from '@/lib/supabase/client'
import { loginSchema, type LoginFormValues } from '@/lib/validations/schemas'
import { checkUserLockStatus, handleLoginSuccess, handleLoginFailure } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'

export default function LoginClient() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const redirect = searchParams.get('redirect') || '/'
    const supabase = createClient()

    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isLockedOut, setIsLockedOut] = useState(false)

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: '',
            password: '',
        }
    })

    const handleEmailBlur = async (email: string) => {
        if (!email) return
        try {
            const status = await checkUserLockStatus(email)
            if (status.isLocked) {
                setIsLockedOut(true)
                setError(status.message)
            }
        } catch (error) {
            console.error('Error checking lock status:', error)
        }
    }

    const onSubmit = async (data: LoginFormValues) => {
        setError(null)
        setIsLockedOut(false)

        try {
            // 1. Check if user is locked BEFORE trying to sign in
            const lockStatus = await checkUserLockStatus(data.email)
            if (lockStatus.isLocked) {
                setError('帳號或密碼錯誤次數過多，目前無法輸入')
                setIsLockedOut(true)
                return
            }

            // 2. Attempt Sign In
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: data.email,
                password: data.password,
            })

            // 3. Handle Result
            if (authError) {
                if (authError.message.includes('Invalid login credentials')) {
                    // Log failure and check for new lock status
                    const result = await handleLoginFailure(data.email)
                    if (result?.isLocked) {
                        setError('帳號或密碼錯誤次數過多，目前無法輸入')
                        setIsLockedOut(true)
                    } else {
                        setError('帳號或密碼錯誤')
                    }
                } else if (authError.message.includes('Email not confirmed')) {
                    setError('Email 尚未驗證，請檢查信箱')
                } else {
                    setError(authError.message)
                }
                return
            }

            // 4. Handle Success
            if (authData.user) {
                await handleLoginSuccess(authData.user.id, data.email)
            }

            // Hard navigation to ensure auth state is properly loaded
            window.location.href = redirect
        } catch (err: any) {
            console.error('Login error:', err)
            setError(err.message || '登入失敗，請稍後再試')
        }
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
                        <div className="mx-auto w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
                            <LogIn className="w-8 h-8 text-white" />
                        </div>
                        <CardTitle className="text-2xl font-black text-slate-800">
                            登入系統
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
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-slate-700 font-bold">
                                    Email
                                </Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="name@example.com"
                                        className="pl-10"
                                        {...register('email', {
                                            onChange: () => {
                                                // Always unlock when user is typing to allow correction
                                                if (isLockedOut) {
                                                    setIsLockedOut(false)
                                                    setError(null)
                                                }
                                            },
                                            onBlur: (e) => {
                                                // Check lock status when user finishes typing
                                                handleEmailBlur(e.target.value)
                                            }
                                        })}
                                    />
                                </div>
                                {errors.email && (
                                    <p className="text-red-500 text-xs">{errors.email.message}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-slate-700 font-bold">
                                    密碼
                                </Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        className="pl-10 pr-10"
                                        {...register('password')}
                                        disabled={isLockedOut}
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
                            </div>

                            <Button
                                type="submit"
                                disabled={isSubmitting || isLockedOut}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 rounded-xl shadow-lg shadow-blue-200"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    '登入'
                                )}
                            </Button>
                        </form>
                    </CardContent>

                    <CardFooter className="flex flex-col gap-3 text-center text-sm pt-0">
                        <Link
                            href="/forgot-password"
                            className="text-blue-600 hover:underline font-medium"
                        >
                            忘記密碼？
                        </Link>
                        <div className="text-slate-500">
                            還沒有帳號？{' '}
                            <Link href="/register" className="text-blue-600 hover:underline font-medium">
                                建立帳號
                            </Link>
                        </div>
                    </CardFooter>
                </Card>
            </motion.div>
        </div>
    )
}
