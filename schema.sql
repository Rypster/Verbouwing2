-- Schema for Neon PostgreSQL database (Verbouw Planner)
-- Execute this script in your Neon console or SQL editor to set up tables.

CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL DEFAULT 'Mijn Verbouwing',
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast JSON lookup and ordering
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);
