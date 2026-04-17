export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const since = new Date()
    since.setDate(since.getDate() - 7)
    since.setHours(0, 0, 0, 0)

    // Son 7 günün konuşmalarını al
    const { data: convs } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', user.id)
      .gte('created_at', since.toISOString())

    let messageText = ''
    if (convs && convs.length > 0) {
      const convIds = convs.map((c) => c.id)
      const { data: msgs } = await supabase
        .from('messages')
        .select('content')
        .in('conversation_id', convIds)
        .eq('role', 'user')
        .order('created_at', { ascending: true })
        .limit(40)
      if (msgs) messageText = msgs.map((m) => m.content).join('\n')
    }

    // Son 7 günün mood logları
    const { data: moodLogs } = await supabase
      .from('mood_logs')
      .select('score')
      .eq('user_id', user.id)
      .gte('created_at', since.toISOString())

    const avgMood =
      moodLogs && moodLogs.length > 0
        ? (moodLogs.reduce((s, l) => s + l.score, 0) / moodLogs.length).toFixed(1)
        : null

    if (!messageText && !avgMood) {
      return NextResponse.json({
        summary: 'Bu hafta henüz yeterli veri yok. Zeno ile konuştukça haftalık özet oluşmaya başlar.',
        avgMood: null,
      })
    }

    const anthropic = new Anthropic({ apiKey: process.env.ZENO_ANTHROPIC_KEY! })

    const prompt = `Bu kullanıcının son 7 günlük Zeno konuşmalarından kısa, kişisel bir haftalık özet yaz. 3-4 cümle. Türkçe. Sıcak ama profesyonel ton. İsimle hitap etme.${avgMood ? ` Haftalık ortalama ruh hali skoru: ${avgMood}/10.` : ''}

Kullanıcının bu haftaki mesajları:
${messageText || '(Bu hafta mesaj yok)'}

Özeti yaz:`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })

    const summary = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

    return NextResponse.json({ summary, avgMood })
  } catch (error) {
    console.error('[weekly-summary]', error)
    return NextResponse.json({ error: 'Bir sorun oluştu' }, { status: 500 })
  }
}
