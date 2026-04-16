import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { SYSTEM_PROMPT } from '@/lib/systemPrompt'

export async function POST(request: NextRequest) {
  try {
    const { message, conversationId, history = [] } = await request.json()

    const anthropic = new Anthropic({
      apiKey: process.env.ZENO_ANTHROPIC_KEY!,
    })

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Mesaj boş olamaz' }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Oturum açmış kullanıcı varsa mesajı kaydet
    let activeConversationId = conversationId

    if (user) {
      // Conversation yoksa oluştur
      if (!activeConversationId) {
        const { data: conv } = await supabase
          .from('conversations')
          .insert({ user_id: user.id, title: message.slice(0, 60) })
          .select('id')
          .single()
        activeConversationId = conv?.id
      }

      if (activeConversationId) {
        // Kullanıcı mesajını kaydet
        await supabase.from('messages').insert({
          conversation_id: activeConversationId,
          role: 'user',
          content: message,
        })
      }
    }

    // Geçmiş mesajları Anthropic formatına çevir
    const messages: Anthropic.MessageParam[] = [
      ...history.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ]

    // Claude'u çağır
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    })

    const reply = response.content[0].type === 'text' ? response.content[0].text : ''

    // Assistant cevabını kaydet
    if (user && activeConversationId) {
      await supabase.from('messages').insert({
        conversation_id: activeConversationId,
        role: 'assistant',
        content: reply,
      })
    }

    return NextResponse.json({
      reply,
      conversationId: activeConversationId,
    })
  } catch (error) {
    console.error('[chat/route] hata:', error)
    return NextResponse.json({ error: 'Bir sorun oluştu, lütfen tekrar dene.' }, { status: 500 })
  }
}
