import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Zeno — Zihin Koçunuz',
  description: 'AI destekli mental sağlık asistanı. Türkiye\'deki profesyoneller için kişiselleştirilmiş zihin koçluğu.',
  keywords: ['mental sağlık', 'zihin koçu', 'psikoloji', 'AI', 'Türkiye'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
