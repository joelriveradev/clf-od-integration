import { createClient } from 'jsr:@supabase/supabase-js@2'
import { type Database } from '@/lib/supabase/types/database.types.ts'

export const supabase = createClient<Database>(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_API_KEY')!
)
