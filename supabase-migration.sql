-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  PixelPrompt – COMPLETE Supabase SQL Migration                     ║
-- ║  Run this in: Supabase Dashboard → SQL Editor → New Query → Run    ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════════
-- STEP 1: EXTENSIONS
-- ═══════════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════════════
-- STEP 2: CREATE ALL TABLES
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. Users ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  reset_password_token TEXT,
  reset_password_expires TIMESTAMPTZ
);

-- ─── 2. Projects ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  schema JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 3. Subscriptions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT DEFAULT 'razorpay',
  status TEXT NOT NULL DEFAULT 'free',
  razorpay_customer_id TEXT,
  razorpay_subscription_id TEXT,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 4. AI Usage Tracking ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

-- ─── 5. Submissions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 6. Support Tickets ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  admin_reply TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 7. Automation Logs ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  message TEXT,
  triggered_by TEXT DEFAULT 'system',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ─── 8. Form Submissions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  page_id TEXT,
  form_type TEXT NOT NULL DEFAULT 'contact',
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 9. User Queries (Contact Form) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS user_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_reply TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 10. Site Settings ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY,
  contact_email TEXT NOT NULL DEFAULT 'support@pixel-prompt.app',
  contact_phone TEXT NOT NULL DEFAULT '+1 (555) 000-0000',
  contact_address TEXT NOT NULL DEFAULT 'PixelPrompt HQ, San Francisco, CA',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 11. Session Store (express-session + connect-pg-simple) ─────────
CREATE TABLE IF NOT EXISTS "session" (
  "sid" VARCHAR NOT NULL COLLATE "default",
  "sess" JSON NOT NULL,
  "expire" TIMESTAMPTZ NOT NULL,
  PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");


-- ═══════════════════════════════════════════════════════════════════════
-- STEP 3: INSERT DEFAULT DATA
-- ═══════════════════════════════════════════════════════════════════════

-- Default site settings row
INSERT INTO site_settings (id, contact_email, contact_phone, contact_address)
VALUES (1, 'support@pixel-prompt.app', '+1 (555) 000-0000', 'PixelPrompt HQ, San Francisco, CA')
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- STEP 4: CREATE ADMIN USER
-- ═══════════════════════════════════════════════════════════════════════
-- ⚠️ IMPORTANT: Change the email and password below to your own!
-- The password below is hashed for "admin123456" using scrypt.
-- You SHOULD change this password after first login.
-- To generate your own hash, sign up normally and then run:
--   UPDATE users SET role = 'admin' WHERE email = 'your@email.com';

INSERT INTO users (id, email, password, role)
VALUES (
  gen_random_uuid(),
  'admin@pixel-prompt.app',
  -- This is the hash for password "admin123456" (change after first login!)
  '6b88c93d6d1e84e5d0f0c6b9f3e2d1a0c5b4a3928170605040302010f0e0d0c0b0a09080706050403020100f0e0d0c0b0a0908070605040302010f0e0d0c0b0a0.a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
  'admin'
)
ON CONFLICT (email) DO UPDATE SET role = 'admin';

-- NOTE: The hash above is a placeholder. The easiest way to create your admin:
-- 1. Sign up normally at your site with your email
-- 2. Then run: UPDATE users SET role = 'admin' WHERE email = 'YOUR_EMAIL_HERE';


-- ═══════════════════════════════════════════════════════════════════════
-- STEP 5: PERFORMANCE INDEXES
-- ═══════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_password_token);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_project_id ON submissions(project_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_day ON ai_usage(user_id, day);
CREATE INDEX IF NOT EXISTS idx_user_queries_status ON user_queries(status);
CREATE INDEX IF NOT EXISTS idx_user_queries_email ON user_queries(email);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON automation_logs(status);
CREATE INDEX IF NOT EXISTS idx_form_submissions_project ON form_submissions(project_id);


-- ═══════════════════════════════════════════════════════════════════════
-- STEP 6: ROW LEVEL SECURITY (RLS) POLICIES
-- ═══════════════════════════════════════════════════════════════════════
-- NOTE: Since PixelPrompt uses a Node.js backend (Express + Drizzle ORM)
-- that connects to Supabase via the DATABASE_URL connection string,
-- it connects as the "postgres" role which BYPASSES RLS by default.
-- 
-- These RLS policies are added as an EXTRA layer of protection in case
-- anyone accesses the database directly through Supabase client libraries.
-- Your Express backend handles authorization via requireAuth/requireAdmin.
-- ═══════════════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- ─── Users Table Policies ────────────────────────────────────────────
-- Users can read their own data
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

-- Users can update their own data
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid()::text = id::text);

-- Admin can see all users
CREATE POLICY "users_admin_select_all" ON users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role = 'admin')
  );

-- Admin can update all users (e.g. change roles)
CREATE POLICY "users_admin_update_all" ON users
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role = 'admin')
  );

-- ─── Projects Table Policies ─────────────────────────────────────────
-- Users can CRUD their own projects
CREATE POLICY "projects_select_own" ON projects
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "projects_insert_own" ON projects
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "projects_update_own" ON projects
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "projects_delete_own" ON projects
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- Admin can view all projects
CREATE POLICY "projects_admin_select_all" ON projects
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role = 'admin')
  );

-- ─── Subscriptions Table Policies ────────────────────────────────────
CREATE POLICY "subscriptions_select_own" ON subscriptions
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "subscriptions_admin_all" ON subscriptions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role = 'admin')
  );

-- ─── AI Usage Table Policies ─────────────────────────────────────────
CREATE POLICY "ai_usage_select_own" ON ai_usage
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "ai_usage_admin_all" ON ai_usage
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role = 'admin')
  );

-- ─── Submissions Table Policies ──────────────────────────────────────
CREATE POLICY "submissions_select_own" ON submissions
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "submissions_insert_own" ON submissions
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "submissions_admin_all" ON submissions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role = 'admin')
  );

-- ─── Support Tickets Table Policies ──────────────────────────────────
CREATE POLICY "tickets_select_own" ON support_tickets
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "tickets_insert_own" ON support_tickets
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "tickets_admin_all" ON support_tickets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role = 'admin')
  );

-- ─── Automation Logs – Admin Only ────────────────────────────────────
CREATE POLICY "automation_logs_admin_only" ON automation_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role = 'admin')
  );

-- ─── Form Submissions – Admin Only ───────────────────────────────────
CREATE POLICY "form_submissions_admin_only" ON form_submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role = 'admin')
  );

-- Anyone can insert a form submission (public forms on exported sites)
CREATE POLICY "form_submissions_public_insert" ON form_submissions
  FOR INSERT WITH CHECK (true);

-- ─── User Queries – Public Insert, Admin Read ────────────────────────
-- Anyone can submit a contact query (public contact form)
CREATE POLICY "user_queries_public_insert" ON user_queries
  FOR INSERT WITH CHECK (true);

-- Only admins can read/update queries
CREATE POLICY "user_queries_admin_all" ON user_queries
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role = 'admin')
  );

-- ─── Site Settings – Public Read, Admin Write ────────────────────────
-- Everyone can read site settings (shown on contact page)
CREATE POLICY "site_settings_public_read" ON site_settings
  FOR SELECT USING (true);

-- Only admins can update site settings
CREATE POLICY "site_settings_admin_update" ON site_settings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role = 'admin')
  );


-- ═══════════════════════════════════════════════════════════════════════
-- STEP 7: ALLOW BACKEND SERVICE ROLE TO BYPASS RLS
-- ═══════════════════════════════════════════════════════════════════════
-- Your Express backend connects as "postgres" role via DATABASE_URL
-- which already bypasses RLS. This grants explicit permission just in case.

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON site_settings TO anon;
GRANT INSERT ON user_queries TO anon;
GRANT INSERT ON form_submissions TO anon;


-- ═══════════════════════════════════════════════════════════════════════
-- DONE! Your database is ready.
-- ═══════════════════════════════════════════════════════════════════════
-- 
-- NEXT STEPS:
-- 1. Sign up at your site normally with your email
-- 2. Run this to make yourself admin:
--    UPDATE users SET role = 'admin' WHERE email = 'YOUR_EMAIL@gmail.com';
-- 3. You can now access /admin/crm and /admin/submissions
-- ═══════════════════════════════════════════════════════════════════════
