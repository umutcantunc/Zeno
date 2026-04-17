import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: NextRequest) {
  try {
    const { zenoMessage } = await request.json()

    // Soru işareti yoksa boş döndür
    if (!zenoMessage || !zenoMessage.includes('?')) {
      return NextResponse.json({ suggestions: [] })
    }

    const anthropic = new Anthropic({ apiKey: process.env.ZENO_ANTHROPIC_KEY! })

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: `Zeno şunu sordu: "${zenoMessage}"

Kullanıcının verebileceği 3 kısa, doğal, birbirinden farklı cevap seçeneği üret.
- Her biri maksimum 6 kelime
- Gerçekçi ve konuya özel olsun, genel kalıplar olmasın
- Türkçe yaz

Sadece JSON array döndür, başka hiçbir şey ekleme:
["seçenek1", "seçenek2", "seçenek3"]`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]'

    let suggestions: string[] = []
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) suggestions = parsed.slice(0, 3)
    } catch {
      suggestions = []
    }

    return NextResponse.json({ suggestions })
  } catch {
    return NextResponse.json({ suggestions: [] })
  }
}
