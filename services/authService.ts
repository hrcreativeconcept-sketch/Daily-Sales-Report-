
import { supabase } from './supabaseClient';
import { loadReports, saveReport, getDeviceId } from './storageService';

export const getCurrentUser = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user || null;
};

export const signIn = async (email: string, pass: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });
  if (error) throw error;
  
  // After successful sign in, migrate any guest data on this device to the user
  if (data.session?.user) {
    await migrateGuestDataToUser(data.session.user.id);
  }
  
  return data;
};

export const signUp = async (email: string, pass: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password: pass,
  });
  if (error) throw error;

  // If auto-login happens (depends on Supabase config), migrate data
  if (data.session?.user) {
    await migrateGuestDataToUser(data.session.user.id);
  }

  return data;
};

export const signOut = async () => {
  await supabase.auth.signOut();
};

/**
 * Migration Logic:
 * Finds all reports on this device that do NOT belong to a user yet,
 * and tags them with the new userId.
 */
export const migrateGuestDataToUser = async (userId: string) => {
  const deviceId = getDeviceId();
  
  // 1. Fetch all reports visible to this device (using the raw query logic from storageService essentially)
  // We reuse loadReports, but we need to know we are in a transition state.
  // Actually, simplest way: Fetch all reports, check if they have deviceId but NO user tag.
  
  // We can't use loadReports() directly because it might already be using the userId filter now that we are logged in.
  // We need a raw fetch here.
  
  const { data: reports } = await supabase
    .from('daily_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (!reports) return;

  const updates = [];

  for (const row of reports) {
    // Parse sources
    let sources: string[] = [];
    if (Array.isArray(row.sources)) {
      sources = row.sources;
    } else if (typeof row.sources === 'string') {
      try { sources = JSON.parse(row.sources); } catch {}
    }

    const hasDeviceTag = sources.includes(`device:${deviceId}`);
    const hasUserTag = sources.some(s => s.startsWith('user:'));
    const alreadyHasThisUser = sources.includes(`user:${userId}`);

    // If it belongs to this device and doesn't belong to the user yet
    if (hasDeviceTag && !alreadyHasThisUser) {
        const newSources = [...sources, `user:${userId}`];
        updates.push({
            ...row,
            sources: newSources
        });
    }
  }

  // Perform updates
  // Supabase doesn't support bulk update easily with different values, so we loop (it's client side migration, usually small amount of data for guest)
  for (const update of updates) {
      await supabase.from('daily_reports').upsert(update);
  }
};
