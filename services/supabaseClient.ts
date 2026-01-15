
import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Configuration
 * Prioritizes environment variables (e.g., from Vercel) over hardcoded fallbacks.
 */
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ofscoeyvrdnkgpyvjgqp.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mc2NvZXl2cmRua2dweXZqZ3FwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MjYwMzYsImV4cCI6MjA4MDAwMjAzNn0.N32WPXMzrinxYsqW-Zs4xTwNGS42vfuAYVmCKH0GbYM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
