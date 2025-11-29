import { createClient } from '@supabase/supabase-js';

// Security Note: 
// In a production environment, ensure your Supabase database has Row Level Security (RLS) enabled.
// These keys are "Anon" keys, meaning they are safe to expose on the client ONLY IF
// your database policies restrict what anonymous users can do.

// Helper to safely get env vars in browser without crashing if process is undefined
const getEnv = (key: string, defaultVal: string) => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return defaultVal;
};

const SUPABASE_URL = getEnv('SUPABASE_URL', 'https://ofscoeyvrdnkgpyvjgqp.supabase.co');
const SUPABASE_ANON_KEY = getEnv('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mc2NvZXl2cmRua2dweXZqZ3FwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MjYwMzYsImV4cCI6MjA4MDAwMjAzNn0.N32WPXMzrinxYsqW-Zs4xTwNGS42vfuAYVmCKH0GbYM');

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);