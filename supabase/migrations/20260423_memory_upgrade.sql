-- ============================================================
-- Zeno Hafıza Sistemi v2 — Memory Upgrade Migration
-- Tarih: 2026-04-23
-- Supabase SQL Editor'da çalıştır
-- ============================================================

-- 1. memory_items tablosuna yeni kolonlar ekle
ALTER TABLE public.memory_items ADD COLUMN IF NOT EXISTS memory_type text DEFAULT 'event';
ALTER TABLE public.memory_items ADD COLUMN IF NOT EXISTS event_date date;
ALTER TABLE public.memory_items ADD COLUMN IF NOT EXISTS importance text DEFAULT 'normal';
ALTER TABLE public.memory_items ADD COLUMN IF NOT EXISTS source_conversation_id uuid;

-- 2. Mevcut kayıtları 'event' olarak işaretle
UPDATE public.memory_items
SET memory_type = 'event'
WHERE memory_type IS NULL OR memory_type = '';

-- 3. Performans index'leri
CREATE INDEX IF NOT EXISTS memory_items_memory_type_idx ON public.memory_items(memory_type);
CREATE INDEX IF NOT EXISTS memory_items_importance_idx  ON public.memory_items(importance);
CREATE INDEX IF NOT EXISTS memory_items_event_date_idx  ON public.memory_items(event_date);

-- 4. personality_profiles tablosunu oluştur
CREATE TABLE IF NOT EXISTS public.personality_profiles (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES public.users(id) ON DELETE CASCADE,
  traits     jsonb DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone DEFAULT now()
);

-- 5. RLS
ALTER TABLE public.personality_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "personality: kendi kaydı"
  ON public.personality_profiles
  FOR ALL
  USING (auth.uid() = user_id);

-- 6. Index
CREATE INDEX IF NOT EXISTS personality_profiles_user_id_idx ON public.personality_profiles(user_id);
