import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import multer from "multer";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import session from "express-session";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("goals.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT,
    picture TEXT,
    ads_removed INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    photo_url TEXT,
    completed_at DATETIME,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  INSERT OR IGNORE INTO settings (key, value) VALUES ('ads_removed', 'false');
`);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "goal-tracker-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,
      sameSite: "none",
      httpOnly: true,
    },
  })
);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Static files for uploads
app.use("/uploads", express.static(uploadsDir));

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Auth Middleware
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

// Google OAuth Routes
app.get("/api/auth/google/url", (req, res) => {
  const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
  const options = {
    redirect_uri: `${process.env.APP_URL}/api/auth/google/callback`,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    access_type: "offline",
    response_type: "code",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
  };

  const qs = new URLSearchParams(options);
  res.json({ url: `${rootUrl}?${qs.toString()}` });
});

app.get("/api/auth/google/callback", async (req: any, res) => {
  const code = req.query.code as string;
  const url = "https://oauth2.googleapis.com/token";
  const values = {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: `${process.env.APP_URL}/api/auth/google/callback`,
    grant_type: "authorization_code",
  };

  try {
    const tokenRes = await fetch(url, {
      method: "POST",
      body: new URLSearchParams(values),
    });
    const { access_token, id_token } = await tokenRes.json();

    const userRes = await fetch(
      `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${access_token}`,
      {
        headers: {
          Authorization: `Bearer ${id_token}`,
        },
      }
    );
    const googleUser = await userRes.json();

    // Upsert user
    db.prepare(`
      INSERT INTO users (id, email, name, picture)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email=excluded.email,
        name=excluded.name,
        picture=excluded.picture
    `).run(googleUser.id, googleUser.email, googleUser.name, googleUser.picture);

    req.session.user = googleUser;
    
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Failed to fetch Google user", error);
    res.redirect("/auth-error");
  }
});

app.get("/api/auth/me", (req: any, res) => {
  if (req.session.user) {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.user.id);
    res.json(user);
  } else {
    res.json(null);
  }
});

app.post("/api/auth/logout", (req: any, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// API Routes
app.get("/api/settings", (req: any, res) => {
  if (req.session.user) {
    const user = db.prepare("SELECT ads_removed FROM users WHERE id = ?").get(req.session.user.id);
    res.json({ adsRemoved: user?.ads_removed === 1 });
  } else {
    const adsRemoved = db.prepare("SELECT value FROM settings WHERE key = 'ads_removed'").get();
    res.json({ adsRemoved: adsRemoved.value === 'true' });
  }
});

app.post("/api/settings/remove-ads", requireAuth, (req: any, res) => {
  db.prepare("UPDATE users SET ads_removed = 1 WHERE id = ?").run(req.session.user.id);
  res.json({ success: true });
});

app.get("/api/tasks", requireAuth, (req: any, res) => {
  const tasks = db.prepare("SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC").all(req.session.user.id);
  const tasksWithSubtasks = tasks.map((task: any) => {
    const subtasks = db.prepare("SELECT * FROM subtasks WHERE task_id = ?").all(task.id);
    return { ...task, subtasks };
  });
  res.json(tasksWithSubtasks);
});

app.post("/api/tasks", requireAuth, (req: any, res) => {
  const { title } = req.body;
  const info = db.prepare("INSERT INTO tasks (user_id, title) VALUES (?, ?)").run(req.session.user.id, title);
  res.json({ id: info.lastInsertRowid, title, subtasks: [] });
});

app.delete("/api/tasks/:id", requireAuth, (req: any, res) => {
  // Ensure task belongs to user
  const task = db.prepare("SELECT * FROM tasks WHERE id = ? AND user_id = ?").get(req.params.id, req.session.user.id);
  if (!task) return res.status(403).json({ error: "Forbidden" });

  db.prepare("DELETE FROM tasks WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.post("/api/tasks/:id/subtasks", requireAuth, (req: any, res) => {
  const { title } = req.body;
  // Ensure task belongs to user
  const task = db.prepare("SELECT * FROM tasks WHERE id = ? AND user_id = ?").get(req.params.id, req.session.user.id);
  if (!task) return res.status(403).json({ error: "Forbidden" });

  const info = db.prepare("INSERT INTO subtasks (task_id, title) VALUES (?, ?)").run(req.params.id, title);
  res.json({ id: info.lastInsertRowid, task_id: req.params.id, title, completed: 0 });
});

app.patch("/api/subtasks/:id", requireAuth, upload.single("photo"), (req: any, res) => {
  const { completed } = req.body;
  const subtaskId = req.params.id;

  // Ensure subtask belongs to user's task
  const subtask = db.prepare(`
    SELECT subtasks.* FROM subtasks 
    JOIN tasks ON subtasks.task_id = tasks.id 
    WHERE subtasks.id = ? AND tasks.user_id = ?
  `).get(subtaskId, req.session.user.id);

  if (!subtask) return res.status(403).json({ error: "Forbidden" });

  const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
  const completedAt = completed === "true" || completed === "1" ? new Date().toISOString() : null;

  if (photoUrl) {
    db.prepare("UPDATE subtasks SET completed = ?, photo_url = ?, completed_at = ? WHERE id = ?")
      .run(1, photoUrl, completedAt, subtaskId);
  } else {
    db.prepare("UPDATE subtasks SET completed = ?, completed_at = ? WHERE id = ?")
      .run(completed === "true" || completed === "1" ? 1 : 0, completedAt, subtaskId);
  }

  const updated = db.prepare("SELECT * FROM subtasks WHERE id = ?").get(subtaskId);
  res.json(updated);
});

app.get("/api/photos", requireAuth, (req: any, res) => {
  const photos = db.prepare(`
    SELECT subtasks.*, tasks.title as task_title 
    FROM subtasks 
    JOIN tasks ON subtasks.task_id = tasks.id 
    WHERE tasks.user_id = ? AND photo_url IS NOT NULL 
    ORDER BY completed_at DESC
  `).all(req.session.user.id);
  res.json(photos);
});

// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, "dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
