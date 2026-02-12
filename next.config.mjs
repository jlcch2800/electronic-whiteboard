/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
        // 在生產環境 build 時忽略 ESLint 警告
        ignoreDuringBuilds: true,
    },
    typescript: {
        // 暫時忽略 TS 錯誤以便快速開發
        ignoreBuildErrors: true,
    },
};

export default nextConfig;
