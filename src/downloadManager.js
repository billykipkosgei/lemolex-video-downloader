/**
 * Railway-Optimized Lemolex Video Downloader - Download Manager
 * Designed specifically for Railway environment without browser dependencies
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
    
    // Cleanup settings
    this.cleanupMaxAge = 30 * 60 * 1000; // 30 minutes
    this.maxTempFiles = 50;
    
    // Rotating user agents and configurations
    this.configs = [
      {
        name: 'Android YouTube App',
        userAgent: 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
        clientName: '3',
        clientVersion: '19.09.37',
        referer: 'https://m.youtube.com/',
        extractorArgs: 'youtube:player_client=android'
      },
      {
        name: 'iOS YouTube App',
        userAgent: 'com.google.ios.youtube/19.09.3 (iPhone14,2; U; CPU iOS 16_6 like Mac OS X)',
        clientName: '5',
        clientVersion: '19.09.3',
        referer: 'https://m.youtube.com/',
        extractorArgs: 'youtube:player_client=ios'
      },
      {
        name: 'Android TV',
        userAgent: 'Mozilla/5.0 (Linux; Android 10; AndroidTV) AppleWebKit/537.36',
        clientName: '7',
        clientVersion: '2.0',
        referer: 'https://www.youtube.com/tv',
        extractorArgs: 'youtube:player_client=androidtv'
      },
      {
        name: 'Web Embedded',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        clientName: '56',
        clientVersion: '1.0',
        referer: 'https://www.youtube.com/',
        extractorArgs: 'youtube:player_client=webEmbed'
      },
      {
        name: 'Mobile Web',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        clientName: '2',
        clientVersion: '2.0',
        referer: 'https://m.youtube.com/',
        extractorArgs: 'youtube:player_client=mweb'
      }
    ];
    
    logSuccess('✅ Railway-Optimized DownloadManager initialized');
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
   * Find yt-dlp executable path - Railway compatible
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
   * Download and return file directly with advanced Railway-optimized bypass
   */
  async downloadAndReturnFile(options) {
    // Clean up old files
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
      filename = null
    } = options;

    if (!url) {
      throw new Error('URL is required');
    }

    if (!this.isValidYouTubeUrl(url)) {
      throw new Error('Invalid YouTube URL provided');
    }

    const downloadId = uuidv4();
    logInfo(`📥 Starting Railway-optimized download: ${downloadId}`);

    try {
      // Get video info first
      const videoInfo = await this.getVideoInfo(url);
      
      // Generate filename
      const finalFilename = filename || this.generateFilename(videoInfo.title, format);
      const outputPath = path.join(this.tempDownloadPath, finalFilename);

      logInfo(`📁 Output file: ${outputPath}`);

      // Try different configurations in order
      let lastError = null;

      for (let i = 0; i < this.configs.length; i++) {
        const config = this.configs[i];
        
        try {
          logInfo(`Trying configuration ${i + 1}/${this.configs.length}: ${config.name}`);
          
          const result = await this.downloadWithConfig(url, format, outputPath, quality, config);
          
          if (result.success) {
            logSuccess(`✅ Download successful with ${config.name}`);
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
          logWarning(`${config.name} failed: ${error.message}`);
          lastError = error;
          
          // Add progressive delay between attempts
          if (i < this.configs.length - 1) {
            const delay = (i + 1) * 2000; // 2s, 4s, 6s, 8s, 10s
            logInfo(`Waiting ${delay/1000}s before next attempt...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          continue;
        }
      }

      // Final fallback attempt with basic settings
      try {
        logInfo('Trying final fallback method...');
        const result = await this.downloadWithBasicFallback(url, format, outputPath, quality);
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
        lastError = error;
      }

      throw lastError || new Error('All download methods failed');

    } catch (error) {
      logError('Download error:', error);
      throw error;
    }
  }

  /**
   * Download with specific configuration
   */
  async downloadWithConfig(url, format, outputPath, quality, config) {
    const args = [
      '--no-warnings',
      '--force-overwrites',
      '--ignore-errors',
      '--no-abort-on-error',
      '--socket-timeout', '30',
      '--retries', '3',
      '--fragment-retries', '3',
      '--retry-sleep', '2'
    ];

    // Configuration-specific settings
    args.push(
      '--extractor-args', config.extractorArgs,
      '--user-agent', config.userAgent,
      '--referer', config.referer
    );

    // Add client headers if available
    if (config.clientName) {
      args.push('--add-header', `X-YouTube-Client-Name:${config.clientName}`);
    }
    if (config.clientVersion) {
      args.push('--add-header', `X-YouTube-Client-Version:${config.clientVersion}`);
    }

    // Additional bypass settings
    args.push(
      '--add-header', 'Accept-Language:en-US,en;q=0.9',
      '--add-header', 'Accept-Encoding:gzip, deflate',
      '--geo-bypass',
      '--geo-bypass-country', 'US',
      '--prefer-insecure',
      '--no-check-certificates',
      '--age-limit', '0'
    );

    // Add human-like behavior
    args.push(
      '--sleep-requests', '1',
      '--sleep-interval', '1',
      '--max-sleep-interval', '3'
    );

    // Output settings
    args.push('-o', outputPath);

    // Format settings
    this.addFormatArgs(args, format, ffmpegPath);
    args.push(url);

    return this.executeDownload(args, outputPath);
  }

  /**
   * Basic fallback download method
   */
  async downloadWithBasicFallback(url, format, outputPath, quality) {
    const args = [
      '--no-warnings',
      '--force-overwrites',
      '--ignore-errors',
      '--no-abort-on-error',
      '--socket-timeout', '60',
      '--retries', '10',
      '--fragment-retries', '10',
      '--retry-sleep', '3',
      
      // Very basic settings
      '--user-agent', 'yt-dlp/2025.05.22',
      '--no-check-certificates',
      '--prefer-insecure',
      '--geo-bypass',
      '--force-ipv4',
      
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
          args.push('-f', 'best[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best');
          args.push('--merge-output-format', 'mp4');
          args.push('--ffmpeg-location', ffmpegPath);
        } else {
          args.push('-f', 'best[height<=480][ext=mp4]/best');
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

      // Timeout after 15 minutes for larger files
      setTimeout(() => {
        try { process.kill(); } catch (e) {}
        reject(new Error('Download timeout after 15 minutes'));
      }, 900000);
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
    const sanitizedTitle = sanitize(title || 'video').substring(0, 80);
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
   * Get video information with Railway-optimized method
   */
  async getVideoInfo(url) {
    logInfo(`Getting video info for: ${url}`);
    
    if (!this.isValidYouTubeUrl(url)) {
      throw new Error('Invalid YouTube URL provided');
    }

    // Try different client methods for info extraction
    const infoConfigs = [
      { client: 'android', userAgent: 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip' },
      { client: 'ios', userAgent: 'com.google.ios.youtube/19.09.3 (iPhone14,2; U; CPU iOS 16_6 like Mac OS X)' },
      { client: 'web', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    ];

    for (const config of infoConfigs) {
      try {
        const info = await this.extractVideoInfo(url, config);
        if (info) {
          return info;
        }
      } catch (error) {
        logWarning(`Info extraction with ${config.client} failed: ${error.message}`);
        continue;
      }
    }

    // Fallback with basic info
    return {
      id: this.extractVideoId(url) || 'unknown',
      title: 'YouTube Video',
      duration: 0,
      thumbnail: null,
      uploader: 'Unknown',
      view_count: 0,
      upload_date: '',
      description: 'No description available',
      webpage_url: url
    };
  }

  /**
   * Extract video info with specific client
   */
  async extractVideoInfo(url, config) {
    return new Promise((resolve, reject) => {
      const args = [
        '--dump-json',
        '--no-warnings',
        '--no-check-certificates',
        '--socket-timeout', '30',
        '--retries', '2',
        '--extractor-args', `youtube:player_client=${config.client}`,
        '--user-agent', config.userAgent,
        '--geo-bypass',
        '--geo-bypass-country', 'US',
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
              id: info.id,
              title: info.title || 'YouTube Video',
              duration: info.duration || 0,
              thumbnail: info.thumbnail,
              uploader: info.uploader || 'Unknown',
              view_count: info.view_count || 0,
              upload_date: info.upload_date || '',
              description: (info.description?.substring(0, 300) || 'No description') + '...',
              webpage_url: info.webpage_url || url
            });
          } catch (error) {
            reject(new Error('Failed to parse video information'));
          }
        } else {
          reject(new Error(stderr || 'Failed to get video information'));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Info extraction process error: ${error.message}`));
      });

      setTimeout(() => {
        try { process.kill(); } catch (e) {}
        reject(new Error('Info extraction timeout'));
      }, 30000);
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