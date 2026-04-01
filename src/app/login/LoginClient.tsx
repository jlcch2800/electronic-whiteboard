// Login Client Component - 單欄佈局：上方院徽、中間表單、下方建築物圖（50% 透明度）
'use client'

import { useState, useEffect, forwardRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, LogIn, Eye, EyeOff, Mail, Lock, User, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { createClient } from '@/lib/supabase/client'
import { loginSchema, type LoginFormValues } from '@/lib/validations/schemas'
import { checkUserLockStatus, handleLoginSuccess, handleLoginFailure } from '@/actions/auth'
import { hashPassword } from '@/lib/crypto'
import { loadRecaptchaScript, executeRecaptcha, verifyRecaptchaToken } from '@/lib/recaptcha'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

// ===== 浮動標籤輸入框元件 =====
const FloatingInput = forwardRef<HTMLInputElement, {
    id: string
    label: string
    type?: string
    icon: React.ElementType
    error?: string
    required?: boolean
    endAdornment?: React.ReactNode
    disabled?: boolean
    name: string
    onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
    [key: string]: any
}>(({ id, label, type = 'text', icon: Icon, error, required, endAdornment, disabled, name, onBlur, onChange, ...rest }, ref) => {
    const [focused, setFocused] = useState(false)
    const [hasValue, setHasValue] = useState(false)
    const isFloating = focused || hasValue

    return (
        <div className="relative">
            <Icon className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 z-10 transition-colors duration-200 ${focused ? 'text-blue-500' : 'text-muted-foreground'}`} />
            <label
                htmlFor={id}
                className={`absolute left-10 z-10 pointer-events-none transition-all duration-200 ease-out origin-left
                    ${isFloating
                        ? 'top-1 text-[11px] font-semibold ' + (focused ? 'text-blue-500' : 'text-muted-foreground')
                        : 'top-1/2 -translate-y-1/2 text-sm text-muted-foreground'
                    }`}
            >
                {label}
                {required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <input
                ref={ref}
                id={id}
                name={name}
                type={type}
                disabled={disabled}
                className={`w-full pl-10 pr-10 pt-5 pb-2 rounded-xl border bg-white backdrop-blur-sm
                    text-sm text-gray-900 outline-none transition-all duration-200
                    ${focused ? 'border-blue-400 ring-2 ring-blue-100 shadow-md' : 'border-border hover:border-slate-300'}
                    ${error ? 'border-red-400 ring-2 ring-red-100' : ''}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                onFocus={() => setFocused(true)}
                onBlur={(e) => { setFocused(false); setHasValue(!!e.target.value); onBlur?.(e) }}
                onChange={(e) => { setHasValue(!!e.target.value); onChange?.(e) }}
            />
            {endAdornment && <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">{endAdornment}</div>}
            <AnimatePresence>
                {error && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="text-red-500 text-xs mt-1 ml-1">
                        {error}
                    </motion.p>
                )}
            </AnimatePresence>
        </div>
    )
})
FloatingInput.displayName = 'FloatingInput'

// ===== 最近登入帳號快捷按鈕 =====
function RecentAccount({ email, onSelect, onRemove }: { email: string; onSelect: () => void; onRemove: () => void }) {
    return (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mb-5">
            <p className="text-xs text-muted-foreground mb-2 font-medium">最近登入</p>
            <button type="button" onClick={onSelect}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-white/60 backdrop-blur-sm hover:bg-blue-50/80 hover:border-blue-200 transition-all duration-200 group text-left">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-200/60">
                    <User className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-foreground/80 truncate flex-1 group-hover:text-blue-600 transition-colors">{email}</span>
                <span role="button" tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); onRemove() }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onRemove() } }}
                    className="p-1 rounded-full hover:bg-red-100 text-muted-foreground/50 hover:text-red-500 transition-colors" aria-label="移除記錄">
                    <X className="w-3.5 h-3.5" />
                </span>
            </button>
        </motion.div>
    )
}

// ===== 主元件 =====
export default function LoginClient() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const redirect = searchParams.get('redirect') || '/'
    const supabase = createClient()

    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isLockedOut, setIsLockedOut] = useState(false)
    const [rememberMe, setRememberMe] = useState(false)
    const [recentEmail, setRecentEmail] = useState<string | null>(null)

    const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: '', password: '' }
    })

    useEffect(() => {
        loadRecaptchaScript().catch(console.error)
        try {
            const saved = localStorage.getItem('remembered_email')
            if (saved) setRecentEmail(saved)
        } catch { }
    }, [])

    const handleEmailBlur = async (email: string) => {
        if (!email) return
        try {
            const status = await checkUserLockStatus(email)
            if (status.isLocked) { setIsLockedOut(true); setError(status.message) }
        } catch (error) { console.error('Error checking lock status:', error) }
    }

    const onSubmit = async (data: LoginFormValues) => {
        setError(null)
        setIsLockedOut(false)
        try {
            const recaptchaToken = await executeRecaptcha('login').catch(err => {
                console.error('[Login] reCAPTCHA 執行失敗:', err)
                return null
            })

            if (recaptchaToken) {
                const captchaResult = await verifyRecaptchaToken(recaptchaToken, 'login')
                if (!captchaResult.success) {
                    setError('人機驗證失敗，請重新嘗試。若問題持續，請檢查網路或聯繫管理員。')
                    return
                }
            } else {
                // 如果無法取得 token，可能 Site Key 有問題或是網域未授權
                console.warn('[Login] 未能取得 reCAPTCHA Token，請確認 Site Key 網域授權')
                // 為了不阻擋開發環境或其他異常情況，這裡可以選擇是否強制阻擋
                // 但依照使用者回報，目前是強制阻擋且顯示錯誤
                setError('無法初始化人機驗證，請確認您的網域已授權並排除 Site Key 錯誤。')
                return
            }
            const lockStatus = await checkUserLockStatus(data.email)
            if (lockStatus.isLocked) { setError('帳號或密碼錯誤次數過多，目前無法輸入'); setIsLockedOut(true); return }

            const hashedPassword = await hashPassword(data.password)
            let { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email: data.email, password: hashedPassword })

            if (authError?.message?.includes('Invalid login credentials')) {
                const { data: fallbackData, error: fallbackError } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password })
                if (!fallbackError && fallbackData.user) {
                    await supabase.auth.updateUser({ password: hashedPassword })
                    authData = fallbackData; authError = null
                } else { authError = fallbackError || authError }
            }

            if (authError) {
                if (authError.message.includes('Invalid login credentials')) {
                    const result = await handleLoginFailure(data.email)
                    if (result?.isLocked) { setError('帳號或密碼錯誤次數過多，目前無法輸入'); setIsLockedOut(true) }
                    else { setError('帳號或密碼錯誤') }
                } else if (authError.message.includes('Email not confirmed')) { setError('Email 尚未驗證，請檢查信箱') }
                else { setError(authError.message) }
                return
            }

            if (authData?.user) await handleLoginSuccess(authData.user.id, data.email)
            try {
                if (rememberMe) localStorage.setItem('remembered_email', data.email)
                else localStorage.removeItem('remembered_email')
            } catch { }
            window.location.href = redirect
        } catch (err: any) { console.error('Login error:', err); setError(err.message || '登入失敗，請稍後再試') }
    }

    const emailReg = register('email')
    const passwordReg = register('password')

    return (
        <div className="login-page min-h-screen flex flex-col relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
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
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 relative z-10">
                {/* 院徽 */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="mb-6"
                >
                    <Image
                        src="https://res.cloudinary.com/dzup404bt/image/upload/v1770888486/%E5%85%AC%E5%8F%B8%E5%90%8D%E7%A8%B1_sms2oc.png"
                        alt="佳里奇美醫院"
                        width={240}
                        height={86}
                        className="object-contain"
                        priority
                    />
                </motion.div>

                {/* 表單卡片 */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="w-full max-w-[420px]"
                >
                    <div className="text-center mb-6">
                        <div className="mx-auto w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-200/70">
                            <LogIn className="w-7 h-7 text-white" />
                        </div>
                        <h1 className="text-2xl font-black text-slate-800 mb-1">登入系統</h1>
                        <p className="text-slate-600 text-sm font-medium">工務室電子白板管理系統</p>
                    </div>

                    <AnimatePresence>
                        {error && (
                            <motion.div initial={{ opacity: 0, scale: 0.95, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -8 }}
                                className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                                {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <AnimatePresence>
                        {recentEmail && (
                            <RecentAccount email={recentEmail}
                                onSelect={() => setValue('email', recentEmail)}
                                onRemove={() => { setRecentEmail(null); try { localStorage.removeItem('remembered_email') } catch { } }}
                            />
                        )}
                    </AnimatePresence>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <FloatingInput id="email" label="Email" type="email" icon={Mail} error={errors.email?.message}
                            ref={emailReg.ref} name={emailReg.name}
                            onBlur={(e: React.FocusEvent<HTMLInputElement>) => { emailReg.onBlur(e); handleEmailBlur(e.target.value); if (isLockedOut) { setIsLockedOut(false); setError(null) } }}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { emailReg.onChange(e); if (isLockedOut) { setIsLockedOut(false); setError(null) } }}
                        />
                        <FloatingInput id="password" label="密碼" type={showPassword ? 'text' : 'password'} icon={Lock} error={errors.password?.message} disabled={isLockedOut}
                            ref={passwordReg.ref} name={passwordReg.name} onBlur={passwordReg.onBlur} onChange={passwordReg.onChange}
                            endAdornment={
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-muted-foreground hover:text-foreground/70 transition-colors p-0.5" tabIndex={-1}>
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            }
                        />

                        <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-2">
                                <Checkbox id="remember-me" checked={rememberMe} onCheckedChange={(checked) => setRememberMe(checked === true)}
                                    className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600" />
                                <label htmlFor="remember-me" className="text-sm text-slate-700 cursor-pointer select-none hover:text-slate-900 transition-colors">記住我</label>
                            </div>
                            <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700 hover:underline font-medium transition-colors">忘記密碼？</Link>
                        </div>

                        <Button type="submit" disabled={isSubmitting || isLockedOut} className="auth-submit-btn w-full text-white font-bold py-6 rounded-xl shadow-lg shadow-blue-200/70 text-base mt-2">
                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="flex items-center gap-2"><LogIn className="w-4 h-4" />登入</span>}
                        </Button>
                    </form>

                    <div className="mt-6 text-center text-sm text-slate-600 font-medium">
                        還沒有帳號？{' '}
                        <Link href="/register" className="text-blue-600 hover:text-blue-700 hover:underline font-semibold transition-colors">建立帳號</Link>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
