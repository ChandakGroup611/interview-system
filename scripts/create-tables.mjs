import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://sfssqkegqkytcryhqgxy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmc3Nxa2VncWt5dGNyeWhxZ3h5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzY4NTc4OCwiZXhwIjoyMDkzMjYxNzg4fQ.vUVu6W92e_mq9gySKpeGf0-q0KtR8rcPL3OG3cw8_aU'
);

async function checkTable(name) {
  const { error } = await supabase.from(name).select('id').limit(1);
  if (error && error.code === '42P01') {
    return false;
  }
  return true;
}

async function run() {
  console.log('Checking tables...');

  const emailLogsExists = await checkTable('email_logs');
  console.log(`email_logs: ${emailLogsExists ? '✅ exists' : '❌ missing'}`);

  const adminLogsExists = await checkTable('admin_login_logs');
  console.log(`admin_login_logs: ${adminLogsExists ? '✅ exists' : '❌ missing'}`);

  if (!emailLogsExists || !adminLogsExists) {
    console.log('\n⚠️  Missing tables detected. Please run the following SQL in Supabase Dashboard > SQL Editor:\n');
    
    if (!emailLogsExists) {
      console.log(`CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_name TEXT NOT NULL,
  session_id UUID,
  status TEXT NOT NULL,
  error_message TEXT DEFAULT NULL,
  attempt_number INTEGER DEFAULT 1,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_logs_session ON email_logs(session_id);
`);
    }
    
    if (!adminLogsExists) {
      console.log(`CREATE TABLE IF NOT EXISTS admin_login_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  ip_address TEXT DEFAULT 'unknown',
  user_agent TEXT DEFAULT 'unknown',
  session_token TEXT DEFAULT '',
  logged_in_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_login_logs_user ON admin_login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_login_logs_time ON admin_login_logs(logged_in_at);
`);
    }
  } else {
    console.log('\n✅ All tables exist!');
  }
}

run().catch(console.error);
