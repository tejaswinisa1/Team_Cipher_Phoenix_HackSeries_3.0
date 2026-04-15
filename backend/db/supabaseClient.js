/**
 * supabaseClient.js
 * Single shared Supabase client instance for the backend.
 * Uses the service-role key so all DB operations bypass RLS.
 */

const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error(
    'Missing Supabase environment variables.\n' +
    '  Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY\n' +
    '  Fix:\n' +
    '    1. Go to https://supabase.com → your project → Settings → API\n' +
    '    2. Copy "Project URL" → SUPABASE_URL\n' +
    '    3. Copy "service_role" key → SUPABASE_SERVICE_ROLE_KEY\n' +
    '    4. Add both to backend/.env and restart the server'
  );
}

const supabase = createClient(url, key, {
  auth: { persistSession: false }
});

module.exports = supabase;
