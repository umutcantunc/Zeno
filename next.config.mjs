/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Next.js 14'te doğru anahtar: serverComponentsExternalPackages
    // openai ve @anthropic-ai/sdk webpack tarafından bundle edilmemeli
    serverComponentsExternalPackages: ['openai', '@anthropic-ai/sdk'],
  },
}

export default nextConfig
