/**
 * Enhanced Lemolex Video Downloader API Routes
 * Returns files directly with automatic cleanup
 * Author: Billy
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const DownloadManager = require('./downloadManager');
const { logInfo, logError, logSuccess, validateYouTubeUrl, formatFileSize } = require('./utils');

const router = express.Router();
const downloadManager = new DownloadManager();

// Middleware for request validation
const validateRequest = (req, res, next) => {
  req.startTime = Date.now();
  next();
};

// Middleware for response logging
const logResponse = (req, res, next) => {
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - req.startTime;
    logInfo(`${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    originalSend.call(this, data);
  };
  next();
};

router.use(validateRequest);
router.use(logResponse);

/**
 * Health Check Endpoint
 * GET /api/health
 */
router.get('/health', async (req, res) => {
  try {
    const systemInfo = downloadManager.getSystemInfo();
    const cleanupStats = downloadManager.getCleanupStats();
    
    const ytDlpWorking = await downloadManager.checkYtDlpAvailable();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      server: 'Enhanced Lemolex Video Downloader API',
      version: require('../package.json').version,
      uptime: process.uptime(),
      system: {
        platform: systemInfo.platform,
        arch: systemInfo.arch,
        nodeVersion: systemInfo.nodeVersion,
        memory: systemInfo.memory
      },
      dependencies: {
        ytDlp: {
          available: ytDlpWorking,
          path: systemInfo.ytDlpPath
        },
        ffmpeg: {
          available: !!systemInfo.ffmpegPath,
          path: systemInfo.ffmpegPath
        }
      },
      tempFiles: {
        count: cleanupStats.fileCount,
        totalSize: formatFileSize(cleanupStats.totalSize),
        path: cleanupStats.tempPath
      }
    });
  } catch (error) {
    logError('Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * API Documentation Endpoint
 * GET /api/docs
 */
router.get('/docs', (req, res) => {
  res.json({
    name: 'Enhanced Lemolex Video Downloader API',
    version: require('../package.json').version,
    description: 'YouTube Video & Audio Downloader API with File Return',
    author: 'Billy',
    baseUrl: `${req.protocol}://${req.get('host')}/api`,
    features: [
      '📁 Direct file download and return',
      '🗑️ Automatic temporary file cleanup',
      '⚡ Single request-response workflow',
      '🎵 Multiple format support (MP4, MP3)',
      '🔧 Quality selection options'
    ],
    endpoints: {
      health: {
        method: 'GET',
        path: '/health',
        description: 'Check API server health and status'
      },
      docs: {
        method: 'GET',
        path: '/docs',
        description: 'API documentation (this endpoint)'
      },
      info: {
        method: 'POST',
        path: '/info',
        description: 'Get YouTube video information only',
        body: {
          url: 'string (required) - YouTube video URL'
        }
      },
      downloadVideo: {
        method: 'POST',
        path: '/download/video',
        description: 'Download video and return file directly',
        body: {
          url: 'string (required) - YouTube video URL',
          quality: 'string (optional) - best|1080p|720p|480p|360p',
          filename: 'string (optional) - Custom filename'
        },
        response: 'Returns the video file directly'
      },
      downloadAudio: {
        method: 'POST',
        path: '/download/audio',
        description: 'Download audio and return MP3 file directly',
        body: {
          url: 'string (required) - YouTube video URL',
          filename: 'string (optional) - Custom filename'
        },
        response: 'Returns the audio file directly'
      },
      downloadCustom: {
        method: 'POST',
        path: '/download',
        description: 'Download with custom format options',
        body: {
          url: 'string (required) - YouTube video URL',
          format: 'string (optional) - video+audio|video-only|audio-only',
          quality: 'string (optional) - best|1080p|720p|480p|360p',
          filename: 'string (optional) - Custom filename'
        },
        response: 'Returns the downloaded file directly'
      },
      cleanup: {
        method: 'POST',
        path: '/cleanup',
        description: 'Manually trigger cleanup of temporary files'
      }
    },
    supportedFormats: [
      'video+audio - MP4 with audio (default)',
      'video-only - MP4 without audio',
      'audio-only - MP3 audio extraction'
    ],
    supportedQualities: [
      'best - Highest available quality (default)',
      '1080p - Full HD',
      '720p - HD',
      '480p - SD',
      '360p - Low quality'
    ],
    examples: {
      curl: {
        getInfo: `curl -X POST ${req.protocol}://${req.get('host')}/api/info -H "Content-Type: application/json" -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'`,
        downloadVideo: `curl -X POST ${req.protocol}://${req.get('host')}/api/download/video -H "Content-Type: application/json" -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","quality":"720p"}' --output video.mp4`,
        downloadAudio: `curl -X POST ${req.protocol}://${req.get('host')}/api/download/audio -H "Content-Type: application/json" -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}' --output audio.mp3`
      },
      postman: {
        note: 'Set request type to POST, add JSON body with URL, and Postman will automatically download the returned file'
      }
    },
    workflow: [
      '1. Send POST request to /api/download/video or /api/download/audio',
      '2. API downloads the video/audio',
      '3. API returns the file directly in the response',
      '4. Old temporary files are automatically cleaned up'
    ]
  });
});

/**
 * Get Video Information Only
 * POST /api/info
 */
router.post('/info', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        error: 'URL is required',
        example: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
      });
    }

    if (!validateYouTubeUrl(url)) {
      return res.status(400).json({
        error: 'Invalid YouTube URL',
        supportedUrls: [
          'https://www.youtube.com/watch?v=...',
          'https://youtu.be/...',
          'https://www.youtube.com/shorts/...'
        ]
      });
    }

    logInfo(`📋 Getting info for: ${url}`);
    const videoInfo = await downloadManager.getVideoInfo(url);

    res.json({
      success: true,
      data: videoInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logError('Video info error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Download Video and Return File
 * POST /api/download/video
 */
router.post('/download/video', async (req, res) => {
  try {
    const { url, quality = 'best', filename } = req.body;

    if (!url) {
      return res.status(400).json({
        error: 'URL is required',
        example: {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          quality: 'best'
        }
      });
    }

    if (!validateYouTubeUrl(url)) {
      return res.status(400).json({
        error: 'Invalid YouTube URL'
      });
    }

    const validQualities = ['best', '1080p', '720p', '480p', '360p'];
    if (!validQualities.includes(quality)) {
      return res.status(400).json({
        error: 'Invalid quality',
        supportedQualities: validQualities
      });
    }

    logInfo(`📹 Downloading video: ${url} (${quality})`);

    const result = await downloadManager.downloadAndReturnFile({
      url,
      format: 'video+audio',
      quality,
      filename
    });

    if (result.success && fs.existsSync(result.filePath)) {
      const fileStats = fs.statSync(result.filePath);
      
      logSuccess(`✅ Sending video file: ${result.filename} (${formatFileSize(fileStats.size)})`);

      // Set headers for file download
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.setHeader('Content-Length', fileStats.size);
      res.setHeader('X-Video-Title', encodeURIComponent(result.videoInfo.title));
      res.setHeader('X-Video-Duration', result.videoInfo.duration);
      res.setHeader('X-Video-Uploader', encodeURIComponent(result.videoInfo.uploader));

      // Stream the file
      const fileStream = fs.createReadStream(result.filePath);
      
      fileStream.on('end', () => {
        // Delete the file after sending
        setTimeout(() => {
          try {
            fs.unlinkSync(result.filePath);
            logInfo(`🗑️ Cleaned up: ${result.filename}`);
          } catch (error) {
            logWarning(`Failed to cleanup ${result.filename}: ${error.message}`);
          }
        }, 1000);
      });

      fileStream.pipe(res);
    } else {
      throw new Error('Failed to generate video file');
    }

  } catch (error) {
    logError('Video download error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Download Audio and Return File
 * POST /api/download/audio
 */
router.post('/download/audio', async (req, res) => {
  try {
    const { url, filename } = req.body;

    if (!url) {
      return res.status(400).json({
        error: 'URL is required',
        example: {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
        }
      });
    }

    if (!validateYouTubeUrl(url)) {
      return res.status(400).json({
        error: 'Invalid YouTube URL'
      });
    }

    logInfo(`🎵 Downloading audio: ${url}`);

    const result = await downloadManager.downloadAndReturnFile({
      url,
      format: 'audio-only',
      quality: 'best',
      filename
    });

    if (result.success && fs.existsSync(result.filePath)) {
      const fileStats = fs.statSync(result.filePath);
      
      logSuccess(`✅ Sending audio file: ${result.filename} (${formatFileSize(fileStats.size)})`);

      // Set headers for file download
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.setHeader('Content-Length', fileStats.size);
      res.setHeader('X-Video-Title', encodeURIComponent(result.videoInfo.title));
      res.setHeader('X-Video-Duration', result.videoInfo.duration);
      res.setHeader('X-Video-Uploader', encodeURIComponent(result.videoInfo.uploader));

      // Stream the file
      const fileStream = fs.createReadStream(result.filePath);
      
      fileStream.on('end', () => {
        // Delete the file after sending
        setTimeout(() => {
          try {
            fs.unlinkSync(result.filePath);
            logInfo(`🗑️ Cleaned up: ${result.filename}`);
          } catch (error) {
            logWarning(`Failed to cleanup ${result.filename}: ${error.message}`);
          }
        }, 1000);
      });

      fileStream.pipe(res);
    } else {
      throw new Error('Failed to generate audio file');
    }

  } catch (error) {
    logError('Audio download error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Download with Custom Format Options
 * POST /api/download
 */
router.post('/download', async (req, res) => {
  try {
    const { 
      url, 
      format = 'video+audio', 
      quality = 'best',
      filename
    } = req.body;

    if (!url) {
      return res.status(400).json({
        error: 'URL is required',
        example: {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          format: 'video+audio',
          quality: 'best'
        }
      });
    }

    if (!validateYouTubeUrl(url)) {
      return res.status(400).json({
        error: 'Invalid YouTube URL'
      });
    }

    const validFormats = ['video+audio', 'video-only', 'audio-only'];
    if (!validFormats.includes(format)) {
      return res.status(400).json({
        error: 'Invalid format',
        supportedFormats: validFormats
      });
    }

    const validQualities = ['best', '1080p', '720p', '480p', '360p'];
    if (!validQualities.includes(quality)) {
      return res.status(400).json({
        error: 'Invalid quality',
        supportedQualities: validQualities
      });
    }

    logInfo(`📥 Downloading: ${url} (${format}, ${quality})`);

    const result = await downloadManager.downloadAndReturnFile({
      url,
      format,
      quality,
      filename
    });

    if (result.success && fs.existsSync(result.filePath)) {
      const fileStats = fs.statSync(result.filePath);
      
      logSuccess(`✅ Sending file: ${result.filename} (${formatFileSize(fileStats.size)})`);

      // Determine content type based on format
      let contentType;
      if (format === 'audio-only') {
        contentType = 'audio/mpeg';
      } else {
        contentType = 'video/mp4';
      }

      // Set headers for file download
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.setHeader('Content-Length', fileStats.size);
      res.setHeader('X-Video-Title', encodeURIComponent(result.videoInfo.title));
      res.setHeader('X-Video-Duration', result.videoInfo.duration);
      res.setHeader('X-Video-Uploader', encodeURIComponent(result.videoInfo.uploader));
      res.setHeader('X-Download-Format', format);

      // Stream the file
      const fileStream = fs.createReadStream(result.filePath);
      
      fileStream.on('end', () => {
        // Delete the file after sending
        setTimeout(() => {
          try {
            fs.unlinkSync(result.filePath);
            logInfo(`🗑️ Cleaned up: ${result.filename}`);
          } catch (error) {
            logWarning(`Failed to cleanup ${result.filename}: ${error.message}`);
          }
        }, 1000);
      });

      fileStream.pipe(res);
    } else {
      throw new Error('Failed to generate file');
    }

  } catch (error) {
    logError('Download error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Manual Cleanup Trigger
 * POST /api/cleanup
 */
router.post('/cleanup', async (req, res) => {
  try {
    logInfo('🗑️ Manual cleanup triggered');
    
    const cleanedCount = await downloadManager.cleanupTempFiles();
    const stats = downloadManager.getCleanupStats();

    res.json({
      success: true,
      message: `Cleaned up ${cleanedCount} temporary files`,
      cleanedCount,
      remaining: {
        fileCount: stats.fileCount,
        totalSize: formatFileSize(stats.totalSize)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logError('Cleanup error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get Temporary Files Status
 * GET /api/temp-status
 */
router.get('/temp-status', (req, res) => {
  try {
    const stats = downloadManager.getCleanupStats();
    
    res.json({
      success: true,
      data: {
        fileCount: stats.fileCount,
        totalSize: formatFileSize(stats.totalSize),
        totalSizeMB: stats.totalSizeMB,
        tempPath: stats.tempPath,
        maxAge: '30 minutes',
        maxFiles: 50
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logError('Temp status error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 404 handler for API routes
router.use('*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    path: req.originalUrl,
    availableEndpoints: [
      'GET /api/health',
      'GET /api/docs',
      'POST /api/info',
      'POST /api/download/video',
      'POST /api/download/audio',
      'POST /api/download',
      'POST /api/cleanup',
      'GET /api/temp-status'
    ]
  });
});

module.exports = router;