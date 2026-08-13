import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Client } from 'pg';

const localProjectsStore = new Map<string, any>();

async function ensureTable(client: InstanceType<typeof Client>) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL DEFAULT 'Mijn Verbouwing',
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (req.method === 'GET') {
    const id = (req.query.id as string) || (req.query.projectId as string) || 'default';

    if (dbUrl) {
      try {
        const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
        await client.connect();
        await ensureTable(client);

        const result = await client.query(
          'SELECT id, name, data, updated_at FROM projects WHERE id = $1',
          [id]
        );
        await client.end();

        if (result.rows.length > 0) {
          return res.status(200).json({ success: true, project: result.rows[0], source: 'neon' });
        }
      } catch (err: any) {
        console.warn('Neon DB query error:', err?.message || err);
      }
    }

    const cached = localProjectsStore.get(id);
    if (cached) {
      return res.status(200).json({ success: true, project: { id, data: cached }, source: 'local_cache' });
    }

    return res.status(404).json({ success: false, error: 'Project niet gevonden' });
  }

  if (req.method === 'POST') {
    const { id, name, data } = req.body || {};
    if (!id || !data) {
      return res.status(400).json({ success: false, error: 'Missing id or data' });
    }

    localProjectsStore.set(id, data);

    if (dbUrl) {
      try {
        const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
        await client.connect();
        await ensureTable(client);

        const query = `
          INSERT INTO projects (id, name, data, updated_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (id) DO UPDATE
          SET name = EXCLUDED.name, data = EXCLUDED.data, updated_at = NOW()
          RETURNING id, updated_at;
        `;
        const result = await client.query(query, [id, name || 'Mijn Verbouwing', JSON.stringify(data)]);
        await client.end();

        return res.status(200).json({ success: true, project: result.rows[0], source: 'neon' });
      } catch (err: any) {
        console.warn('Neon DB save error:', err?.message || err);
        return res.status(200).json({ success: true, source: 'local_cache', warning: err?.message });
      }
    }

    return res.status(200).json({ success: true, source: 'local_cache' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
