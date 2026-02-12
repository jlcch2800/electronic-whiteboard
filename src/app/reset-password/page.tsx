// Reset Password Page
import { Suspense } from 'react'
import ResetPasswordClient from './ResetPasswordClient'
import { Loader2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

// Loading fallback component
function ResetPasswordLoading() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-slate-500">載入中...</p>
            </div>
        </div>
    )
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<ResetPasswordLoading />}>
            <ResetPasswordClient />
        </Suspense>
    )
}
