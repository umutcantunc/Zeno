-- =============================================
-- Zeno — User Profile Columns
-- =============================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS full_name        TEXT,
  ADD COLUMN IF NOT EXISTS age              INTEGER CHECK (age > 0 AND age < 120),
  ADD COLUMN IF NOT EXISTS gender           TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not')),
  ADD COLUMN IF NOT EXISTS country          TEXT DEFAULT 'TR',
  ADD COLUMN IF NOT EXISTS personality_mode TEXT DEFAULT 'zeno'
    CHECK (personality_mode IN ('zeno', 'dost', 'koc', 'bilge', 'dinleyici'));

-- memory tablosu (premium hafıza özelliği için)
CREATE TABLE IF NOT EXISTS public.memory_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  category    TEXT DEFAULT 'genel',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_items_user_id ON public.memory_items(user_id);

ALTER TABLE public.memory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memory_items: kendi kayıtları" ON public.memory_items
  FOR ALL USING (auth.uid() = user_id);
