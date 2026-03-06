// Register Client Component - 單欄佈局：上方院徽、中間表單、下方建築物圖（50% 透明度）
'use client'

import { useState, useEffect, forwardRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, UserPlus, Eye, EyeOff, Mail, Lock, User, Building, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { createClient } from '@/lib/supabase/client'
import { registerSchema, type RegisterFormValues } from '@/lib/validations/schemas'
import { hashPassword } from '@/lib/crypto'
import { loadRecaptchaScript, executeRecaptcha, verifyRecaptchaToken } from '@/lib/recaptcha'
import { Button } from '@/components/ui/button'

// ===== 浮動標籤輸入框元件 =====
const FloatingInput = forwardRef<HTMLInputElement, {
    id: string; label: string; type?: string; icon: React.ElementType; error?: string; required?: boolean
    endAdornment?: React.ReactNode; disabled?: boolean; name: string
    onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}>(({ id, label, type = 'text', icon: Icon, error, required, endAdornment, disabled, name, onBlur, onChange }, ref) => {
    const [focused, setFocused] = useState(false)
    const [hasValue, setHasValue] = useState(false)
    const isFloating = focused || hasValue

    return (
        <div className="relative">
            <Icon className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 z-10 transition-colors duration-200 ${focused ? 'text-emerald-500' : 'text-muted-foreground'}`} />
            <label htmlFor={id}
                className={`absolute left-10 z-10 pointer-events-none transition-all duration-200 ease-out origin-left
                    ${isFloating ? 'top-1 text-[11px] font-semibold ' + (focused ? 'text-emerald-500' : 'text-muted-foreground') : 'top-1/2 -translate-y-1/2 text-sm text-muted-foreground'}`}>
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <input ref={ref} id={id} name={name} type={type} disabled={disabled}
                className={`w-full pl-10 pr-10 pt-5 pb-2 rounded-xl border bg-white/80 backdrop-blur-sm text-sm text-foreground outline-none transition-all duration-200
                    ${focused ? 'border-emerald-400 ring-2 ring-emerald-100 shadow-md' : 'border-border hover:border-slate-300'}
                    ${error ? 'border-red-400 ring-2 ring-red-100' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                onFocus={() => setFocused(true)}
                onBlur={(e) => { setFocused(false); setHasValue(!!e.target.value); onBlur?.(e) }}
                onChange={(e) => { setHasValue(!!e.target.value); onChange?.(e) }}
            />
            {endAdornment && <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">{endAdornment}</div>}
            <AnimatePresence>
                {error && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="text-red-500 text-xs mt-1 ml-1">{error}</motion.p>}
            </AnimatePresence>
        </div>
    )
})
FloatingInput.displayName = 'FloatingInput'

// ===== 密碼強度指示器 =====
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
    const strengthColors = { weak: 'bg-red-500', medium: 'bg-yellow-500', strong: 'bg-green-500' }
    const strengthLabels = { weak: '弱', medium: '中', strong: '強' }

    if (!password) return null
    return (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 space-y-2">
            <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${(passedCount / 5) * 100}%` }} className={`h-full ${strengthColors[strengthLevel]} transition-colors`} />
                </div>
                <span className={`text-xs font-medium ${strengthLevel === 'weak' ? 'text-red-600' : strengthLevel === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}>{strengthLabels[strengthLevel]}</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs">
                {checks.map((check, i) => (
                    <div key={i} className={`flex items-center gap-1 ${check.test ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {check.test ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        <span>{check.label}</span>
                    </div>
                ))}
            </div>
            <p className="text-xs text-muted-foreground"><AlertCircle className="w-3 h-3 inline mr-1" />需符合至少 3 項條件</p>
        </motion.div>
    )
}

// ===== 主元件 =====
export default function RegisterClient() {
    const router = useRouter()
    const supabase = createClient()

    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<RegisterFormValues>({
        resolver: zodResolver(registerSchema),
        defaultValues: { unit: '', user_name: '', user_account: '', password: '', confirmPassword: '', email: '' }
    })
    const watchPassword = watch('password')

    useEffect(() => { loadRecaptchaScript().catch(console.error) }, [])

    const onSubmit = async (data: RegisterFormValues) => {
        setError(null)
        try {
            const recaptchaToken = await executeRecaptcha('register')
            if (recaptchaToken) {
                const captchaResult = await verifyRecaptchaToken(recaptchaToken, 'register')
                if (!captchaResult.success) { setError('人機驗證失敗，請重試'); return }
            }
            const hashedPassword = await hashPassword(data.password)
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: data.email, password: hashedPassword,
                options: { emailRedirectTo: `${window.location.origin}/login`, data: { user_name: data.user_name, user_account: data.user_account, unit: data.unit } }
            })
            if (authError) { setError(authError.message.includes('already registered') ? '此 Email 已被註冊' : authError.message); return }
            if (authData.user) {
                const { error: insertError } = await supabase.from('users').insert({
                    id: authData.user.id, unit: data.unit, user_name: data.user_name,
                    user_account: data.user_account, email: data.email, role: 'staff', is_active: true, failed_login_attempts: 0,
                })
                if (insertError) console.error('Insert user error:', insertError)
            }
            setSuccess(true)
        } catch (err: any) { setError(err.message || '註冊失敗，請稍後再試') }
    }

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 p-4">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="w-full max-w-md">
                    <div className="text-center bg-white rounded-2xl shadow-2xl border border-border/50 p-10">
                        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-700 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-green-200/70">
                            <CheckCircle2 className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-black text-foreground mb-2">註冊成功！</h2>
                        <p className="text-muted-foreground text-sm mb-2">我們已發送驗證信至您的 Email，請點擊信中連結完成驗證。</p>
                        <p className="text-xs text-muted-foreground mb-6">若未收到驗證信，請檢查垃圾郵件資料夾。</p>
                        <Button onClick={() => router.push('/login')} className="auth-submit-btn w-full text-white font-bold py-6 rounded-xl shadow-lg shadow-blue-200/70 text-base">前往登入頁面</Button>
                    </div>
                </motion.div>
            </div>
        )
    }

    const unitReg = register('unit')
    const userNameReg = register('user_name')
    const userAccountReg = register('user_account')
    const emailReg = register('email')
    const passwordReg = register('password')
    const confirmPasswordReg = register('confirmPassword')

    return (
        <div className="login-page min-h-screen flex flex-col relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
            {/* ===== 建築物背景圖（極低透明度） ===== */}
            <div className="absolute inset-0 z-0">
                <Image
                    src="https://res.cloudinary.com/dzup404bt/image/upload/v1772528645/buliding_exterior_cch_za5gzz.jpg"
                    alt=""
                    fill
                    className="object-cover object-center opacity-[0.12]"
                    priority
                    aria-hidden="true"
                />
            </div>

            {/* ===== 頁面內容 ===== */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 relative z-10">
                {/* 院徽 */}
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-4">
                    <Image src="https://res.cloudinary.com/dzup404bt/image/upload/v1770888486/%E5%85%AC%E5%8F%B8%E5%90%8D%E7%A8%B1_sms2oc.png"
                        alt="佳里奇美醫院" width={240} height={86} className="object-contain" priority />
                </motion.div>

                {/* 表單卡片 */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="w-full max-w-[420px]">
                    <div className="text-center mb-5">
                        <div className="mx-auto w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-emerald-200/70">
                            <UserPlus className="w-7 h-7 text-white" />
                        </div>
                        <h1 className="text-2xl font-black text-foreground mb-1">建立帳號</h1>
                        <p className="text-muted-foreground text-sm">工務室電子白板管理系統</p>
                    </div>

                    <AnimatePresence>
                        {error && (
                            <motion.div initial={{ opacity: 0, scale: 0.95, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -8 }}
                                className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />{error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
                        <FloatingInput id="unit" label="單位" icon={Building} error={errors.unit?.message} required ref={unitReg.ref} name={unitReg.name} onBlur={unitReg.onBlur} onChange={unitReg.onChange} />
                        <FloatingInput id="user_name" label="姓名" icon={User} error={errors.user_name?.message} required ref={userNameReg.ref} name={userNameReg.name} onBlur={userNameReg.onBlur} onChange={userNameReg.onChange} />
                        <FloatingInput id="user_account" label="帳號" icon={User} error={errors.user_account?.message} required ref={userAccountReg.ref} name={userAccountReg.name} onBlur={userAccountReg.onBlur} onChange={userAccountReg.onChange} />
                        <FloatingInput id="email" label="Email" type="email" icon={Mail} error={errors.email?.message} required ref={emailReg.ref} name={emailReg.name} onBlur={emailReg.onBlur} onChange={emailReg.onChange} />
                        <div>
                            <FloatingInput id="password" label="密碼" type={showPassword ? 'text' : 'password'} icon={Lock} error={errors.password?.message} required
                                ref={passwordReg.ref} name={passwordReg.name} onBlur={passwordReg.onBlur} onChange={passwordReg.onChange}
                                endAdornment={<button type="button" onClick={() => setShowPassword(!showPassword)} className="text-muted-foreground hover:text-foreground/70 transition-colors p-0.5" tabIndex={-1}>{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>}
                            />
                            <AnimatePresence><PasswordStrength password={watchPassword || ''} /></AnimatePresence>
                        </div>
                        <FloatingInput id="confirmPassword" label="確認密碼" type={showConfirmPassword ? 'text' : 'password'} icon={Lock} error={errors.confirmPassword?.message} required
                            ref={confirmPasswordReg.ref} name={confirmPasswordReg.name} onBlur={confirmPasswordReg.onBlur} onChange={confirmPasswordReg.onChange}
                            endAdornment={<button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="text-muted-foreground hover:text-foreground/70 transition-colors p-0.5" tabIndex={-1}>{showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>}
                        />
                        <Button type="submit" disabled={isSubmitting} className="auth-submit-btn-green w-full text-white font-bold py-6 rounded-xl shadow-lg shadow-emerald-200/70 text-base mt-2">
                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="flex items-center gap-2"><UserPlus className="w-4 h-4" />建立帳號</span>}
                        </Button>
                    </form>

                    <div className="mt-5 text-center text-sm text-muted-foreground">
                        已經有帳號？{' '}<Link href="/login" className="text-blue-600 hover:text-blue-700 hover:underline font-semibold transition-colors">登入</Link>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
