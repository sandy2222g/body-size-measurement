const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize SQLite database
const db = new sqlite3.Database(process.env.DB_PATH || './measurements.db');

// Create tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    height REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Measurements table
  db.run(`CREATE TABLE IF NOT EXISTS measurements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    chest REAL,
    waist REAL,
    hips REAL,
    shoulder_width REAL,
    arm_length REAL,
    inseam REAL,
    recommended_size TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);
});

// Measurement (computer vision) is done by the Flask/MediaPipe service in app.py.
const MEASURE_SERVICE_URL = process.env.MEASURE_SERVICE_URL || 'http://127.0.0.1:5001';

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Create user
app.post('/api/users', (req, res) => {
  const { name, email, height } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  const stmt = db.prepare('INSERT INTO users (name, email, height) VALUES (?, ?, ?)');
  stmt.run([name, email, height || 170], function(err) {
    if (err) {
      if (err.code === 'SQLITE_CONSTRAINT') {
        return res.status(400).json({ error: 'Email already exists' });
      }
      return res.status(500).json({ error: 'Failed to create user' });
    }
    
    res.json({ 
      id: this.lastID, 
      message: 'User created successfully' 
    });
  });
  stmt.finalize();
});

// Get user
app.get('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!row) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(row);
  });
});

// Process measurement: forwards to the Flask pose-detection service
app.post('/api/measure', async (req, res) => {
  const { images, height } = req.body || {};
  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'At least one image is required' });
  }

  try {
    const upstream = await fetch(`${MEASURE_SERVICE_URL}/api/measure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images, height })
    });
    const body = await upstream.json().catch(() => ({ error: 'Invalid response from measurement service' }));
    res.status(upstream.status).json(body);
  } catch (error) {
    console.error('Measurement service unavailable:', error.message);
    res.status(503).json({
      error: 'Measurement service is unavailable. Start it with: python app.py'
    });
  }
});

// Save measurement
app.post('/api/measurements', (req, res) => {
  const { user_id, measurements } = req.body;
  
  if (!user_id || !measurements) {
    return res.status(400).json({ error: 'User ID and measurements are required' });
  }

  const {
    chest,
    waist,
    hips,
    shoulder_width,
    arm_length,
    inseam,
    recommended_size
  } = measurements;

  db.get('SELECT id FROM users WHERE id = ?', [user_id], (lookupErr, user) => {
    if (lookupErr) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    saveMeasurement();
  });

  function saveMeasurement() {
  const stmt = db.prepare(`
    INSERT INTO measurements 
    (user_id, chest, waist, hips, shoulder_width, arm_length, inseam, recommended_size) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run([
    user_id,
    chest,
    waist,
    hips,
    shoulder_width,
    arm_length,
    inseam,
    recommended_size
  ], function(err) {
    if (err) {
      console.error('Error saving measurement:', err);
      return res.status(500).json({ error: 'Failed to save measurement' });
    }
    
    res.json({ 
      id: this.lastID, 
      message: 'Measurement saved successfully' 
    });
  });
  
  stmt.finalize();
  }
});

// Get user measurements
app.get('/api/measurements/:userId', (req, res) => {
  const userId = req.params.userId;
  
  db.all(
    'SELECT * FROM measurements WHERE user_id = ? ORDER BY created_at DESC',
    [userId],
    (err, rows) => {
      if (err) {
        console.error('Error fetching measurements:', err);
        return res.status(500).json({ error: 'Failed to fetch measurements' });
      }
      
      res.json(rows);
    }
  );
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
});
