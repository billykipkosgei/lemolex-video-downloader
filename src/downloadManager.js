/**
 * Enhanced Lemolex Video Downloader - Download Manager with Cookie Support
 * Railway-compatible version with proper yt-dlp path detection and cookie handling
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
    
    logSuccess('✅ Enhanced DownloadManager with Cookie Support initialized');
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
   * Initialize cookie directory for storing cookies
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
   * Save cookies to a temporary file
   */
  saveCookies(cookies) {
    try {
      const cookieFile = path.join(this.cookiePath, `cookies_${Date.now()}.txt`);
      
      // Format cookies for Netscape format if it's JSON
      let cookieContent;
      if (typeof cookies === 'string') {
        // Assume it's already in Netscape format
        cookieContent = cookies;
      } else if (Array.isArray(cookies) || typeof cookies === 'object') {
        // Convert JSON cookies to Netscape format
        cookieContent = this.convertJsonToNetscape(cookies);
      } else {
        throw new Error('Invalid cookie format');
      }
      
      // Ensure proper header
      if (!cookieContent.startsWith('# Netscape HTTP Cookie File') && 
          !cookieContent.startsWith('# HTTP Cookie File')) {
        cookieContent = '# Netscape HTTP Cookie File\n' + cookieContent;
      }
      
      fs.writeFileSync(cookieFile, cookieContent);
      logInfo(`Saved cookies to: ${cookieFile}`);
      
      // Clean up old cookie files (keep only recent ones)
      this.cleanupOldCookies();
      
      return cookieFile;
    } catch (error) {
      logError('Failed to save cookies:', error.message);
      return null;
    }
  }

  /**
   * Convert JSON cookies to Netscape format
   */
  convertJsonToNetscape(cookies) {
    let netscapeFormat = '# Netscape HTTP Cookie File\n';
    
    const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
    
    for (const cookie of cookieArray) {
      if (cookie.domain && cookie.name && cookie.value) {
        const domain = cookie.domain;
        const flag = domain.startsWith('.') ? 'TRUE' : 'FALSE';
        const path = cookie.path || '/';
        const secure = cookie.secure ? 'TRUE' : 'FALSE';
        const expiration = cookie.expirationDate || '0';
        const name = cookie.name;
        const value = cookie.value;
        
        netscapeFormat += `${domain}\t${flag}\t${path}\t${secure}\t${expiration}\t${name}\t${value}\n`;
      }
    }
    
    return netscapeFormat;
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
   * Find yt-dlp executable path - Railway/Docker compatible
   */
  findYtDlpPath() {
    logInfo(`🔍 Looking for yt-dlp...`);
    
    const possiblePaths = [
      // Railway/Docker paths (prioritize these)
      '/app/bin/yt-dlp',
      path.join(__dirname, '../bin/yt-dlp'),
      path.join(process.cwd(), 'bin/yt-dlp'),
      './bin/yt-dlp',
      
      // Container/Linux system paths
      '/usr/local/bin/yt-dlp',
      '/usr/bin/yt-dlp',
      '/bin/yt-dlp',
      
      // PATH fallback
      'yt-dlp',
      
      // Windows paths (for local development)
      path.join(process.cwd(), 'bin', 'yt-dlp.exe'),
      'yt-dlp.exe'
    ];

    logInfo('🔍 Checking paths:');
    
    for (const ytdlpPath of possiblePaths) {
      try {
        logInfo(`   Checking: ${ytdlpPath}`);
        if (fs.existsSync(ytdlpPath)) {
          const stats = fs.statSync(ytdlpPath);
          if (stats.size > 0) {
            // Check if it's executable
            try {
              fs.accessSync(ytdlpPath, fs.constants.X_OK);
              logSuccess(`✅ Found executable yt-dlp at: ${ytdlpPath} (${Math.round(stats.size / 1024 / 1024)}MB)`);
              return ytdlpPath;
            } catch (execError) {
              logWarning(`⚠️  File exists but not executable: ${ytdlpPath}`);
              // Try to make it executable
              try {
                fs.chmodSync(ytdlpPath, 0o755);
                logSuccess(`✅ Made executable and using: ${ytdlpPath}`);
                return ytdlpPath;
              } catch (chmodError) {
                logWarning(`⚠️  Could not make executable: ${chmodError.message}`);
              }
            }
          } else {
            logWarning(`⚠️  File is empty, skipping`);
          }
        } else {
          logInfo(`   ❌ Not found`);
        }
      } catch (error) {
        logWarning(`   ⚠️  Error checking: ${error.message}`);
        continue;
      }
    }

    // Fallback to Railway expected path
    const railwayPath = '/app/bin/yt-dlp';
    logWarning(`⚠️  Using Railway fallback path: ${railwayPath}`);
    return railwayPath;
  }

  /**
   * Clean up old temporary files
   */
  async cleanupTempFiles() {
    try {
      const files = fs.readdirSync(this.tempDownloadPath);
      const now = Date.now();
      let cleaned = 0;

      // Sort files by modification time (oldest first)
      const fileStats = files.map(file => {
        const filePath = path.join(this.tempDownloadPath, file);
        try {
          const stats = fs.statSync(filePath);
          return { file, filePath, mtime: stats.mtime.getTime(), size: stats.size };
        } catch (error) {
          return null;
        }
      }).filter(Boolean);

      fileStats.sort((a, b) => a.mtime - b.mtime);

      // Clean by age
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

      // Clean by count (keep only the most recent files)
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
   * Check if yt-dlp is available and working
   */
  async checkYtDlpAvailable() {
    return new Promise((resolve) => {
      logInfo(`Testing yt-dlp at: ${this.ytDlpPath}`);
      
      try {
        // Try with python3 first, then fallback to direct execution
        const processes = [
          () => spawn('python3', [this.ytDlpPath, '--version'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: false,
            windowsHide: true
          }),
          () => spawn(this.ytDlpPath, ['--version'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: false,
            windowsHide: true
          })
        ];

        let processIndex = 0;

        const tryNextProcess = () => {
          if (processIndex >= processes.length) {
            logError('All yt-dlp execution methods failed');
            resolve(false);
            return;
          }

          const process = processes[processIndex]();
          processIndex++;

          let hasOutput = false;
          let stdout = '';

          process.stdout.on('data', (data) => {
            const version = data.toString().trim();
            stdout += version;
            logSuccess(`✅ yt-dlp version: ${version}`);
            hasOutput = true;
          });

          process.stderr.on('data', (data) => {
            const stderr = data.toString();
            if (stderr.includes('python3') && stderr.includes('No such file')) {
              logWarning(`Python3 not found, trying direct execution...`);
            } else {
              logWarning(`yt-dlp stderr: ${stderr}`);
            }
          });

          process.on('close', (code) => {
            logInfo(`yt-dlp process exited with code: ${code}`);
            if (code === 0 && hasOutput) {
              resolve(true);
            } else {
              tryNextProcess();
            }
          });

          process.on('error', (error) => {
            logWarning(`yt-dlp execution method ${processIndex} failed: ${error.message}`);
            tryNextProcess();
          });

          // Timeout after 5 seconds per attempt
          setTimeout(() => {
            try {
              process.kill();
            } catch (e) {}
            tryNextProcess();
          }, 5000);
        };

        tryNextProcess();

      } catch (error) {
        logError(`Failed to spawn yt-dlp: ${error.message}`);
        resolve(false);
      }
    });
  }

  /**
   * Download and return file directly with cookie support
   */
  async downloadAndReturnFile(options) {
    // Clean up old files before starting new download
    await this.cleanupTempFiles();

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
      cookies = null,
      cookiesFromBrowser = null,
      userAgent = null
    } = options;

    // Validate inputs
    if (!url) {
      throw new Error('URL is required');
    }

    if (!this.isValidYouTubeUrl(url)) {
      throw new Error('Invalid YouTube URL provided');
    }

    const downloadId = uuidv4();
    logInfo(`📥 Starting direct download with enhanced options: ${downloadId}`);

    try {
      // Get video info first to determine filename
      const videoInfo = await this.getVideoInfo(url, { cookies, cookiesFromBrowser, userAgent });
      
      // Generate filename
      const finalFilename = filename || this.generateFilename(videoInfo.title, format);
      const outputPath = path.join(this.tempDownloadPath, finalFilename);

      logInfo(`📁 Output file: ${outputPath}`);

      // Build yt-dlp arguments with cookie support
      const args = this.buildYtDlpArgs(url, format, outputPath, quality, {
        cookies,
        cookiesFromBrowser,
        userAgent
      });
      
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
            const downloadedFile = this.findDownloadedFile(this.tempDownloadPath, finalFilename, videoInfo.title);
            
            if (downloadedFile && fs.existsSync(downloadedFile)) {
              logSuccess(`✅ Download completed: ${path.basename(downloadedFile)}`);
              
              resolve({
                success: true,
                filePath: downloadedFile,
                filename: path.basename(downloadedFile),
                size: fs.statSync(downloadedFile).size,
                videoInfo: {
                  title: videoInfo.title,
                  duration: videoInfo.duration,
                  uploader: videoInfo.uploader
                }
              });
            } else {
              logError('Downloaded file not found');
              logError('stdout:', stdout);
              logError('stderr:', stderr);
              reject(new Error('Downloaded file not found'));
            }
          } else {
            logError('Download failed:', stderr);
            reject(new Error(stderr || 'Download failed'));
          }
        });

        process.on('error', (error) => {
          logError('Process error:', error);
          reject(new Error(`Download process error: ${error.message}`));
        });

        // Timeout after 10 minutes
        setTimeout(() => {
          try { process.kill(); } catch (e) {}
          reject(new Error('Download timeout'));
        }, 600000);
      });

    } catch (error) {
      logError('Download error:', error);
      throw error;
    }
  }

  /**
   * Find the downloaded file (yt-dlp might change the filename)
   */
  findDownloadedFile(directory, expectedFilename, videoTitle) {
    try {
      const files = fs.readdirSync(directory);
      
      // First, try exact match
      if (files.includes(expectedFilename)) {
        return path.join(directory, expectedFilename);
      }

      // Then, try to find files with similar names
      const sanitizedTitle = sanitize(videoTitle).toLowerCase();
      const matchingFiles = files.filter(file => {
        const fileName = file.toLowerCase();
        return fileName.includes(sanitizedTitle.substring(0, 20)) || 
               sanitizedTitle.includes(fileName.replace(/\.[^/.]+$/, "").substring(0, 20));
      });

      if (matchingFiles.length > 0) {
        // Return the most recently modified file
        const mostRecent = matchingFiles
          .map(file => ({
            file,
            mtime: fs.statSync(path.join(directory, file)).mtime
          }))
          .sort((a, b) => b.mtime - a.mtime)[0];
        
        return path.join(directory, mostRecent.file);
      }

      // Last resort: return the most recent file in the directory
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
    const sanitizedTitle = sanitize(title).substring(0, 100);
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
   * Build yt-dlp command arguments for direct download with cookie support
   */
  buildYtDlpArgs(url, format, outputPath, quality, authOptions = {}) {
    const { cookies, cookiesFromBrowser, userAgent } = authOptions;
    
    const args = [
      '--no-warnings',
      '--force-overwrites',
      '--ignore-errors',
      '--no-abort-on-error',
      '--socket-timeout', '30',
      '--retries', '5',
      '--fragment-retries', '5'
    ];

    // Cookie authentication
    if (cookies) {
      if (typeof cookies === 'string' && fs.existsSync(cookies)) {
        // It's a file path
        args.push('--cookies', cookies);
        logInfo('Using cookie file for authentication');
      } else {
        // It's cookie data, save to file
        const cookieFile = this.saveCookies(cookies);
        if (cookieFile) {
          args.push('--cookies', cookieFile);
          logInfo('Using provided cookies for authentication');
        }
      }
    } else if (cookiesFromBrowser) {
      args.push('--cookies-from-browser', cookiesFromBrowser);
      logInfo(`Using cookies from browser: ${cookiesFromBrowser}`);
    } else {
      // If no cookies provided, use advanced bypass techniques for Railway environment
      logInfo('No cookies provided, using advanced bypass techniques');
      
      // Add these arguments to bypass YouTube bot detection
      args.push(
        '--mark-watched',
        '--no-playlist',
        '--embed-metadata',
        '--embed-thumbnail',
        '--geo-bypass',
        '--geo-bypass-country', 'US',
        '--no-check-certificates'
      );
    }

    // User agent
    if (userAgent) {
      args.push('--user-agent', userAgent);
      logInfo('Using custom user agent');
    } else {
      // Default to a realistic user agent
      args.push('--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    }

    // Enhanced bot detection bypass
    args.push(
      '--referer', 'https://www.youtube.com/',
      '--add-header', 'Accept-Language:en-US,en;q=0.9',
      '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      '--add-header', 'Sec-Fetch-Mode:navigate',
      '--add-header', 'Sec-Fetch-Site:same-origin',
      '--add-header', 'Sec-Fetch-User:?1',
      '--add-header', 'Cache-Control:max-age=0',
      '--no-check-certificate',
      '--prefer-insecure',
      // Use different extractor arguments to avoid bot detection
      '--extractor-args', 'youtube:player_client=android,web',
      // Add delay to seem more human-like
      '--sleep-requests', '1',
      '--sleep-subtitles', '1'
    );

    // Output path
    args.push('-o', outputPath);

    // FFmpeg location
    if (format === 'video+audio' && ffmpegPath) {
      args.push('--ffmpeg-location', ffmpegPath);
    }

    // Format selection with bot bypass
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
          args.push('-f', 'best[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best');
          args.push('--merge-output-format', 'mp4');
        } else {
          args.push('-f', 'best[height<=720][ext=mp4]/best');
        }
        break;
    }

    args.push(url);
    return args;
  }

  /**
   * Get video information without downloading, with authentication support
   */
  async getVideoInfo(url, authOptions = {}) {
    logInfo(`Getting video info for: ${url}`);
    
    if (!this.isValidYouTubeUrl(url)) {
      throw new Error('Invalid YouTube URL provided');
    }

    const isAvailable = await this.checkYtDlpAvailable();
    if (!isAvailable) {
      throw new Error(`yt-dlp is not working at: ${this.ytDlpPath}`);
    }

    const { cookies, cookiesFromBrowser, userAgent } = authOptions;

    return new Promise((resolve, reject) => {
      const args = [
        '--dump-json',
        '--no-warnings',
        '--no-check-certificates',
        '--socket-timeout', '30',
        '--retries', '5',
        '--fragment-retries', '5'
      ];

      // Add authentication options
      if (cookies) {
        if (typeof cookies === 'string' && fs.existsSync(cookies)) {
          args.push('--cookies', cookies);
        } else {
          const cookieFile = this.saveCookies(cookies);
          if (cookieFile) {
            args.push('--cookies', cookieFile);
          }
        }
      } else if (cookiesFromBrowser) {
        args.push('--cookies-from-browser', cookiesFromBrowser);
      } else {
        // If no cookies provided, use advanced bypass techniques for Railway environment
        logInfo('No cookies provided for video info, using advanced bypass techniques');
        
        // Add these arguments to bypass YouTube bot detection
        args.push(
          '--mark-watched',
          '--no-playlist',
          '--geo-bypass',
          '--geo-bypass-country', 'US'
        );
      }

      if (userAgent) {
        args.push('--user-agent', userAgent);
      } else {
        args.push('--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      }

      args.push(
        '--referer', 'https://www.youtube.com/',
        '--add-header', 'Accept-Language:en-US,en;q=0.9',
        '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        '--add-header', 'Sec-Fetch-Mode:navigate',
        '--add-header', 'Sec-Fetch-Site:same-origin',
        '--add-header', 'Sec-Fetch-User:?1',
        '--add-header', 'Cache-Control:max-age=0',
        '--extractor-args', 'youtube:player_client=android,web',
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
              title: info.title,
              duration: info.duration,
              thumbnail: info.thumbnail,
              uploader: info.uploader,
              view_count: info.view_count,
              upload_date: info.upload_date,
              description: info.description?.substring(0, 500) + '...',
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