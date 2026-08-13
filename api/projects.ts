import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';

const localProjectsStore = new Map<string, any>();

// Reused across warm serverless invocations instead of opening a fresh
// TCP+TLS connection to Neon on every single request (which is what
// autosave-on-every-action would otherwise hammer).
let pool: Pool | null = null;
let tableEnsured = false;

function getPool(dbUrl: string): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      max: 5, // keep this low; serverless functions can spin up many instances in parallel
      idleTimeoutMillis: 30_000,
    });
  }
  return pool;
}

async function ensureTable(p: Pool) {
  if (tableEnsured) return;
  await p.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL DEFAULT 'Mijn Verbouwing',
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  tableEnsured = true;
}

function createEmptyProjectData(id: string, name: string) {
  return {
    projectId: id,
    projectName: name,
    scalePxPerMeter: 50,
    view: { pan: { x: 80, y: 60 }, zoom: 1 },
    wallCounter: 0,
    zoneCounter: 0,
    bgCounter: 0,
    openingCounter: 0,
    jobCounter: 0,
    walls: [],
    zones: [],
    openings: [],
    backgrounds: [],
    jobs: [],
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  // ========== GET ==========
  if (req.method === 'GET') {
    const id = (req.query.id as string) || (req.query.projectId as string);

    // Lijst van alle projecten
    if (!id) {
      if (dbUrl) {
        try {
          const p = getPool(dbUrl);
          await ensureTable(p);
          const result = await p.query(
            'SELECT id, name, updated_at FROM projects ORDER BY updated_at DESC'
          );
          return res.status(200).json({ success: true, projects: result.rows, source: 'neon' });
        } catch (err: any) {
          console.warn('Neon list error:', err?.message || err);
        }
      }

      // Fallback: lokale cache
      const projects = Array.from(localProjectsStore.entries()).map(([id, data]) => ({
        id,
        name: data?.projectName || 'Onbekend',
        updated_at: new Date().toISOString(),
      }));
      return res.status(200).json({ success: true, projects, source: 'local_cache' });
    }

    // Enkel project ophalen
    if (dbUrl) {
      try {
        const p = getPool(dbUrl);
        await ensureTable(p);
        const result = await p.query(
          'SELECT id, name, data, updated_at FROM projects WHERE id = $1',
          [id]
        );
        if (result.rows.length > 0) {
          return res.status(200).json({ success: true, project: result.rows[0], source: 'neon' });
        }
      } catch (err: any) {
        console.warn('Neon DB query error:', err?.message || err);
      }
    }

    const cached = localProjectsStore.get(id);
    if (cached) {
      return res.status(200).json({
        success: true,
        project: { id, name: cached.projectName || 'Mijn Verbouwing', data: cached },
        source: 'local_cache',
      });
    }
    return res.status(404).json({ success: false, error: 'Project niet gevonden' });
  }

  // ========== POST ==========
  if (req.method === 'POST') {
    const body = req.body || {};

    // Nieuw project aanmaken
    if (body.action === 'create') {
      const id = 'proj_' + Math.random().toString(36).substr(2, 9);
      const name = body.name || 'Nieuw Project';
      const data = createEmptyProjectData(id, name);

      localProjectsStore.set(id, data);

      if (dbUrl) {
        try {
          const p = getPool(dbUrl);
          await ensureTable(p);
          await p.query(
            `INSERT INTO projects (id, name, data, updated_at)
             VALUES ($1, $2, $3, NOW())
             RETURNING id, name, updated_at`,
            [id, name, JSON.stringify(data)]
          );
          return res.status(200).json({ success: true, project: { id, name, data }, source: 'neon' });
        } catch (err: any) {
          console.warn('Neon create error:', err?.message || err);
        }
      }

      return res.status(200).json({ success: true, project: { id, name, data }, source: 'local_cache' });
    }

    // Bestaande upsert (opslaan)
    const { id, name, data } = body;
    if (!id || !data) {
      return res.status(400).json({ success: false, error: 'Missing id or data' });
    }

    localProjectsStore.set(id, data);

    if (dbUrl) {
      try {
        const p = getPool(dbUrl);
        await ensureTable(p);
        const result = await p.query(
          `INSERT INTO projects (id, name, data, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (id) DO UPDATE
           SET name = EXCLUDED.name, data = EXCLUDED.data, updated_at = NOW()
           RETURNING id, updated_at`,
          [id, name || 'Mijn Verbouwing', JSON.stringify(data)]
        );
        return res.status(200).json({ success: true, project: result.rows[0], source: 'neon' });
      } catch (err: any) {
        console.warn('Neon DB save error:', err?.message || err);
        return res.status(200).json({ success: true, source: 'local_cache', warning: err?.message });
      }
    }

    return res.status(200).json({ success: true, source: 'local_cache' });
  }

  // ========== DELETE ==========
  if (req.method === 'DELETE') {
    const id = (req.query.id as string) || (req.body?.id as string);
    if (!id) {
      return res.status(400).json({ success: false, error: 'Missing id' });
    }

    localProjectsStore.delete(id);

    if (dbUrl) {
      try {
        const p = getPool(dbUrl);
        await ensureTable(p);
        await p.query('DELETE FROM projects WHERE id = $1', [id]);
        return res.status(200).json({ success: true, source: 'neon' });
      } catch (err: any) {
        console.warn('Neon delete error:', err?.message || err);
      }
    }

    return res.status(200).json({ success: true, source: 'local_cache' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}