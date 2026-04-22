import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { getSystemPrompt, type PersonalityMode, type UserProfile } from '@/lib/systemPrompt'

export async function POST(request: NextRequest) {
  try {
    const {
      message,
      conversationId,
      history = [],
      mode = 'zeno',
      profile,
    }: {
      message: string
      conversationId?: string
      history: { role: string; content: string }[]
      mode?: PersonalityMode
      profile?: UserProfile
    } = await request.json()

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Mesaj boş olamaz' }, { status: 400 })
    }

    const anthropic = new Anthropic({ apiKey: process.env.ZENO_ANTHROPIC_KEY! })
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let resolvedProfile: UserProfile | undefined = profile
    let resolvedMode: PersonalityMode = mode

    if (user) {
      const { data: dbUser } = await supabase
        .from('users')
        .select('full_name, age, gender, country, personality_mode')
        .eq('id', user.id)
        .single()
      if (dbUser) {
        if (!resolvedProfile) {
          resolvedProfile = {
            name: dbUser.full_name,
            age: dbUser.age,
            gender: dbUser.gender,
            country: dbUser.country,
          }
        }
        if (mode === 'zeno' && dbUser.personality_mode) {
          resolvedMode = dbUser.personality_mode as PersonalityMode
        }
      }
    }

    // Gelişmiş hafıza entegrasyonu
    let memoryContext = ''
    if (user) {
      const [memoriesRes, profileRes] = await Promise.all([
        supabase
          .from('memory_items')
          .select('content, memory_type, importance, event_date')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('personality_profiles')
          .select('traits')
          .eq('user_id', user.id)
          .maybeSingle(),
      ])

      const allMemories = memoriesRes.data ?? []
      const events      = allMemories.filter((m) => !m.memory_type || m.memory_type === 'event')
      const preferences = allMemories.filter((m) => m.memory_type === 'preference')
      const traits: { trait: string; evidence: string }[] = profileRes.data?.traits ?? []

      if (events.length > 0 || traits.length > 0 || preferences.length > 0) {
        memoryContext = '\n\nKULLANICI HAKKINDA BİLDİKLERİN:'

        if (events.length > 0) {
          memoryContext += '\n\nÖNEMLİ OLAYLAR:'
          memoryContext += events.slice(0, 10).map((m) => {
            const dateStr   = m.event_date ? `[${m.event_date}] ` : ''
            const importStr = m.importance === 'critical' ? ' (kritik)' : m.importance === 'high' ? ' (önemli)' : ''
            return `\n- ${dateStr}${m.content}${importStr}`
          }).join('')
        }

        if (traits.length > 0) {
          memoryContext += '\n\nKİŞİLİK PROFİLİ:'
          memoryContext += traits.map((t) => `\n- ${t.trait}`).join('')
        }

        if (preferences.length > 0) {
          memoryContext += '\n\nTERCİHLER:'
          memoryContext += preferences.slice(0, 5).map((p) => `\n- ${p.content}`).join('')
        }

        memoryContext += '\n\nBu bilgileri konuşmada doğal olarak kullan. Sürekli tekrar etme. Sadece ilgili olduğunda referans ver.'
      }
    }

    const systemPrompt = getSystemPrompt(resolvedMode, resolvedProfile) + memoryContext

    let activeConversationId = conversationId
    if (user) {
      if (!activeConversationId) {
        const title = message.slice(0, 40).trim()
        const { data: conv } = await supabase
          .from('conversations')
          .insert({ user_id: user.id, title, mode: resolvedMode })
          .select('id')
          .single()
        activeConversationId = conv?.id
      }
      if (activeConversationId) {
        await supabase.from('messages').insert({
          conversation_id: activeConversationId,
          role: 'user',
          content: message,
        })
      }
    }

    const messages: Anthropic.MessageParam[] = [
      ...history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ]

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    })

    const reply = response.content[0].type === 'text' ? response.content[0].text : ''

    if (user && activeConversationId) {
      await supabase.from('messages').insert({
        conversation_id: activeConversationId,
        role: 'assistant',
        content: reply,
      })
    }

    return NextResponse.json({ reply, conversationId: activeConversationId })
  } catch (error) {
    console.error('[chat/route] hata:', error)
    return NextResponse.json({ error: 'Bir sorun oluştu, lütfen tekrar dene.' }, { status: 500 })
  }
}
