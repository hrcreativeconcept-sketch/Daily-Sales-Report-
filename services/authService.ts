
import { supabase } from './supabaseClient';
import { getDeviceId } from './storageService';

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

  if (data.session?.user) {
    await migrateGuestDataToUser(data.session.user.id);
  }

  return data;
};

export const signOut = async () => {
  await supabase.auth.signOut();
};

export const migrateGuestDataToUser = async (userId: string) => {
  const deviceId = getDeviceId();
  
  // Fetch all reports visible to this device that don't belong to a user yet
  const { data: reports } = await supabase
    .from('daily_reports')
    .select('*')
    .contains('sources', [`device:${deviceId}`]);

  if (!reports) return;

  for (const row of reports) {
    let sources: string[] = Array.isArray(row.sources) ? row.sources : [];
    
    // If user is not already in sources
    if (!sources.includes(userId)) {
        // Add raw UUID and prefixed version for RLS compatibility
        const newSources = [...sources, userId, `user:${userId}`];
        // Note: This upsert might fail if the policy doesn't allow anon updates,
        // but it is the standard path after signIn.
        await supabase.from('daily_reports').upsert({
            ...row,
            sources: newSources
        }, { onConflict: 'report_id' });
    }
  }
};
