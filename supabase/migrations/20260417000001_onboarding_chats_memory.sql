-- onboarding_completed kolonu users tablosuna
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

-- conversations tablosuna title ve mode kolonları
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS mode text DEFAULT 'zeno';

-- memory_items tablosuna category kolonu (yoksa ekle)
ALTER TABLE public.memory_items ADD COLUMN IF NOT EXISTS category text DEFAULT 'genel';

-- Mevcut conversations için mode default değer
UPDATE public.conversations SET mode = 'zeno' WHERE mode IS NULL;
