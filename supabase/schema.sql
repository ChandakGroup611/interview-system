-- ============================================
-- AI Real Estate Closing Manager Interview System
-- Supabase Database Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables to start fresh
DROP TABLE IF EXISTS email_logs CASCADE;
DROP TABLE IF EXISTS admin_login_logs CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS candidates CASCADE;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CANDIDATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  transcript JSONB DEFAULT '[]'::jsonb,
  audio_urls JSONB DEFAULT '[]'::jsonb,
  persona_transitions JSONB DEFAULT '[]'::jsonb,
  current_question INTEGER DEFAULT 0,
  current_persona TEXT DEFAULT 'easy-going',
  conversation_history JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'evaluated')),
  project_id TEXT DEFAULT 'greenairy',
  project_name TEXT DEFAULT 'Greenairy',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- REPORTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  scores JSONB DEFAULT '{}'::jsonb,
  final_score NUMERIC(5,2) DEFAULT 0,
  feedback TEXT DEFAULT '',
  pdf_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EMAIL LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_name TEXT NOT NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'retrying')),
  error_message TEXT DEFAULT NULL,
  attempt_number INTEGER DEFAULT 1,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ADMIN LOGIN LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS admin_login_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  ip_address TEXT DEFAULT 'unknown',
  user_agent TEXT DEFAULT 'unknown',
  session_token TEXT DEFAULT '',
  logged_in_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_sessions_candidate ON sessions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_reports_session ON reports(session_id);
CREATE INDEX IF NOT EXISTS idx_reports_candidate ON reports(candidate_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_session ON email_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_admin_login_logs_user ON admin_login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_login_logs_time ON admin_login_logs(logged_in_at);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STORAGE BUCKETS (run in Supabase Dashboard)
-- ============================================
-- Create buckets: 'audio-files' and 'pdf-reports'
-- Set both as public buckets for URL access
-- INSERT INTO storage.buckets (id, name, public) VALUES ('audio-files', 'audio-files', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('pdf-reports', 'pdf-reports', true);
