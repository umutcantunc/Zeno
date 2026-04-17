import { createClient } from '@/lib/supabase/server'

export type SubscriptionTier = 'free' | 'premium' | 'pro'

export interface UserSubscription {
  tier: SubscriptionTier
  isAdmin: boolean
  expiresAt: string | null
  isPremiumOrAbove: boolean
  isPro: boolean
}

/**
 * Server-side subscription lookup (for API routes / Server Components).
 * Admin kullanıcılar her zaman tüm özelliklere erişebilir.
 */
export async function getUserSubscription(userId: string): Promise<UserSubscription> {
  const supabase = createClient()
  const { data } = await supabase
    .from('users')
    .select('subscription_tier, subscription_expires_at, is_admin')
    .eq('id', userId)
    .single()

  const isAdmin = data?.is_admin ?? false
  const expiresAt = data?.subscription_expires_at ?? null
  let tier = (data?.subscription_tier as SubscriptionTier) ?? 'free'

  // Süresi dolan abonelikleri free'ye düşür
  if (tier !== 'free' && expiresAt && new Date(expiresAt) < new Date()) {
    tier = 'free'
  }

  const isPremiumOrAbove = isAdmin || tier === 'premium' || tier === 'pro'
  const isPro = isAdmin || tier === 'pro'

  return { tier, isAdmin, expiresAt, isPremiumOrAbove, isPro }
}

/** Kullanıcı premium veya üstü bir planda mı? (admin dahil) */
export async function isPremium(userId: string): Promise<boolean> {
  const { isPremiumOrAbove } = await getUserSubscription(userId)
  return isPremiumOrAbove
}

/** Kullanıcı pro planında mı? (admin dahil) */
export async function isPro(userId: string): Promise<boolean> {
  const { isPro } = await getUserSubscription(userId)
  return isPro
}

/** Kullanıcı admin mi? */
export async function isAdmin(userId: string): Promise<boolean> {
  const { isAdmin } = await getUserSubscription(userId)
  return isAdmin
}
