const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Initialize SQLite database
const db = new sqlite3.Database('./measurements.db');

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

// Mock measurement calculation (since we can't use MediaPipe/OpenCV)
function calculateMockMeasurements(height = 170) {
  // Generate realistic measurements based on height
  const baseRatio = height / 170; // Normalize to average height
  
  return {
    chest: Math.round((88 + Math.random() * 20) * baseRatio * 10) / 10,
    waist: Math.round((75 + Math.random() * 15) * baseRatio * 10) / 10,
    hips: Math.round((95 + Math.random() * 15) * baseRatio * 10) / 10,
    shoulder_width: Math.round((42 + Math.random() * 8) * baseRatio * 10) / 10,
    arm_length: Math.round((58 + Math.random() * 10) * baseRatio * 10) / 10,
    inseam: Math.round((75 + Math.random() * 15) * baseRatio * 10) / 10
  };
}

function recommendSize(measurements) {
  const { chest, waist, hips } = measurements;
  const avgMeasurement = (chest + waist + hips) / 3;
  
  if (avgMeasurement < 80) return 'XS';
  if (avgMeasurement < 90) return 'S';
  if (avgMeasurement < 100) return 'M';
  if (avgMeasurement < 110) return 'L';
  if (avgMeasurement < 120) return 'XL';
  return 'XXL';
}

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

// Process measurement (mock implementation)
app.post('/api/measure', (req, res) => {
  try {
    const { images, height } = req.body;
    
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'At least one image is required' });
    }

    // Simulate processing delay
    setTimeout(() => {
      const allMeasurements = images.map(() => calculateMockMeasurements(height || 170));
      
      const avgMeasurements = allMeasurements.reduce((acc, curr) => {
        for (const key in curr) {
          acc[key] = (acc[key] || 0) + curr[key];
        }
        return acc;
      }, {});

      for (const key in avgMeasurements) {
        avgMeasurements[key] = Math.round((avgMeasurements[key] / images.length) * 10) / 10;
      }

      const recommendedSize = recommendSize(avgMeasurements);
      
      res.json({
        measurements: {
          ...avgMeasurements,
          recommended_size: recommendedSize
        },
        landmarks_detected: true,
        note: `This is a demo using mock measurements from ${images.length} images. In production, this would use AI computer vision.`
      });
    }, 2000); // 2 second delay to simulate processing
    
  } catch (error) {
    console.error('Error processing measurement:', error);
    res.status(500).json({ error: 'Failed to process measurement' });
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
