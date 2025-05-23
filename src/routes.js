/**
 * Lemolex Video Downloader API Routes
 * All API endpoint definitions
 * Author: Billy
 */

const express = require('express');
const DownloadManager = require('./downloadManager');
const { logInfo, logError, logSuccess, validateYouTubeUrl } = require('./utils');

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
    const stats = downloadManager.getStats();
    
    // Quick yt-dlp check
    const ytDlpWorking = await downloadManager.checkYtDlpAvailable();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      server: 'Lemolex Video Downloader API',
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
      downloads: stats
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
    name: 'Lemolex Video Downloader API',
    version: require('../package.json').version,
    description: 'Professional YouTube Video & Audio Downloader API',
    author: 'Billy',
    baseUrl: `${req.protocol}://${req.get('host')}/api`,
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
        description: 'Get YouTube video information',
        body: {
          url: 'string (required) - YouTube video URL'
        },
        example: {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
        }
      },
      download: {
        method: 'POST',
        path: '/download',
        description: 'Start video/audio download',
        body: {
          url: 'string (required) - YouTube video URL',
          format: 'string (optional) - video+audio|video-only|audio-only',
          quality: 'string (optional) - best|1080p|720p|480p|360p',
          outputPath: 'string (optional) - Download directory path',
          filename: 'string (optional) - Custom filename'
        },
        example: {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          format: 'video+audio',
          quality: 'best'
        }
      },
      downloadStatus: {
        method: 'GET',
        path: '/download/:id',
        description: 'Get download progress and status',
        params: {
          id: 'string - Download ID returned from /download'
        }
      },
      allDownloads: {
        method: 'GET',
        path: '/downloads',
        description: 'Get all downloads with status'
      },
      stats: {
        method: 'GET',
        path: '/stats',
        description: 'Get download statistics'
      },
      clearCompleted: {
        method: 'DELETE',
        path: '/downloads/completed',
        description: 'Clear completed and failed downloads'
      },
      cancelDownload: {
        method: 'DELETE',
        path: '/download/:id',
        description: 'Cancel an active download'
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
        startDownload: `curl -X POST ${req.protocol}://${req.get('host')}/api/download -H "Content-Type: application/json" -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","format":"video+audio","quality":"best"}'`,
        checkStatus: `curl ${req.protocol}://${req.get('host')}/api/download/[DOWNLOAD_ID]`
      }
    }
  });
});

/**
 * Get Video Information
 * POST /api/info
 */
router.post('/info', async (req, res) => {
  try {
    const { url } = req.body;

    // Validate input
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
 * Start Download
 * POST /api/download
 */
router.post('/download', async (req, res) => {
  try {
    const { 
      url, 
      format = 'video+audio', 
      quality = 'best',
      outputPath,
      filename
    } = req.body;

    // Validate input
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
        error: 'Invalid YouTube URL',
        supportedUrls: [
          'https://www.youtube.com/watch?v=...',
          'https://youtu.be/...',
          'https://www.youtube.com/shorts/...'
        ]
      });
    }

    // Validate format
    const validFormats = ['video+audio', 'video-only', 'audio-only'];
    if (!validFormats.includes(format)) {
      return res.status(400).json({
        error: 'Invalid format',
        supportedFormats: validFormats
      });
    }

    // Validate quality
    const validQualities = ['best', '1080p', '720p', '480p', '360p'];
    if (!validQualities.includes(quality)) {
      return res.status(400).json({
        error: 'Invalid quality',
        supportedQualities: validQualities
      });
    }

    logInfo(`📥 Starting download: ${url} (${format}, ${quality})`);

    const downloadResult = await downloadManager.download({
      url,
      format,
      quality,
      outputPath,
      filename
    });

    logSuccess(`✅ Download queued: ${downloadResult.id}`);

    res.json({
      success: true,
      data: downloadResult,
      message: 'Download started successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logError('Download start error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get Download Status
 * GET /api/download/:id
 */
router.get('/download/:id', (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: 'Download ID is required'
      });
    }

    const downloadStatus = downloadManager.getDownloadStatus(id);

    if (!downloadStatus) {
      return res.status(404).json({
        success: false,
        error: 'Download not found',
        downloadId: id
      });
    }

    res.json({
      success: true,
      data: downloadStatus,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logError('Get download status error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get All Downloads
 * GET /api/downloads
 */
router.get('/downloads', (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    
    let downloads = downloadManager.getAllDownloads();

    // Filter by status if provided
    if (status) {
      downloads = downloads.filter(download => download.status === status);
    }

    // Limit results
    downloads = downloads.slice(0, parseInt(limit));

    res.json({
      success: true,
      data: downloads,
      total: downloads.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logError('Get downloads error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get Download Statistics
 * GET /api/stats
 */
router.get('/stats', (req, res) => {
  try {
    const stats = downloadManager.getStats();
    const systemInfo = downloadManager.getSystemInfo();

    res.json({
      success: true,
      data: {
        downloads: stats,
        system: {
          uptime: systemInfo.uptime,
          memory: systemInfo.memory,
          platform: systemInfo.platform
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logError('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Clear Completed Downloads
 * DELETE /api/downloads/completed
 */
router.delete('/downloads/completed', (req, res) => {
  try {
    const clearedCount = downloadManager.clearCompleted();

    res.json({
      success: true,
      message: `Cleared ${clearedCount} completed/failed downloads`,
      clearedCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logError('Clear completed error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Cancel Download
 * DELETE /api/download/:id
 */
router.delete('/download/:id', (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: 'Download ID is required'
      });
    }

    const cancelledDownload = downloadManager.cancelDownload(id);

    res.json({
      success: true,
      data: cancelledDownload,
      message: 'Download cancelled successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logError('Cancel download error:', error);
    
    if (error.message === 'Download not found') {
      return res.status(404).json({
        success: false,
        error: error.message,
        downloadId: id
      });
    }

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
      'POST /api/download',
      'GET /api/download/:id',
      'GET /api/downloads',
      'GET /api/stats',
      'DELETE /api/downloads/completed',
      'DELETE /api/download/:id'
    ]
  });
});

module.exports = router;