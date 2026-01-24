import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Au build, les variables peuvent ne pas être dispo - on retourne un client placeholder
  if (!supabaseUrl || !supabaseKey) {
    // En mode client (browser), c'est une vraie erreur
    if (typeof window !== 'undefined') {
      throw new Error('Missing Supabase environment variables. Please check your .env.local file.')
    }
    // En mode serveur/build, on retourne un client factice qui sera recréé au runtime
    return createBrowserClient(
      'https://placeholder.supabase.co',
      'placeholder-key'
    )
  }

  return createBrowserClient(supabaseUrl, supabaseKey)
}
