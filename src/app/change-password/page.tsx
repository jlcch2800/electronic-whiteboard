// Change Password Page
import { Suspense } from 'react'
import ChangePasswordClient from './ChangePasswordClient'
import { Loader2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

// Loading fallback component
function ChangePasswordLoading() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-muted-foreground">載入中...</p>
            </div>
        </div>
    )
}

export default function ChangePasswordPage() {
    return (
        <Suspense fallback={<ChangePasswordLoading />}>
            <ChangePasswordClient />
        </Suspense>
    )
}
