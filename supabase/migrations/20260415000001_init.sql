-- =============================================
-- Zeno — Initial Schema
-- =============================================

-- USERS: auth.users ile senkronize profil tablosu
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CONVERSATIONS: Bir kullanıcıya ait sohbet oturumları
CREATE TABLE IF NOT EXISTS public.conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'Yeni Sohbet',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- MESSAGES: Sohbet mesajları
CREATE TABLE IF NOT EXISTS public.messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role             TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content          TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- MOOD_LOGS: Günlük ruh hali kayıtları
CREATE TABLE IF NOT EXISTS public.mood_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  score       SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_mood_logs_user_id ON public.mood_logs(user_id);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE public.users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_logs   ENABLE ROW LEVEL SECURITY;

-- users: sadece kendi kaydını görebilir / güncelleyebilir
CREATE POLICY "users: kendi kaydı" ON public.users
  FOR ALL USING (auth.uid() = id);

-- conversations: sadece kendi sohbetlerini görebilir
CREATE POLICY "conversations: kendi sohbetleri" ON public.conversations
  FOR ALL USING (auth.uid() = user_id);

-- messages: sadece kendi sohbetlerindeki mesajları görebilir
CREATE POLICY "messages: kendi mesajları" ON public.messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

-- mood_logs: sadece kendi kayıtlarını görebilir
CREATE POLICY "mood_logs: kendi kayıtları" ON public.mood_logs
  FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- TRIGGER: Yeni auth kullanıcısı → users tablosuna ekle
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
