import { v2 as cloudinary } from 'cloudinary'
import { NextResponse } from 'next/server'

// 設定 Cloudinary 組態
cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
})

/**
 * 從 Cloudinary URL 中提取 public_id
 * @param url 網址
 * @param resourceType 資源類型 (image, video, raw)
 */
function getPublicIdFromUrl(url: string, resourceType: string) {
    try {
        const decodedUrl = decodeURIComponent(url)
        const parts = decodedUrl.split('/')
        const uploadIndex = parts.indexOf('upload')
        if (uploadIndex === -1) return null

        // 取得 vXXXXX 之後的所有部分 (即路徑 + 檔名)
        const publicIdWithExt = parts.slice(uploadIndex + 2).join('/')
        
        // 重要：'raw' 類型的 public_id 必須包含副檔名才能刪除
        if (resourceType === 'raw') {
            return publicIdWithExt
        }

        // 'image' 或 'video' 類型則移除副檔名
        const lastDotIndex = publicIdWithExt.lastIndexOf('.')
        return lastDotIndex === -1 ? publicIdWithExt : publicIdWithExt.substring(0, lastDotIndex)
    } catch (error) {
        console.error('解析 public_id 失敗:', error)
        return null
    }
}

/**
 * 從 Cloudinary URL 中提取 resource_type
 */
function getResourceTypeFromUrl(url: string) {
    if (url.includes('/video/upload/')) return 'video'
    if (url.includes('/raw/upload/')) return 'raw'
    return 'image'
}

export async function POST(request: Request) {
    try {
        const { urls, folder } = await request.json()

        // 模式 A: 刪除特定檔案 (用 urls)
        if (urls && Array.isArray(urls) && urls.length > 0) {
            const results = await Promise.all(
                urls.map(async (url) => {
                    const resourceType = getResourceTypeFromUrl(url)
                    const publicId = getPublicIdFromUrl(url, resourceType)
                    if (!publicId) return { url, status: 'invalid' }

                    try {
                        const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
                        return { url, publicId, result }
                    } catch (err: any) {
                        return { url, publicId, error: err.message }
                    }
                })
            )
            return NextResponse.json({ success: true, results })
        }

        // 模式 B: 刪除整個資料夾 (用 folder 路徑)
        if (folder) {
            // 注意：刪除資料夾前必須先刪除其中的資源
            // 這裡使用 delete_resources_by_prefix 來刪除該路徑下的所有類型資源
            const prefix = folder.replace(/^\/+|\/+$/g, '') + '/'
            
            const [resImage, resVideo, resRaw] = await Promise.all([
                cloudinary.api.delete_resources_by_prefix(prefix, { resource_type: 'image' }),
                cloudinary.api.delete_resources_by_prefix(prefix, { resource_type: 'video' }),
                cloudinary.api.delete_resources_by_prefix(prefix, { resource_type: 'raw' }),
            ])

            // 刪除資源後，再嘗試刪除空資料夾
            try {
                await cloudinary.api.delete_folder(folder)
            } catch (e) {
                // 資料夾可能還有其他子資料夾，刪除失敗沒關係
            }

            return NextResponse.json({ success: true, folder, details: { resImage, resVideo, resRaw } })
        }

        return NextResponse.json({ error: 'Missing urls or folder parameter' }, { status: 400 })

    } catch (error: any) {
        console.error('Cloudinary 刪除 API 錯誤:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
