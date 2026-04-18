/** @type {import('next').NextConfig} */
const nextConfig = {
  // openai ve @anthropic-ai/sdk sunucu tarafında bundle edilmemeli
  // (native modüller ve dinamik import içerirler — Vercel'de bundling hatası verir)
  serverExternalPackages: ['openai', '@anthropic-ai/sdk'],
}

export default nextConfig
