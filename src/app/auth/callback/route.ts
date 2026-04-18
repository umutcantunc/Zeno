import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    // Redirect response'u ÖNCE oluştur — setAll bu response'a yazar
    const response = NextResponse.redirect(`${origin}${next}`)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            // Cookie'leri doğrudan redirect response'a yaz
            // (cookieStore'a yazmak yetmez — NextResponse.redirect yeni bir response nesnesidir)
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return response  // auth cookie'leri artık bu response'da
    }

    console.error('[Callback] exchangeCodeForSession error:', error)
  }

  // Hata durumunda login'e gönder
  return NextResponse.redirect(`${origin}/auth/login?error=oauth`)
}
