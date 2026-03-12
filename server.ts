import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import fs from "fs";

const db = new Database("database.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    department TEXT NOT NULL,
    password TEXT DEFAULT 'student123',
    face_encodings TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    date DATE NOT NULL,
    time TIME NOT NULL,
    status TEXT DEFAULT 'Present',
    FOREIGN KEY (student_id) REFERENCES students(id)
  );

  CREATE TABLE IF NOT EXISTS admins (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL
  );
`);

// Migration: Add password column to students if it doesn't exist
try {
  db.prepare("ALTER TABLE students ADD COLUMN password TEXT DEFAULT 'student123'").run();
} catch (e) {
  // Column might already exist, ignore error
}

// Insert default admin if not exists
const adminExists = db.prepare("SELECT * FROM admins WHERE username = ?").get("admin");
if (!adminExists) {
  db.prepare("INSERT INTO admins (username, password) VALUES (?, ?)").run("admin", "admin123");
  console.log("Default admin created: admin / admin123");
} else {
  console.log("Admin user already exists");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API Routes
  app.post("/api/login", (req, res) => {
    const { username, password, role } = req.body;
    console.log(`Login attempt: role=${role}, username=${username}`);
    
    if (role === 'admin') {
      const admin = db.prepare("SELECT * FROM admins WHERE LOWER(username) = LOWER(?) AND password = ?").get(username, password);
      if (admin) {
        console.log("Admin login successful");
        return res.json({ success: true, role: 'admin', user: { username: admin.username } });
      }
    } else {
      const student = db.prepare("SELECT * FROM students WHERE LOWER(id) = LOWER(?) AND password = ?").get(username, password);
      if (student) {
        console.log("Student login successful");
        return res.json({ success: true, role: 'student', user: student });
      }
    }
    
    console.log("Login failed: Invalid credentials");
    res.status(401).json({ success: false, message: "Invalid credentials" });
  });

  app.get("/api/students/:id/attendance", (req, res) => {
    const { id } = req.params;
    const attendance = db.prepare(`
      SELECT a.*, s.name, s.department 
      FROM attendance a 
      JOIN students s ON a.student_id = s.id
      WHERE s.id = ?
      ORDER BY a.date DESC, a.time DESC
    `).all(id);
    res.json(attendance);
  });

  app.get("/api/students", (req, res) => {
    const students = db.prepare("SELECT * FROM students").all();
    res.json(students);
  });

  app.post("/api/students", (req, res) => {
    const { id, name, email, department, face_encodings } = req.body;
    try {
      db.prepare("INSERT INTO students (id, name, email, department, face_encodings) VALUES (?, ?, ?, ?, ?)")
        .run(id, name, email, department, JSON.stringify(face_encodings));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.put("/api/students/:id", (req, res) => {
    const { name, email, department } = req.body;
    const { id } = req.params;
    try {
      db.prepare("UPDATE students SET name = ?, email = ?, department = ? WHERE id = ?")
        .run(name, email, department, id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.delete("/api/students/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM students WHERE id = ?").run(id);
      db.prepare("DELETE FROM attendance WHERE student_id = ?").run(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.get("/api/attendance", (req, res) => {
    const { date } = req.query;
    let query = `
      SELECT a.*, s.name, s.department 
      FROM attendance a 
      JOIN students s ON a.student_id = s.id
    `;
    const params: any[] = [];
    if (date) {
      query += " WHERE a.date = ?";
      params.push(date);
    }
    const attendance = db.prepare(query).all(...params);
    res.json(attendance);
  });

  app.post("/api/attendance", (req, res) => {
    const { student_id } = req.body;
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0];

    // Check if already marked today
    const existing = db.prepare("SELECT * FROM attendance WHERE student_id = ? AND date = ?").get(student_id, date);
    if (existing) {
      return res.json({ success: true, message: "Already marked" });
    }

    try {
      db.prepare("INSERT INTO attendance (student_id, date, time) VALUES (?, ?, ?)")
        .run(student_id, date, time);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.get("/api/stats", (req, res) => {
    const totalStudents = db.prepare("SELECT COUNT(*) as count FROM students").get().count;
    const today = new Date().toISOString().split('T')[0];
    const presentToday = db.prepare("SELECT COUNT(*) as count FROM attendance WHERE date = ?").get(today).count;
    const absentToday = totalStudents - presentToday;

    // Last 7 days attendance for chart
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = db.prepare("SELECT COUNT(*) as count FROM attendance WHERE date = ?").get(dateStr).count;
      last7Days.push({ date: dateStr, count });
    }

    res.json({
      totalStudents,
      presentToday,
      absentToday,
      chartData: last7Days
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
