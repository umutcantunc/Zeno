-- Abonelik kolonları
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Mevcut kayıtlar için varsayılan değerleri uygula
UPDATE public.users
  SET subscription_tier = 'free'
  WHERE subscription_tier IS NULL;

UPDATE public.users
  SET is_admin = false
  WHERE is_admin IS NULL;

-- Admin ve pro tier: uygulama sahibi
UPDATE public.users
  SET is_admin = true,
      subscription_tier = 'pro'
  WHERE email = 'umutcantuncc@gmail.com';
