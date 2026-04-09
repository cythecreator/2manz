import { User } from './types'

type SupabaseClient = ReturnType<typeof import('./supabase/client').createClient>

/** Returns the IDs of all accepted 2mans for a given user */
export async function get2ManIds(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('two_man_links')
    .select('user1_id, user2_id')
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .eq('status', 'accepted')
  if (!data) return []
  return data.map(link => link.user1_id === userId ? link.user2_id : link.user1_id)
}

/** Returns full User objects for all accepted 2mans of a given user */
export async function get2Mans(supabase: SupabaseClient, userId: string): Promise<User[]> {
  const ids = await get2ManIds(supabase, userId)
  if (ids.length === 0) return []
  const { data } = await supabase
    .from('users')
    .select('*')
    .in('id', ids)
  return (data as User[]) || []
}

/**
 * Attach two_mans arrays to a list of profiles in one batch.
 * Avoids N+1 by loading all relevant links and users in 2 queries.
 */
export async function attachTwoMans<T extends User>(
  supabase: SupabaseClient,
  profiles: T[]
): Promise<(T & { two_mans: User[] })[]> {
  if (profiles.length === 0) return profiles.map(p => ({ ...p, two_mans: [] }))

  const profileIds = profiles.map(p => p.id)

  // Fetch all accepted links where either side is one of our profiles
  const { data: links } = await supabase
    .from('two_man_links')
    .select('user1_id, user2_id')
    .or(`user1_id.in.(${profileIds.join(',')}),user2_id.in.(${profileIds.join(',')})`)
    .eq('status', 'accepted')

  if (!links || links.length === 0) {
    return profiles.map(p => ({ ...p, two_mans: [] }))
  }

  // Collect all partner IDs we need to look up
  const partnerIds = new Set<string>()
  for (const link of links) {
    if (profileIds.includes(link.user1_id)) partnerIds.add(link.user2_id)
    if (profileIds.includes(link.user2_id)) partnerIds.add(link.user1_id)
  }

  // Fetch partner profiles (excluding ones already in our profiles list)
  const extraIds = Array.from(partnerIds).filter(id => !profileIds.includes(id))
  const allUsers = new Map<string, User>(profiles.map(p => [p.id, p]))

  if (extraIds.length > 0) {
    const { data: partnerProfiles } = await supabase
      .from('users')
      .select('*')
      .in('id', extraIds)
    for (const u of partnerProfiles || []) {
      allUsers.set(u.id, u as User)
    }
  }

  // Build a map: profileId → [partnerUser, ...]
  const twoMansMap = new Map<string, User[]>()
  for (const link of links) {
    const { user1_id, user2_id } = link
    if (profileIds.includes(user1_id)) {
      const partner = allUsers.get(user2_id)
      if (partner) {
        const existing = twoMansMap.get(user1_id) || []
        twoMansMap.set(user1_id, [...existing, partner])
      }
    }
    if (profileIds.includes(user2_id)) {
      const partner = allUsers.get(user1_id)
      if (partner) {
        const existing = twoMansMap.get(user2_id) || []
        twoMansMap.set(user2_id, [...existing, partner])
      }
    }
  }

  return profiles.map(p => ({ ...p, two_mans: twoMansMap.get(p.id) || [] }))
}
