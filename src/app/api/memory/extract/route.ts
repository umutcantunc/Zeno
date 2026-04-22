import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

interface ExtractedData {
  events:      { content: string; importance: 'critical' | 'high' | 'normal'; event_date: string | null }[]
  personality: { trait: string; evidence: string }[]
  preferences: { content: string }[]
}

interface MemoryNotification {
  type:    'critical' | 'event' | 'personality' | 'preference'
  content: string
}

export async function POST(request: NextRequest) {
  try {
    const { lastExchange, conversationId } = await request.json()
    if (!lastExchange) return NextResponse.json({ saved: false })

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ saved: false })

    const anthropic = new Anthropic({ apiKey: process.env.ZENO_ANTHROPIC_KEY! })

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `Şu konuşmayı analiz et ve şunları çıkar:
1. ÖNEMLİ OLAYLAR: Kullanıcının hayatında olan somut olaylar (ayrılık, kayıp, iş değişikliği, hastalık, başarı, sınav, taşınma vb.)
2. KİŞİLİK İPUÇLARI: Kullanıcının karakter özellikleri, eğilimleri, değerleri
3. TERCİHLER: Konuşma tarzı, neleri sever/sevmez, nasıl yardım almak ister

JSON formatında döndür (başka hiçbir şey yazma, sadece JSON):
{
  "events": [{"content": "string", "importance": "critical"|"high"|"normal", "event_date": "YYYY-MM-DD"|null}],
  "personality": [{"trait": "string", "evidence": "string"}],
  "preferences": [{"content": "string"}]
}

Önem seviyeleri:
- critical: Ölüm, ayrılık, ciddi hastalık, iş kaybı gibi hayatı etkileyen olaylar
- high: Önemli kararlar, büyük değişiklikler
- normal: Günlük olaylar, küçük gelişmeler

Eğer hiçbir kategori için kayda değer bir şey yoksa ilgili array'i boş bırak. Sadece JSON döndür.

Konuşma:
${lastExchange}`,
      }],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    if (!rawText) return NextResponse.json({ saved: false })

    let extracted: ExtractedData
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      extracted = JSON.parse(jsonMatch ? jsonMatch[0] : rawText)
    } catch {
      return NextResponse.json({ saved: false })
    }

    const { events = [], personality = [], preferences = [] } = extracted
    if (!events.length && !personality.length && !preferences.length) {
      return NextResponse.json({ saved: false })
    }

    let topNotification: MemoryNotification | null = null

    // ── 1. Events ────────────────────────────────────────────────────
    for (const event of events) {
      if (!event.content?.trim()) continue

      const { data: existing } = await supabase
        .from('memory_items')
        .select('id')
        .eq('user_id', user.id)
        .eq('content', event.content.trim())
        .maybeSingle()
      if (existing) continue

      await supabase.from('memory_items').insert({
        user_id:                user.id,
        content:                event.content.trim(),
        category:               'olay',
        memory_type:            'event',
        importance:             event.importance ?? 'normal',
        event_date:             event.event_date ?? null,
        source_conversation_id: conversationId ?? null,
      })

      // En kritik olay bildirimi kazanır
      if (!topNotification || event.importance === 'critical') {
        topNotification = {
          type:    event.importance === 'critical' ? 'critical' : 'event',
          content: event.content.trim(),
        }
      }
    }

    // ── 2. Personality ──────────────────────────────────────────────
    if (personality.length > 0) {
      const { data: profile } = await supabase
        .from('personality_profiles')
        .select('id, traits')
        .eq('user_id', user.id)
        .maybeSingle()

      const existingTraits: { trait: string; evidence: string }[] = profile?.traits ?? []
      const existingNames = existingTraits.map((t) => t.trait.toLowerCase().trim())
      const newTraits = personality.filter((p) => p.trait?.trim() && !existingNames.includes(p.trait.toLowerCase().trim()))

      if (newTraits.length > 0) {
        const updatedTraits = [...existingTraits, ...newTraits]

        if (profile?.id) {
          await supabase
            .from('personality_profiles')
            .update({ traits: updatedTraits, updated_at: new Date().toISOString() })
            .eq('id', profile.id)
        } else {
          await supabase
            .from('personality_profiles')
            .insert({ user_id: user.id, traits: updatedTraits })
        }

        if (!topNotification) {
          topNotification = { type: 'personality', content: 'Zeno seni biraz daha tanıdı' }
        }
      }
    }

    // ── 3. Preferences ──────────────────────────────────────────────
    for (const pref of preferences) {
      if (!pref.content?.trim()) continue

      const { data: existing } = await supabase
        .from('memory_items')
        .select('id')
        .eq('user_id', user.id)
        .eq('content', pref.content.trim())
        .maybeSingle()
      if (existing) continue

      await supabase.from('memory_items').insert({
        user_id:                user.id,
        content:                pref.content.trim(),
        category:               'tercih',
        memory_type:            'preference',
        importance:             'normal',
        source_conversation_id: conversationId ?? null,
      })

      if (!topNotification) {
        topNotification = { type: 'preference', content: pref.content.trim() }
      }
    }

    if (!topNotification) return NextResponse.json({ saved: false })
    return NextResponse.json({ saved: true, notification: topNotification })

  } catch (err) {
    console.error('[memory/extract] hata:', err)
    return NextResponse.json({ saved: false })
  }
}
