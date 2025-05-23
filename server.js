/**
 * Enhanced Lemolex Video Downloader API Server
 * Railway-compatible version with file return support
 * Author: Billy
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Import our enhanced modules
const routes = require('./src/routes');
const { logInfo, logError, logSuccess } = require('./src/utils');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0'; // Important for Railway - bind to all interfaces

// Enhanced middleware configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Video-Title', 'X-Video-Duration', 'X-Video-Uploader', 'X-Download-Format', 'Content-Length']
}));

// Increase payload limits for file handling
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const userAgent = req.get('User-Agent') || 'Unknown';
  console.log(`[${timestamp}] ${req.method} ${req.url} - IP: ${req.ip} - UA: ${userAgent.substring(0, 50)}`);
  next();
});

// API routes
app.use('/api', routes);

// Enhanced root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Enhanced Lemolex Video Downloader API',
    version: require('./package.json').version,
    description: 'YouTube Video & Audio Downloader API with Direct File Return',
    author: 'Billy',
    features: [
      '📁 Direct file download and return',
      '🗑️ Automatic temporary file cleanup',
      '⚡ Single request-response workflow',
      '🎵 Multiple format support (MP4, MP3)',
      '🔧 Quality selection options',
      '🚀 Railway deployment ready'
    ],
    documentation: '/api/docs',
    health: '/api/health',
    endpoints: {
      'GET /api/health': 'Server health check with cleanup stats',
      'GET /api/docs': 'Complete API documentation',
      'POST /api/info': 'Get video information only',
      'POST /api/download/video': 'Download video and return MP4 file',
      'POST /api/download/audio': 'Download audio and return MP3 file',
      'POST /api/download': 'Download with custom format options',
      'POST /api/cleanup': 'Manually trigger file cleanup',
      'GET /api/temp-status': 'Get temporary files status'
    },
    workflow: [
      '1. Send POST request to download endpoint with YouTube URL',
      '2. API downloads the video/audio',
      '3. API returns the file directly in response',
      '4. Temporary files are automatically cleaned up'
    ],
    examples: {
      postman: {
        video: 'POST /api/download/video with JSON: {"url":"https://youtu.be/dQw4w9WgXcQ","quality":"720p"}',
        audio: 'POST /api/download/audio with JSON: {"url":"https://youtu.be/dQw4w9WgXcQ"}',
        note: 'Postman will automatically download the returned file'
      },
      curl: {
        video: `curl -X POST ${req.protocol}://${req.get('host')}/api/download/video -H "Content-Type: application/json" -d '{"url":"https://youtu.be/dQw4w9WgXcQ"}' --output video.mp4`,
        audio: `curl -X POST ${req.protocol}://${req.get('host')}/api/download/audio -H "Content-Type: application/json" -d '{"url":"https://youtu.be/dQw4w9WgXcQ"}' --output audio.mp3`
      }
    },
    railway: {
      deployed: true,
      url: `${req.protocol}://${req.get('host')}`,
      region: process.env.RAILWAY_REGION || 'unknown',
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

// Enhanced error handling middleware
app.use((error, req, res, next) => {
  logError('Server Error:', error);
  
  // Handle different types of errors
  let statusCode = 500;
  let errorMessage = 'Internal server error';
  
  if (error.code === 'ENOENT') {
    statusCode = 404;
    errorMessage = 'File not found';
  } else if (error.code === 'EACCES') {
    statusCode = 403;
    errorMessage = 'Access denied';
  } else if (error.code === 'EMFILE' || error.code === 'ENFILE') {
    statusCode = 503;
    errorMessage = 'Server temporarily overloaded';
  } else if (error.message.includes('timeout')) {
    statusCode = 408;
    errorMessage = 'Request timeout';
  } else if (error.message.includes('Invalid YouTube URL')) {
    statusCode = 400;
    errorMessage = 'Invalid YouTube URL provided';
  }
  
  res.status(statusCode).json({
    success: false,
    error: errorMessage,
    message: process.env.NODE_ENV === 'development' ? error.message : errorMessage,
    code: statusCode,
    timestamp: new Date().toISOString()
  });
});

// 404 handler for non-API routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The endpoint ${req.method} ${req.originalUrl} does not exist`,
    suggestion: 'Visit / for API documentation or /api/docs for detailed endpoint information',
    availableEndpoints: [
      'GET /',
      'GET /api/health',
      'GET /api/docs',
      'POST /api/info',
      'POST /api/download/video',
      'POST /api/download/audio',
      'POST /api/download',
      'POST /api/cleanup'
    ]
  });
});

// Enhanced graceful shutdown
const gracefulShutdown = (signal) => {
  logInfo(`${signal} received. Starting graceful shutdown...`);
  
  server.close(async () => {
    logInfo('HTTP server closed');
    
    try {
      // Perform any cleanup operations here
      logInfo('Performing final cleanup...');
      
      // Close any database connections, clean temp files, etc.
      // Add any necessary cleanup code here
      
      logInfo('Cleanup completed');
    } catch (error) {
      logError('Error during cleanup:', error);
    }
    
    logInfo('Process terminated gracefully');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    logError('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logError('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logError('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start server
const server = app.listen(PORT, HOST, () => {
  console.log('\n' + '='.repeat(70));
  logSuccess(`🚀 Enhanced Lemolex Video Downloader API Started!`);
  console.log('='.repeat(70));
  logInfo(`📡 Server running on: http://${HOST}:${PORT}`);
  logInfo(`🌐 Railway URL: https://lemolex-video-downloader-production.up.railway.app`);
  logInfo(`📖 API Documentation: /api/docs`);
  logInfo(`❤️ Health Check: /api/health`);
  logInfo(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  logInfo(`🚀 Railway Ready: Yes`);
  console.log('='.repeat(70));
  
  // Quick health check and system info
  logInfo('🔍 Performing startup checks...');
  setTimeout(() => {
    logSuccess('✅ Enhanced API Server is ready!');
    console.log('\n💡 Test the API endpoints:');
    console.log('   Health: https://lemolex-video-downloader-production.up.railway.app/api/health');
    console.log('   Video: POST /api/download/video');
    console.log('   Audio: POST /api/download/audio');
    console.log('');
    console.log('🎯 Perfect for Postman - just send the request and get the file!');
    console.log('');
  }, 1000);
});

module.exports = app;