import { motion } from 'framer-motion'

export function SkeletonTable() {
    return (
        <div className="space-y-4 p-4 animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-6">
                <div className="h-8 bg-muted rounded-md w-48 animate-pulse" />
                <div className="h-10 bg-muted rounded-md w-32 animate-pulse" />
            </div>
            <div className="space-y-3">
                <div className="h-12 bg-muted/50 rounded-md animate-pulse" />
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-16 bg-muted/30 rounded-md animate-pulse" />
                ))}
            </div>
        </div>
    )
}
