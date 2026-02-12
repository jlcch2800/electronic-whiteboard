// Vendor Work History Page
import { Suspense } from 'react'
import VendorHistoryClient from './VendorHistoryClient'
import { Loader2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

function LoadingFallback() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-slate-500">載入中...</p>
            </div>
        </div>
    )
}

export default function VendorHistoryPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <VendorHistoryClient />
        </Suspense>
    )
}
