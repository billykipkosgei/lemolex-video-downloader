/**
 * Lemolex Video Downloader API Server
 * Main entry point for the API-only version
 * Author: Billy
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Import our modules
const routes = require('./src/routes');
const { logInfo, logError, logSuccess } = require('./src/utils');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || 'localhost';

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url} - IP: ${req.ip}`);
  next();
});

// API routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Lemolex Video Downloader API',
    version: require('./package.json').version,
    description: 'YouTube Video & Audio Downloader API',
    author: 'Billy',
    documentation: '/api/docs',
    health: '/api/health',
    endpoints: {
      'GET /api/health': 'Server health check',
      'GET /api/docs': 'API documentation',
      'POST /api/info': 'Get video information',
      'POST /api/download': 'Start video download',
      'GET /api/download/:id': 'Get download status',
      'GET /api/downloads': 'Get all downloads',
      'DELETE /api/downloads/completed': 'Clear completed downloads'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The endpoint ${req.method} ${req.originalUrl} does not exist`,
    availableEndpoints: [
      'GET /',
      'GET /api/health',
      'GET /api/docs',
      'POST /api/info',
      'POST /api/download',
      'GET /api/download/:id',
      'GET /api/downloads',
      'DELETE /api/downloads/completed'
    ]
  });
});

// Global error handler
app.use((error, req, res, next) => {
  logError('Server Error:', error);
  
  res.status(error.status || 500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logInfo('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logInfo('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logInfo('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    logInfo('Process terminated');
    process.exit(0);
  });
});

// Start server
const server = app.listen(PORT, HOST, () => {
  console.log('\n' + '='.repeat(60));
  logSuccess(`🚀 Lemolex Video Downloader API Server Started!`);
  console.log('='.repeat(60));
  logInfo(`📡 Server running on: http://${HOST}:${PORT}`);
  logInfo(`📖 API Documentation: http://${HOST}:${PORT}/api/docs`);
  logInfo(`❤️  Health Check: http://${HOST}:${PORT}/api/health`);
  logInfo(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('='.repeat(60));
  
  // Quick health check
  logInfo('🔍 Performing startup checks...');
  setTimeout(() => {
    logSuccess('✅ API Server is ready to accept requests!');
    console.log('\n💡 Test the API:');
    console.log(`   curl http://${HOST}:${PORT}/api/health`);
    console.log('');
  }, 1000);
});

module.exports = app;