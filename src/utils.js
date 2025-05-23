/**
 * Lemolex Video Downloader - Utility Functions
 * Helper functions and utilities
 * Author: Billy
 */

const fs = require('fs');
const path = require('path');

/**
 * Console logging with colors and timestamps
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function getTimestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function logInfo(message, ...args) {
  console.log(`${colors.cyan}[INFO]${colors.reset} ${colors.bright}[${getTimestamp()}]${colors.reset} ${message}`, ...args);
}

function logSuccess(message, ...args) {
  console.log(`${colors.green}[SUCCESS]${colors.reset} ${colors.bright}[${getTimestamp()}]${colors.reset} ${message}`, ...args);
}

function logWarning(message, ...args) {
  console.log(`${colors.yellow}[WARNING]${colors.reset} ${colors.bright}[${getTimestamp()}]${colors.reset} ${message}`, ...args);
}

function logError(message, ...args) {
  console.error(`${colors.red}[ERROR]${colors.reset} ${colors.bright}[${getTimestamp()}]${colors.reset} ${message}`, ...args);
}

/**
 * Validate YouTube URL
 */
function validateYouTubeUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  const patterns = [
    /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)/,
    /^https?:\/\/(www\.)?youtube\.com\/shorts\//,
    /^https?:\/\/(www\.)?youtube\.com\/playlist\?list=/
  ];

  return patterns.some(pattern => pattern.test(url));
}

/**
 * Format file size in human readable format
 */
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format duration from seconds to readable format
 */
function formatDuration(seconds) {
  if (!seconds || seconds === 0) return '0:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

/**
 * Format view count to readable format
 */
function formatViews(views) {
  if (!views || views === 0) return '0 views';
  
  if (views >= 1000000000) {
    return `${(views / 1000000000).toFixed(1)}B views`;
  } else if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M views`;
  } else if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K views`;
  } else {
    return `${views} views`;
  }
}

/**
 * Sanitize filename for file system
 */
function sanitizeFilename(filename) {
  if (!filename) return 'untitled';
  
  return filename
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim()
    .substring(0, 200); // Limit length
}

/**
 * Ensure directory exists
 */
function ensureDirectoryExists(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      logInfo(`Created directory: ${dirPath}`);
      return true;
    }
    return true;
  } catch (error) {
    logError(`Failed to create directory ${dirPath}:`, error.message);
    return false;
  }
}

/**
 * Check if file exists
 */
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch (error) {
    return false;
  }
}

/**
 * Get file size in bytes
 */
function getFileSize(filePath) {
  try {
    if (fileExists(filePath)) {
      return fs.statSync(filePath).size;
    }
    return 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Extract YouTube video ID from URL
 */
function extractVideoId(url) {
  if (!url) return null;
  
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]+)/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Generate thumbnail URL from video ID
 */
function getThumbnailUrl(videoId, quality = 'maxresdefault') {
  if (!videoId) return null;
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}

/**
 * Validate download format
 */
function validateFormat(format) {
  const validFormats = ['video+audio', 'video-only', 'audio-only'];
  return validFormats.includes(format);
}

/**
 * Validate quality setting
 */
function validateQuality(quality) {
  const validQualities = ['best', '1080p', '720p', '480p', '360p'];
  return validQualities.includes(quality);
}

/**
 * Get file extension based on format
 */
function getFileExtension(format) {
  const extensions = {
    'video+audio': 'mp4',
    'video-only': 'mp4',
    'audio-only': 'mp3'
  };
  return extensions[format] || 'mp4';
}

/**
 * Parse upload date to readable format
 */
function parseUploadDate(dateString) {
  if (!dateString) return 'Unknown';
  
  try {
    // yt-dlp date format: YYYYMMDD
    if (dateString.length === 8) {
      const year = dateString.substring(0, 4);
      const month = dateString.substring(4, 6);
      const day = dateString.substring(6, 8);
      const date = new Date(`${year}-${month}-${day}`);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
    
    return new Date(dateString).toLocaleDateString();
  } catch (error) {
    return 'Unknown';
  }
}

/**
 * Calculate ETA from speed and remaining bytes
 */
function calculateETA(remainingBytes, speedBytesPerSecond) {
  if (!remainingBytes || !speedBytesPerSecond || speedBytesPerSecond === 0) {
    return 'Unknown';
  }
  
  const etaSeconds = Math.round(remainingBytes / speedBytesPerSecond);
  
  if (etaSeconds < 60) {
    return `${etaSeconds}s`;
  } else if (etaSeconds < 3600) {
    const minutes = Math.floor(etaSeconds / 60);
    const seconds = etaSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  } else {
    const hours = Math.floor(etaSeconds / 3600);
    const minutes = Math.floor((etaSeconds % 3600) / 60);
    return `${hours}:${minutes.toString().padStart(2, '0')}:00`;
  }
}

/**
 * Validate and normalize output path
 */
function validateOutputPath(outputPath) {
  if (!outputPath) return null;
  
  try {
    const normalized = path.resolve(outputPath);
    
    // Check if path is valid
    if (!path.isAbsolute(normalized)) {
      return null;
    }
    
    return normalized;
  } catch (error) {
    logError('Invalid output path:', error.message);
    return null;
  }
}

/**
 * Create error response object
 */
function createErrorResponse(message, code = 500, details = null) {
  return {
    success: false,
    error: message,
    code,
    details,
    timestamp: new Date().toISOString()
  };
}

/**
 * Create success response object
 */
function createSuccessResponse(data, message = null) {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  };
}

/**
 * Rate limiting helper
 */
class RateLimiter {
  constructor(maxRequests = 10, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }

  isAllowed(clientId) {
    const now = Date.now();
    const clientRequests = this.requests.get(clientId) || [];
    
    // Remove old requests outside the window
    const validRequests = clientRequests.filter(timestamp => now - timestamp < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    validRequests.push(now);
    this.requests.set(clientId, validRequests);
    return true;
  }

  getRemainingRequests(clientId) {
    const clientRequests = this.requests.get(clientId) || [];
    const validRequests = clientRequests.filter(timestamp => Date.now() - timestamp < this.windowMs);
    return Math.max(0, this.maxRequests - validRequests.length);
  }
}

module.exports = {
  // Logging functions
  logInfo,
  logSuccess,
  logWarning,
  logError,
  
  // Validation functions
  validateYouTubeUrl,
  validateFormat,
  validateQuality,
  validateOutputPath,
  
  // Formatting functions
  formatFileSize,
  formatDuration,
  formatViews,
  parseUploadDate,
  sanitizeFilename,
  
  // File system functions
  ensureDirectoryExists,
  fileExists,
  getFileSize,
  
  // YouTube functions
  extractVideoId,
  getThumbnailUrl,
  getFileExtension,
  
  // Utility functions
  calculateETA,
  createErrorResponse,
  createSuccessResponse,
  
  // Classes
  RateLimiter
};