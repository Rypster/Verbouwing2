import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

// In-memory project cache fallback if no DATABASE_URL is set
const localProjectsStore = new Map<string, any>();

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    timestamp: new Date().toISOString(),
  });
});

// Ensure table exists helper
async function ensureTable(client: any) {
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

// Get project by ID or query
app.get("/api/projects/:id?", async (req, res) => {
  const id = req.params.id || (req.query.id as string) || "default";
  
  if (process.env.DATABASE_URL) {
    try {
      const { Client } = await import("pg");
      const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
      await client.connect();
      await ensureTable(client);
      const result = await client.query("SELECT id, name, data, updated_at FROM projects WHERE id = $1", [id]);
      await client.end();
      
      if (result.rows.length > 0) {
        return res.json({ success: true, project: result.rows[0] });
      }
    } catch (err: any) {
      console.warn("Neon DB query error, falling back to local storage:", err?.message || err);
    }
  }

  // Fallback to in-memory store
  const projectData = localProjectsStore.get(id);
  if (projectData) {
    return res.json({ success: true, project: { id, data: projectData } });
  }

  return res.status(404).json({ success: false, error: "Project niet gevonden" });
});

// Save or Update project
app.post("/api/projects", async (req, res) => {
  const { id, name, data } = req.body;
  if (!id || !data) {
    return res.status(400).json({ success: false, error: "Missing id or data" });
  }

  // Update memory store
  localProjectsStore.set(id, data);

  if (process.env.DATABASE_URL) {
    try {
      const { Client } = await import("pg");
      const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
      await client.connect();
      await ensureTable(client);
      
      const query = `
        INSERT INTO projects (id, name, data, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name, data = EXCLUDED.data, updated_at = NOW()
        RETURNING id, updated_at;
      `;
      const result = await client.query(query, [id, name || "Mijn Verbouwing", JSON.stringify(data)]);
      await client.end();
      
      return res.json({ success: true, project: result.rows[0], source: "neon" });
    } catch (err: any) {
      console.warn("Neon DB save error, saved locally:", err?.message || err);
      return res.json({ success: true, source: "local_cache", warning: "Database save failed, cached in memory" });
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
