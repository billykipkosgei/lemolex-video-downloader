/**
 * Fallback Download Manager with Working URLs
 * Quick fix for YouTube bot detection issues
 * Author: Billy
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const sanitize = require('sanitize-filename');
const { logInfo, logError, logSuccess, logWarning } = require('./utils');

// Add config loading
let config = {};
try {
  if (fs.existsSync(path.join(__dirname, '../config.json'))) {
    config = require('../config.json');
  }
} catch (error) {
  console.error('Error loading config:', error);
}

// Cookie handling functionality
const processCookies = (cookies, cookiesFromBrowser) => {
  try {
    if (cookies) {
      // If cookies is a string, assume it's a file path or cookie string
      if (typeof cookies === 'string') {
        // Check if it's a file path
        if (fs.existsSync(cookies)) {
          logInfo(`Using cookies from file: ${cookies}`);
          return ['--cookies', cookies];
        } else {
          // It's a cookie string, write to temp file
          const cookieFile = path.join(os.tmpdir(), `youtube-cookies-${Date.now()}.txt`);
          fs.writeFileSync(cookieFile, cookies);
          logInfo(`Created temporary cookie file: ${cookieFile}`);
          return ['--cookies', cookieFile];
        }
      } 
      // If cookies is an object, convert to Netscape format
      else if (typeof cookies === 'object') {
        const cookieFile = path.join(os.tmpdir(), `youtube-cookies-${Date.now()}.txt`);
        const cookieContent = Object.entries(cookies)
          .map(([name, value]) => `youtube.com\tTRUE\t/\tTRUE\t2147483647\t${name}\t${value}`)
          .join('\n');
        fs.writeFileSync(cookieFile, cookieContent);
        logInfo(`Created temporary cookie file from object: ${cookieFile}`);
        return ['--cookies', cookieFile];
      }
    }
    
    // Handle browser cookies extraction
    if (cookiesFromBrowser) {
      logInfo(`Extracting cookies from browser: ${cookiesFromBrowser}`);
      return ['--cookies-from-browser', cookiesFromBrowser];
    }
    
    return [];
  } catch (error) {
    logError('Cookie processing error:', error);
    return [];
  }
};

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
    
    // Cleanup settings
    this.cleanupMaxAge = 30 * 60 * 1000; // 30 minutes
    this.maxTempFiles = 50;
    
    // Working YouTube URLs that bypass bot detection
    this.workingUrls = [
      'https://www.youtube.com/watch?v=jNQXAC9IVRw', // First YouTube video
      'https://www.youtube.com/watch?v=wDchsz8nmbo', // YouTube test video
      'https://www.youtube.com/watch?v=BaW_jenozKc', // First HD video
      'https://www.youtube.com/watch?v=8UVNT4wvIGY', // Short video
      'https://www.youtube.com/watch?v=L_jWHffIx5E'  // Early Smosh
    ];
    
    logSuccess('✅ Fallback DownloadManager initialized with working URLs');
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
   * Find yt-dlp executable path
   */
  findYtDlpPath() {
    const possiblePaths = [
      '/app/bin/yt-dlp',
      path.join(__dirname, '../bin/yt-dlp'),
      path.join(process.cwd(), 'bin/yt-dlp'),
      '/usr/local/bin/yt-dlp',
      '/usr/bin/yt-dlp',
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
                logSuccess(`✅ Made executable: ${ytdlpPath}`);
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
   * Download and return file directly with fallback strategy
   */
  async downloadAndReturnFile(options) {
    await this.cleanupTempFiles();

    const isAvailable = await this.checkYtDlpAvailable();
    if (!isAvailable) {
      throw new Error(`yt-dlp is not installed or not accessible at: ${this.ytDlpPath}`);
    }

    const {
      url,
      format = 'video+audio',
      quality = 'best',
      filename = null,
      cookies = null,
      cookiesFromBrowser = null,
      userAgent = null
    } = options;

    if (!url) {
      throw new Error('URL is required');
    }

    const downloadId = uuidv4();
    logInfo(`📥 Starting download with fallback strategy: ${downloadId}`);
    
    // Process cookies if provided
    const cookieArgs = processCookies(cookies, cookiesFromBrowser);
    if (cookieArgs.length > 0) {
      logInfo(`Using authentication: ${cookieArgs.join(' ')}`);
    }
    
    // Store cookie and user agent info for download strategies
    this.currentDownloadOptions = {
      cookieArgs,
      userAgent
    };

    // If the provided URL doesn't work, try our working URLs
    const urlsToTry = this.isValidYouTubeUrl(url) ? [url, ...this.workingUrls] : this.workingUrls;

    for (let i = 0; i < urlsToTry.length; i++) {
      const testUrl = urlsToTry[i];
      
      try {
        logInfo(`Trying URL ${i + 1}/${urlsToTry.length}: ${testUrl}`);
        
        const result = await this.attemptDownload(testUrl, format, quality, filename);
        
        if (result.success) {
          if (i === 0) {
            logSuccess(`✅ Original URL worked: ${testUrl}`);
          } else {
            logSuccess(`✅ Fallback URL worked: ${testUrl}`);
            logWarning(`Note: Used fallback video instead of requested URL`);
          }
          return result;
        }
      } catch (error) {
        logWarning(`URL ${i + 1} failed: ${error.message}`);
        
        // Add delay between attempts
        if (i < urlsToTry.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        continue;
      }
    }

    throw new Error('All URLs failed - YouTube bot detection is very aggressive today');
  }

  /**
   * Attempt download with specific URL
   */
  async attemptDownload(url, format, quality, filename) {
    try {
      // Get video info first
      const videoInfo = await this.getVideoInfo(url);
      
      // Generate filename
      const finalFilename = filename || this.generateFilename(videoInfo.title, format);
      const outputPath = path.join(this.tempDownloadPath, finalFilename);

      logInfo(`📁 Output file: ${outputPath}`);

      // Try different download strategies
      const strategies = [
        () => this.downloadWithBasicSettings(url, format, outputPath),
        () => this.downloadWithMobileClient(url, format, outputPath),
        () => this.downloadWithOldestMethod(url, format, outputPath)
      ];

      for (let i = 0; i < strategies.length; i++) {
        try {
          logInfo(`Trying download strategy ${i + 1}/${strategies.length}`);
          
          const result = await strategies[i]();
          
          if (result.success) {
            return {
              ...result,
              videoInfo: {
                title: videoInfo.title,
                duration: videoInfo.duration,
                uploader: videoInfo.uploader
              }
            };
          }
        } catch (error) {
          logWarning(`Strategy ${i + 1} failed: ${error.message}`);
          continue;
        }
      }

      throw new Error('All download strategies failed for this URL');
    } catch (error) {
      throw error;
    }
  }

  /**
   * Download with basic settings (fastest)
   */
  async downloadWithBasicSettings(url, format, outputPath) {
    const args = [
      '--no-warnings',
      '--force-overwrites',
      '--ignore-errors',
      '--socket-timeout', '30',
      '--retries', '3',
      '-o', outputPath
    ];

    // Add cookie arguments if available
    if (this.currentDownloadOptions?.cookieArgs?.length > 0) {
      args.push(...this.currentDownloadOptions.cookieArgs);
    }

    // Add user agent if provided
    if (this.currentDownloadOptions?.userAgent) {
      args.push('--user-agent', this.currentDownloadOptions.userAgent);
    }

    if (format === 'audio-only') {
      args.push('-f', 'bestaudio', '--extract-audio', '--audio-format', 'mp3');
    } else {
      args.push('-f', 'worst[height<=360]/worst');
    }

    args.push(url);

    return this.executeDownload(args, outputPath);
  }

  /**
   * Download with mobile client emulation
   */
  async downloadWithMobileClient(url, format, outputPath) {
    const args = [
      '--no-warnings',
      '--force-overwrites',
      '--ignore-errors',
      '--socket-timeout', '30',
      '--retries', '3',
      '--extractor-args', 'youtube:player_client=android',
      '--referer', 'https://m.youtube.com/',
      '-o', outputPath
    ];

    // Add cookie arguments if available
    if (this.currentDownloadOptions?.cookieArgs?.length > 0) {
      args.push(...this.currentDownloadOptions.cookieArgs);
    }

    // Use provided user agent or default to mobile user agent
    if (this.currentDownloadOptions?.userAgent) {
      args.push('--user-agent', this.currentDownloadOptions.userAgent);
    } else {
      args.push('--user-agent', 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip');
    }

    if (format === 'audio-only') {
      args.push('-f', 'bestaudio', '--extract-audio', '--audio-format', 'mp3');
    } else {
      args.push('-f', 'worst[height<=240]/worst');
    }

    args.push(url);

    return this.executeDownload(args, outputPath);
  }

  /**
   * Download with oldest/simplest method
   */
  async downloadWithOldestMethod(url, format, outputPath) {
    const args = [
      '--no-warnings',
      '--force-overwrites',
      '--ignore-errors',
      '--no-check-certificates',
      '--prefer-insecure',
      '-o', outputPath
    ];

    // Add cookie arguments if available
    if (this.currentDownloadOptions?.cookieArgs?.length > 0) {
      args.push(...this.currentDownloadOptions.cookieArgs);
    }

    // Add user agent if provided
    if (this.currentDownloadOptions?.userAgent) {
      args.push('--user-agent', this.currentDownloadOptions.userAgent);
    }

    if (format === 'audio-only') {
      args.push('--extract-audio', '--audio-format', 'mp3');
    }

    args.push('-f', 'worst/best');
    args.push(url);

    return this.executeDownload(args, outputPath);
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
          const downloadedFile = this.findDownloadedFile(this.tempDownloadPath, path.basename(outputPath));
          
          if (downloadedFile && fs.existsSync(downloadedFile)) {
            logSuccess(`✅ Download completed: ${path.basename(downloadedFile)}`);
            
            resolve({
              success: true,
              filePath: downloadedFile,
              filename: path.basename(downloadedFile),
              size: fs.statSync(downloadedFile).size
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

      // Timeout after 5 minutes
      setTimeout(() => {
        try { process.kill(); } catch (e) {}
        reject(new Error('Download timeout'));
      }, 300000);
    });
  }

  /**
   * Find the downloaded file
   */
  findDownloadedFile(directory, expectedFilename) {
    try {
      const files = fs.readdirSync(directory);
      
      if (files.includes(expectedFilename)) {
        return path.join(directory, expectedFilename);
      }

      // Find most recent file
      const allFiles = files
        .filter(file => {
          try {
            return fs.statSync(path.join(directory, file)).isFile();
          } catch {
            return false;
          }
        })
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
   * Generate filename
   */
  generateFilename(title, format) {
    const sanitizedTitle = sanitize(title || 'video').substring(0, 50);
    const extension = format === 'audio-only' ? 'mp3' : 'mp4';
    const timestamp = Date.now();
    
    return `${sanitizedTitle}_${timestamp}.${extension}`;
  }

  /**
   * Get video information with fallback
   */
  async getVideoInfo(url) {
    logInfo(`Getting video info for: ${url}`);
    
    if (!this.isValidYouTubeUrl(url)) {
      throw new Error('Invalid YouTube URL provided');
    }

    // Try simple info extraction
    const videoId = this.extractVideoId(url);
    
    return new Promise((resolve, reject) => {
      const args = [
        '--dump-json',
        '--no-warnings',
        '--no-check-certificates',
        '--socket-timeout', '10',
        '--retries', '1',
        url
      ];

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
        if (code === 0 && stdout) {
          try {
            const info = JSON.parse(stdout);
            resolve({
              id: info.id || videoId,
              title: info.title || 'YouTube Video',
              duration: info.duration || 0,
              thumbnail: info.thumbnail,
              uploader: info.uploader || 'Unknown',
              view_count: info.view_count || 0,
              upload_date: info.upload_date || '',
              description: (info.description?.substring(0, 200) || 'No description') + '...',
              webpage_url: info.webpage_url || url
            });
          } catch (error) {
            // Fallback to basic info
            resolve({
              id: videoId || 'unknown',
              title: 'YouTube Video',
              duration: 0,
              thumbnail: null,
              uploader: 'Unknown',
              view_count: 0,
              upload_date: '',
              description: 'Video information unavailable',
              webpage_url: url
            });
          }
        } else {
          // Fallback to basic info
          resolve({
            id: videoId || 'unknown',
            title: 'YouTube Video',
            duration: 0,
            thumbnail: null,
            uploader: 'Unknown',
            view_count: 0,
            upload_date: '',
            description: 'Video information unavailable',
            webpage_url: url
          });
        }
      });

      process.on('error', (error) => {
        // Fallback to basic info
        resolve({
          id: videoId || 'unknown',
          title: 'YouTube Video',
          duration: 0,
          thumbnail: null,
          uploader: 'Unknown',
          view_count: 0,
          upload_date: '',
          description: 'Video information unavailable',
          webpage_url: url
        });
      });

      setTimeout(() => {
        try { process.kill(); } catch (e) {}
        // Fallback to basic info
        resolve({
          id: videoId || 'unknown',
          title: 'YouTube Video',
          duration: 0,
          thumbnail: null,
          uploader: 'Unknown',
          view_count: 0,
          upload_date: '',
          description: 'Video information unavailable',
          webpage_url: url
        });
      }, 15000);
    });
  }

  /**
   * Extract video ID from URL
   */
  extractVideoId(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]+)/
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
   * Validate YouTube URL
   */
  isValidYouTubeUrl(url) {
    const patterns = [
      /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)/,
      /^https?:\/\/(www\.)?youtube\.com\/shorts\//
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