import { SettingsManager } from '@/components/admin/catalog-manager'
import { BusinessHoursPanel } from '@/components/admin/business-hours-panel'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'
import { requireOwnerOrDeveloper } from '@/lib/permissions/server'

export default async function SettingsPage() {
  const { supabase } = await requireOwnerOrDeveloper()
  let settings: Tables<'business_settings'> | null = null
  let hours: Tables<'business_hours'>[] = []
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const [settingsResult, hoursResult] = await Promise.all([supabase.from('business_settings').select('*').limit(1).maybeSingle(), supabase.from('business_hours').select('*').order('day_of_week')])
    settings = settingsResult.data
    hours = hoursResult.data ?? []
  }
  return <><SettingsManager initialSettings={settings} /><BusinessHoursPanel initialHours={hours} /></>
}

export const dynamic = 'force-dynamic'
