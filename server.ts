import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

// In-memory project store fallback
const localProjectsStore = new Map<string, { name: string; data: any; updated_at: string }>();

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
    furnitureCounter: 0,
    walls: [],
    zones: [],
    openings: [],
    backgrounds: [],
    jobs: [],
    furniture: [],
  };
}

// Lazy PG client helper
let pgPool: any = null;
let tableInitialized = false;

async function getPgPool() {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!dbUrl) return null;
  if (!pgPool) {
    try {
      const { Pool } = await import("pg");
      pgPool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false },
        max: 5,
        connectionTimeoutMillis: 3000,
      });
    } catch (e) {
      console.warn("Failed to initialize PostgreSQL pool:", e);
      return null;
    }
  }
  return pgPool;
}

async function ensureTable(pool: any) {
  if (tableInitialized) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL DEFAULT 'Mijn Verbouwing',
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    tableInitialized = true;
  } catch (e) {
    console.warn("Could not create projects table:", e);
  }
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL),
    timestamp: new Date().toISOString(),
  });
});

// GET: List projects or get a specific project
app.get("/api/projects/:id?", async (req, res) => {
  const id = req.params.id || (req.query.id as string) || (req.query.projectId as string);

  // If no ID requested, list all projects
  if (!id) {
    const pool = await getPgPool();
    if (pool) {
      try {
        await ensureTable(pool);
        const result = await pool.query(
          "SELECT id, name, updated_at FROM projects ORDER BY updated_at DESC"
        );
        return res.json({ success: true, projects: result.rows, source: "database" });
      } catch (err: any) {
        console.warn("Database list error, falling back to local cache:", err?.message || err);
      }
    }

    const projects = Array.from(localProjectsStore.entries()).map(([projId, item]) => ({
      id: projId,
      name: item.name || item.data?.projectName || "Mijn Verbouwing",
      updated_at: item.updated_at || new Date().toISOString(),
    }));
    return res.json({ success: true, projects, source: "local_cache" });
  }

  // Single project fetch
  const pool = await getPgPool();
  if (pool) {
    try {
      await ensureTable(pool);
      const result = await pool.query("SELECT id, name, data, updated_at FROM projects WHERE id = $1", [id]);
      if (result.rows.length > 0) {
        return res.json({ success: true, project: result.rows[0], source: "database" });
      }
    } catch (err: any) {
      console.warn("Database query error, falling back to local cache:", err?.message || err);
    }
  }

  const cached = localProjectsStore.get(id);
  if (cached) {
    return res.json({
      success: true,
      project: { id, name: cached.name, data: cached.data, updated_at: cached.updated_at },
      source: "local_cache",
    });
  }

  return res.status(404).json({ success: false, error: "Project niet gevonden" });
});

// POST: Create or update project
app.post("/api/projects", async (req, res) => {
  const body = req.body || {};

  // Action: Create new project
  if (body.action === "create") {
    const id = "proj_" + Math.random().toString(36).substring(2, 11);
    const name = body.name || "Nieuw Project";
    const data = createEmptyProjectData(id, name);
    const now = new Date().toISOString();

    localProjectsStore.set(id, { name, data, updated_at: now });

    const pool = await getPgPool();
    if (pool) {
      try {
        await ensureTable(pool);
        await pool.query(
          `INSERT INTO projects (id, name, data, updated_at)
           VALUES ($1, $2, $3, NOW())
           RETURNING id, name, updated_at`,
          [id, name, JSON.stringify(data)]
        );
        return res.json({ success: true, project: { id, name, data }, source: "database" });
      } catch (err: any) {
        console.warn("Database create error, falling back to local cache:", err?.message || err);
      }
    }

    return res.json({ success: true, project: { id, name, data }, source: "local_cache" });
  }

  // Action: Save / Upsert project
  const { id, name, data } = body;
  if (!id || !data) {
    return res.status(400).json({ success: false, error: "Missing id or data" });
  }

  const projectName = name || data.projectName || "Mijn Verbouwing";
  const now = new Date().toISOString();
  localProjectsStore.set(id, { name: projectName, data, updated_at: now });

  const pool = await getPgPool();
  if (pool) {
    try {
      await ensureTable(pool);
      const query = `
        INSERT INTO projects (id, name, data, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name, data = EXCLUDED.data, updated_at = NOW()
        RETURNING id, updated_at;
      `;
      const result = await pool.query(query, [id, projectName, JSON.stringify(data)]);
      return res.json({ success: true, project: result.rows[0], source: "database" });
    } catch (err: any) {
      console.warn("Database save error, saved in local cache:", err?.message || err);
      return res.json({ success: true, source: "local_cache", warning: "Database save failed, cached in memory" });
    }
  }

  return res.json({ success: true, source: "local_cache" });
});

// DELETE: Remove project
app.delete("/api/projects/:id?", async (req, res) => {
  const id = req.params.id || (req.query.id as string) || (req.body?.id as string);
  if (!id) {
    return res.status(400).json({ success: false, error: "Missing id" });
  }

  localProjectsStore.delete(id);

  const pool = await getPgPool();
  if (pool) {
    try {
      await ensureTable(pool);
      await pool.query("DELETE FROM projects WHERE id = $1", [id]);
      return res.json({ success: true, source: "database" });
    } catch (err: any) {
      console.warn("Database delete error:", err?.message || err);
    }
  }

  return res.json({ success: true, source: "local_cache" });
});

async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Verbouw Planner server running on http://0.0.0.0:${PORT}`);
  });
}

start();

