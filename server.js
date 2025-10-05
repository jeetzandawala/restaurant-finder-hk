// server.js - Simple Express server for Railway deployment
import express from 'express';
import cors from 'cors';
import checkHandler from './api/check.js';
import checkStreamHandler from './api/check-stream.js';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

app.get('/', (req, res) => {
  res.json({
    message: '🍽️ Restaurant Availability Checker API',
    endpoints: {
      check: '/api/check?date=YYYY-MM-DD&time=HH:MM&partySize=N',
      health: '/health'
    },
    example: '/api/check?date=2024-01-20&time=19:00&partySize=2'
  });
});

// Main API endpoint (legacy)
app.get('/api/check', async (req, res) => {
  try {
    await checkHandler(req, res);
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Streaming API endpoint (new, optimized)
app.get('/api/check-stream', async (req, res) => {
  try {
    await checkStreamHandler(req, res);
  } catch (error) {
    console.error('Stream error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /api/check?date=YYYY-MM-DD&time=HH:MM&partySize=N',
      'GET /health',
      'GET /'
    ]
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Something went wrong',
    message: error.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Restaurant Availability Checker running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 API endpoint: http://localhost:${PORT}/api/check`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
