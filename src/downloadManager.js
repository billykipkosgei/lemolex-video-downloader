/**
 * Enhanced Lemolex Video Downloader - Download Manager with Cookie Authentication
 * Railway-compatible version with cookie-based bot detection bypass
 * Author: Billy
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const sanitize = require('sanitize-filename');
const { logInfo, logError, logSuccess, logWarning } = require('./utils');

// Try to get ffmpeg path
let ffmpegPath;
try {
  ffmpegPath = require('ffmpeg-static');
  logInfo(`Found ffmpeg at: ${ffmpegPath}`);
} catch (error) {
  logWarning('ffmpeg-static not available, will use system ffmpeg');
  ffmpegPath = null;
}

class DownloadManager {
  constructor() {
    this.downloads = new Map();
    this.ytDlpPath = this.findYtDlpPath();
    this.initializeDownloadDirectory();
    this.initializeCookieDirectory();
    
    // Cleanup settings
    this.cleanupMaxAge = 30 * 60 * 1000; // 30 minutes
    this.maxTempFiles = 50; // Maximum temp files to keep
    
    logSuccess('✅ Enhanced DownloadManager with Cookie Authentication initialized');
    logInfo(`Using yt-dlp path: ${this.ytDlpPath}`);
  }

  /**
   * Initialize temporary download directory
   */
  initializeDownloadDirectory() {
    const tempPath = path.join(os.tmpdir(), 'lemolex-downloads');
    if (!fs.existsSync(tempPath)) {
      try {
        fs.mkdirSync(tempPath, { recursive: true });
        logInfo(`Created temporary download directory: ${tempPath}`);
      } catch (error) {
        logError('Failed to create temporary download directory:', error.message);
      }
    }
    this.tempDownloadPath = tempPath;
  }

  /**
   * Initialize cookie directory
   */
  initializeCookieDirectory() {
    const cookiePath = path.join(os.tmpdir(), 'lemolex-cookies');
    if (!fs.existsSync(cookiePath)) {
      try {
        fs.mkdirSync(cookiePath, { recursive: true });
        logInfo(`Created cookie directory: ${cookiePath}`);
      } catch (error) {
        logError('Failed to create cookie directory:', error.message);
      }
    }
    this.cookiePath = cookiePath;
  }

  /**
   * Find yt-dlp executable path - Railway/Docker compatible
   */
  findYtDlpPath() {
    logInfo(`🔍 Looking for yt-dlp...`);
    
    const possiblePaths = [
      '/app/bin/yt-dlp',
      path.join(__dirname, '../bin/yt-dlp'),
      path.join(process.cwd(), 'bin/yt-dlp'),
      './bin/yt-dlp',
      '/usr/local/bin/yt-dlp',
      '/usr/bin/yt-dlp',
      '/bin/yt-dlp',
      'yt-dlp'
    ];

    for (const ytdlpPath of possiblePaths) {
      try {
        if (fs.existsSync(ytdlpPath)) {
          const stats = fs.statSync(ytdlpPath);
          if (stats.size > 0) {
            try {
              fs.accessSync(ytdlpPath, fs.constants.X_OK);
              logSuccess(`✅ Found executable yt-dlp at: ${ytdlpPath}`);
              return ytdlpPath;
            } catch (execError) {
              try {
                fs.chmodSync(ytdlpPath, 0o755);
                logSuccess(`✅ Made executable and using: ${ytdlpPath}`);
                return ytdlpPath;
              } catch (chmodError) {
                continue;
              }
            }
          }
        }
      } catch (error) {
        continue;
      }
    }

    return '/app/bin/yt-dlp'; // Railway fallback
  }

  /**
   * Clean up old temporary files
   */
  async cleanupTempFiles() {
    try {
      const files = fs.readdirSync(this.tempDownloadPath);
      const now = Date.now();
      let cleaned = 0;

      const fileStats = files.map(file => {
        const filePath = path.join(this.tempDownloadPath, file);
        try {
          const stats = fs.statSync(filePath);
          return { file, filePath, mtime: stats.mtime.getTime() };
        } catch (error) {
          return null;
        }
      }).filter(Boolean);

      fileStats.sort((a, b) => a.mtime - b.mtime);

      for (const { file, filePath, mtime } of fileStats) {
        if (now - mtime > this.cleanupMaxAge) {
          try {
            fs.unlinkSync(filePath);
            logInfo(`🗑️ Cleaned old file: ${file}`);
            cleaned++;
          } catch (error) {
            logWarning(`Failed to delete ${file}: ${error.message}`);
          }
        }
      }

      const remainingFiles = fileStats.filter(({ filePath }) => fs.existsSync(filePath));
      if (remainingFiles.length > this.maxTempFiles) {
        const filesToDelete = remainingFiles.slice(0, remainingFiles.length - this.maxTempFiles);
        for (const { file, filePath } of filesToDelete) {
          try {
            fs.unlinkSync(filePath);
            logInfo(`🗑️ Cleaned excess file: ${file}`);
            cleaned++;
          } catch (error) {
            logWarning(`Failed to delete excess file ${file}: ${error.message}`);
          }
        }
      }

      if (cleaned > 0) {
        logSuccess(`✅ Cleaned up ${cleaned} temporary files`);
      }

      return cleaned;
    } catch (error) {
      logError('Cleanup error:', error.message);
      return 0;
    }
  }

  /**
   * Clean up old cookie files
   */
  cleanupOldCookies() {
    try {
      const files = fs.readdirSync(this.cookiePath);
      const now = Date.now();
      
      for (const file of files) {
        if (file.startsWith('cookies_') && file.endsWith('.txt')) {
          const filePath = path.join(this.cookiePath, file);
          const stats = fs.statSync(filePath);
          
          // Delete cookies older than 1 hour
          if (now - stats.mtime.getTime() > 60 * 60 * 1000) {
            fs.unlinkSync(filePath);
            logInfo(`Cleaned up old cookie file: ${file}`);
          }
        }
      }
    } catch (error) {
      logWarning('Failed to cleanup old cookies:', error.message);
    }
  }

  /**
   * Check if yt-dlp is available and working
   */
  async checkYtDlpAvailable() {
    return new Promise((resolve) => {
      try {
        const process = spawn(this.ytDlpPath, ['--version'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: false,
          windowsHide: true
        });

        let hasOutput = false;

        process.stdout.on('data', (data) => {
          const version = data.toString().trim();
          logSuccess(`✅ yt-dlp version: ${version}`);
          hasOutput = true;
        });

        process.on('close', (code) => {
          resolve(code === 0 && hasOutput);
        });

        process.on('error', (error) => {
          logError(`yt-dlp execution failed: ${error.message}`);
          resolve(false);
        });

        setTimeout(() => {
          try { process.kill(); } catch (e) {}
          resolve(false);
        }, 10000);

      } catch (error) {
        resolve(false);
      }
    });
  }

  /**
   * Download and return file directly with cookie authentication
   */
  async downloadAndReturnFile(options) {
    // Clean up old files
    await this.cleanupTempFiles();
    this.cleanupOldCookies();

    // Check if yt-dlp is available
    const isAvailable = await this.checkYtDlpAvailable();
    if (!isAvailable) {
      throw new Error(`yt-dlp is not installed or not accessible at: ${this.ytDlpPath}`);
    }

    const {
      url,
      format = 'video+audio',
      quality = 'best',
      filename = null,
      cookiesFromBrowser = null,
      cookies = null
    } = options;

    if (!url) {
      throw new Error('URL is required');
    }

    if (!this.isValidYouTubeUrl(url)) {
      throw new Error('Invalid YouTube URL provided');
    }

    const downloadId = uuidv4();
    logInfo(`📥 Starting download with cookie authentication: ${downloadId}`);

    try {
      // Get video info first
      const videoInfo = await this.getVideoInfo(url, { cookiesFromBrowser, cookies });
      
      // Generate filename
      const finalFilename = filename || this.generateFilename(videoInfo.title, format);
      const outputPath = path.join(this.tempDownloadPath, finalFilename);

      logInfo(`📁 Output file: ${outputPath}`);

      // Try different strategies with cookie authentication
      const strategies = [
        () => this.downloadWithCookieAuth(url, format, outputPath, quality, { cookiesFromBrowser, cookies, strategy: 'firefox' }),
        () => this.downloadWithCookieAuth(url, format, outputPath, quality, { cookiesFromBrowser: 'chrome', strategy: 'chrome' }),
        () => this.downloadWithCookieAuth(url, format, outputPath, quality, { cookiesFromBrowser: 'edge', strategy: 'edge' }),
        () => this.downloadWithAdvancedBypass(url, format, outputPath, quality)
      ];

      let lastError = null;

      for (let i = 0; i < strategies.length; i++) {
        try {
          logInfo(`Trying authentication strategy ${i + 1}/${strategies.length}`);
          const result = await strategies[i]();
          
          if (result.success) {
            logSuccess(`✅ Download successful with strategy ${i + 1}`);
            return result;
          }
        } catch (error) {
          logWarning(`Strategy ${i + 1} failed: ${error.message}`);
          lastError = error;
          
          // Add delay between attempts
          if (i < strategies.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
          continue;
        }
      }

      throw lastError || new Error('All download strategies failed');

    } catch (error) {
      logError('Download error:', error);
      throw error;
    }
  }

  /**
   * Download with cookie authentication
   */
  async downloadWithCookieAuth(url, format, outputPath, quality, authOptions) {
    const { cookiesFromBrowser, cookies, strategy } = authOptions;
    
    const args = [
      '--no-warnings',
      '--force-overwrites',
      '--ignore-errors',
      '--no-abort-on-error',
      '--socket-timeout', '30',
      '--retries', '3',
      '--fragment-retries', '3'
    ];

    // Add cookie authentication
    if (cookiesFromBrowser) {
      args.push('--cookies-from-browser', cookiesFromBrowser);
      logInfo(`Using cookies from ${cookiesFromBrowser} browser`);
    } else if (cookies) {
      // Save cookies to temporary file
      const cookieFile = path.join(this.cookiePath, `cookies_${Date.now()}.txt`);
      fs.writeFileSync(cookieFile, cookies);
      args.push('--cookies', cookieFile);
      logInfo('Using provided cookies');
    }

    // Browser-specific optimizations
    if (strategy === 'firefox') {
      args.push(
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
        '--referer', 'https://www.youtube.com/',
        '--add-header', 'Accept-Language:en-US,en;q=0.5'
      );
    } else if (strategy === 'chrome') {
      args.push(
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        '--referer', 'https://www.youtube.com/',
        '--add-header', 'Sec-Ch-Ua:"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"'
      );
    } else if (strategy === 'edge') {
      args.push(
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
        '--referer', 'https://www.youtube.com/'
      );
    }

    // Additional bypass options
    args.push(
      '--extractor-args', 'youtube:player_client=web,android',
      '--geo-bypass',
      '--geo-bypass-country', 'US',
      '--sleep-requests', '1',
      '--sleep-interval', '1',
      '--max-sleep-interval', '2'
    );

    // Output settings
    args.push('-o', outputPath);

    // Format settings
    this.addFormatArgs(args, format, ffmpegPath);
    args.push(url);

    return this.executeDownload(args, outputPath);
  }

  /**
   * Download with advanced bypass (fallback)
   */
  async downloadWithAdvancedBypass(url, format, outputPath, quality) {
    const args = [
      '--no-warnings',
      '--force-overwrites',
      '--ignore-errors',
      '--no-abort-on-error',
      '--socket-timeout', '30',
      '--retries', '5',
      '--fragment-retries', '5',
      
      // Try to bypass without cookies
      '--extractor-args', 'youtube:player_client=android,web',
      '--user-agent', 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
      '--referer', 'https://m.youtube.com/',
      '--geo-bypass',
      '--geo-bypass-country', 'US',
      '--prefer-insecure',
      '--no-check-certificates',
      '--age-limit', '0',
      
      '-o', outputPath
    ];

    this.addFormatArgs(args, format, ffmpegPath);
    args.push(url);

    return this.executeDownload(args, outputPath);
  }

  /**
   * Add format-specific arguments
   */
  addFormatArgs(args, format, ffmpegPath) {
    switch (format) {
      case 'video-only':
        args.push('-f', 'best[height<=720][ext=mp4]/best[ext=mp4]/best');
        break;
      
      case 'audio-only':
        args.push('-f', 'bestaudio[ext=m4a]/bestaudio/best');
        args.push('--extract-audio');
        args.push('--audio-format', 'mp3');
        args.push('--audio-quality', '192K');
        break;
      
      case 'video+audio':
      default:
        if (ffmpegPath) {
          args.push('-f', 'best[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best');
          args.push('--merge-output-format', 'mp4');
          args.push('--ffmpeg-location', ffmpegPath);
        } else {
          args.push('-f', 'best[height<=720][ext=mp4]/best');
        }
        break;
    }
  }

  /**
   * Execute download with given arguments
   */
  async executeDownload(args, outputPath) {
    return new Promise((resolve, reject) => {
      logInfo(`Running: "${this.ytDlpPath}" ${args.join(' ')}`);
      
      const process = spawn(this.ytDlpPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true,
        cwd: this.tempDownloadPath
      });

      let stderr = '';
      let stdout = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          // Find the actual downloaded file
          const downloadedFile = this.findDownloadedFile(this.tempDownloadPath, path.basename(outputPath));
          
          if (downloadedFile && fs.existsSync(downloadedFile)) {
            logSuccess(`✅ Download completed: ${path.basename(downloadedFile)}`);
            
            resolve({
              success: true,
              filePath: downloadedFile,
              filename: path.basename(downloadedFile),
              size: fs.statSync(downloadedFile).size,
              videoInfo: {
                title: 'Downloaded Video',
                duration: 0,
                uploader: 'Unknown'
              }
            });
          } else {
            reject(new Error('Downloaded file not found'));
          }
        } else {
          reject(new Error(stderr || `Process exited with code ${code}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Download process error: ${error.message}`));
      });

      // Timeout after 10 minutes
      setTimeout(() => {
        try { process.kill(); } catch (e) {}
        reject(new Error('Download timeout'));
      }, 600000);
    });
  }

  /**
   * Find the downloaded file
   */
  findDownloadedFile(directory, expectedFilename) {
    try {
      const files = fs.readdirSync(directory);
      
      // First, try exact match
      if (files.includes(expectedFilename)) {
        return path.join(directory, expectedFilename);
      }

      // Then, find the most recent file
      const allFiles = files
        .filter(file => fs.statSync(path.join(directory, file)).isFile())
        .map(file => ({
          file,
          mtime: fs.statSync(path.join(directory, file)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

      if (allFiles.length > 0) {
        return path.join(directory, allFiles[0].file);
      }

      return null;
    } catch (error) {
      logError('Error finding downloaded file:', error);
      return null;
    }
  }

  /**
   * Generate filename based on video title and format
   */
  generateFilename(title, format) {
    const sanitizedTitle = sanitize(title || 'video').substring(0, 100);
    const extension = this.getFileExtension(format);
    const timestamp = Date.now();
    
    return `${sanitizedTitle}_${timestamp}.${extension}`;
  }

  /**
   * Get file extension based on format
   */
  getFileExtension(format) {
    const extensions = {
      'video+audio': 'mp4',
      'video-only': 'mp4',
      'audio-only': 'mp3'
    };
    return extensions[format] || 'mp4';
  }

  /**
   * Get video information with cookie authentication
   */
  async getVideoInfo(url, authOptions = {}) {
    logInfo(`Getting video info for: ${url}`);
    
    if (!this.isValidYouTubeUrl(url)) {
      throw new Error('Invalid YouTube URL provided');
    }

    const { cookiesFromBrowser, cookies } = authOptions;

    return new Promise((resolve, reject) => {
      const args = [
        '--dump-json',
        '--no-warnings',
        '--no-check-certificates',
        '--socket-timeout', '30',
        '--retries', '3'
      ];

      // Add cookie authentication for info extraction
      if (cookiesFromBrowser) {
        args.push('--cookies-from-browser', cookiesFromBrowser);
      } else if (cookies) {
        const cookieFile = path.join(this.cookiePath, `info_cookies_${Date.now()}.txt`);
        fs.writeFileSync(cookieFile, cookies);
        args.push('--cookies', cookieFile);
      }

      args.push(
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        '--referer', 'https://www.youtube.com/',
        '--geo-bypass',
        '--geo-bypass-country', 'US',
        url
      );

      const process = spawn(this.ytDlpPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          try {
            const info = JSON.parse(stdout);
            resolve({
              id: info.id,
              title: info.title || 'Unknown Video',
              duration: info.duration || 0,
              thumbnail: info.thumbnail,
              uploader: info.uploader || 'Unknown',
              view_count: info.view_count,
              upload_date: info.upload_date,
              description: (info.description?.substring(0, 500) || 'No description') + '...',
              webpage_url: info.webpage_url
            });
          } catch (error) {
            reject(new Error('Failed to parse video information'));
          }
        } else {
          reject(new Error(stderr || 'Failed to get video information'));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`yt-dlp process error: ${error.message}`));
      });

      setTimeout(() => {
        try { process.kill(); } catch (e) {}
        reject(new Error('Video info request timed out'));
      }, 60000);
    });
  }

  /**
   * Validate YouTube URL
   */
  isValidYouTubeUrl(url) {
    const patterns = [
      /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)/,
      /^https?:\/\/(www\.)?youtube\.com\/shorts\//,
      /^https?:\/\/(www\.)?youtube\.com\/playlist\?list=/
    ];
    return patterns.some(pattern => pattern.test(url));
  }

  /**
   * Get system information
   */
  getSystemInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      ytDlpPath: this.ytDlpPath,
      ffmpegPath: ffmpegPath,
      tempDownloadPath: this.tempDownloadPath,
      cookiePath: this.cookiePath,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  }

  /**
   * Get cleanup statistics
   */
  getCleanupStats() {
    try {
      const files = fs.readdirSync(this.tempDownloadPath);
      const totalSize = files.reduce((size, file) => {
        try {
          const filePath = path.join(this.tempDownloadPath, file);
          return size + fs.statSync(filePath).size;
        } catch {
          return size;
        }
      }, 0);

      return {
        fileCount: files.length,
        totalSize: totalSize,
        totalSizeMB: Math.round(totalSize / 1024 / 1024),
        tempPath: this.tempDownloadPath
      };
    } catch {
      return {
        fileCount: 0,
        totalSize: 0,
        totalSizeMB: 0,
        tempPath: this.tempDownloadPath
      };
    }
  }
}

module.exports = DownloadManager;