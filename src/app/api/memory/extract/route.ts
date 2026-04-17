import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { lastExchange } = await request.json()
    if (!lastExchange) return NextResponse.json({ saved: false })

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ saved: false })

    const anthropic = new Anthropic({ apiKey: process.env.ZENO_ANTHROPIC_KEY! })

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `Aşağıdaki kullanıcı-asistan konuşma alışverişinden, kullanıcı hakkında kalıcı olarak hatırlanması gereken somut bir bilgi var mı?

Eğer varsa şu JSON formatında döndür (sadece JSON, başka hiçbir şey):
{"category":"is"|"aile"|"saglik"|"iliski"|"hedef"|"kaygi"|"genel","content":"kullanıcı hakkında tek cümle bilgi"}

Eğer hatırlanmaya değer somut bir bilgi yoksa sadece null döndür.

Konuşma:
${lastExchange}`
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : 'null'
    if (!text || text === 'null') return NextResponse.json({ saved: false })

    let parsed: { category: string; content: string }
    try {
      parsed = JSON.parse(text)
    } catch {
      return NextResponse.json({ saved: false })
    }

    if (!parsed?.content || !parsed?.category) return NextResponse.json({ saved: false })

    // Duplicate check - same content already saved?
    const { data: existing } = await supabase
      .from('memory_items')
      .select('id')
      .eq('user_id', user.id)
      .eq('content', parsed.content)
      .single()
    if (existing) return NextResponse.json({ saved: false })

    await supabase.from('memory_items').insert({
      user_id: user.id,
      content: parsed.content,
      category: parsed.category,
    })

    return NextResponse.json({ saved: true })
  } catch {
    return NextResponse.json({ saved: false })
  }
}
