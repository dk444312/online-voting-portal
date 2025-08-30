
import type { SupabaseClient } from '@supabase/supabase-js';

// Supabase is loaded from a CDN script in index.html
declare const supabase: {
  createClient: <T>(url: string, key: string) => SupabaseClient<T>;
};

const supabaseUrl = 'https://ycjhhdhalisencahifsq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljamhoZGhhbGlzZW5jYWhpZnNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNjgyMTIsImV4cCI6MjA3MDY0NDIxMn0.wRDFiWOAZWKD8ztSeCE2hKlKndtg1XXa2b6C0HIPI_s';

export const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
