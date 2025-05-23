/**
 * Enhanced Lemolex Video Downloader - Download Manager
 * Railway-compatible version with proper yt-dlp path detection
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
    this.maxTempFiles = 50; // Maximum temp files to keep
    
    logSuccess('✅ Enhanced DownloadManager initialized');
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
        const process = spawn(this.ytDlpPath, ['--version'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: false, // Don't use shell for better compatibility
          windowsHide: true
        });

        let hasOutput = false;
        let stdout = '';

        process.stdout.on('data', (data) => {
          const version = data.toString().trim();
          stdout += version;
          logSuccess(`✅ yt-dlp version: ${version}`);
          hasOutput = true;
        });

        process.stderr.on('data', (data) => {
          logWarning(`yt-dlp stderr: ${data.toString()}`);
        });

        process.on('close', (code) => {
          logInfo(`yt-dlp process exited with code: ${code}`);
          resolve(code === 0 && hasOutput);
        });

        process.on('error', (error) => {
          logError(`yt-dlp error: ${error.message}`);
          if (error.code === 'ENOENT') {
            logError(`yt-dlp not found at: ${this.ytDlpPath}`);
          }
          resolve(false);
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          try {
            process.kill();
          } catch (e) {}
          logError('yt-dlp check timed out');
          resolve(false);
        }, 10000);
      } catch (error) {
        logError(`Failed to spawn yt-dlp: ${error.message}`);
        resolve(false);
      }
    });
  }

  /**
   * Download and return file directly
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
      filename = null
    } = options;

    // Validate inputs
    if (!url) {
      throw new Error('URL is required');
    }

    if (!this.isValidYouTubeUrl(url)) {
      throw new Error('Invalid YouTube URL provided');
    }

    const downloadId = uuidv4();
    logInfo(`📥 Starting direct download: ${downloadId}`);

    try {
      // Get video info first to determine filename
      const videoInfo = await this.getVideoInfo(url);
      
      // Generate filename
      const finalFilename = filename || this.generateFilename(videoInfo.title, format);
      const outputPath = path.join(this.tempDownloadPath, finalFilename);

      logInfo(`📁 Output file: ${outputPath}`);

      // Build yt-dlp arguments
      const args = this.buildYtDlpArgs(url, format, outputPath, quality);
      
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
   * Build yt-dlp command arguments for direct download
   */
  buildYtDlpArgs(url, format, outputPath, quality) {
    const args = [
      '--no-warnings',
      '--force-overwrites',
      '--ignore-errors',
      '--no-abort-on-error',
      '--socket-timeout', '30'
    ];

    // Output path
    args.push('-o', outputPath);

    // FFmpeg location
    if (format === 'video+audio' && ffmpegPath) {
      args.push('--ffmpeg-location', ffmpegPath);
    }

    // Format selection
    switch (format) {
      case 'video-only':
        args.push('-f', 'bestvideo[ext=mp4]/bestvideo');
        break;
      
      case 'audio-only':
        args.push('-f', 'bestaudio[ext=m4a]/bestaudio');
        args.push('--extract-audio');
        args.push('--audio-format', 'mp3');
        args.push('--audio-quality', '192K');
        break;
      
      case 'video+audio':
      default:
        if (ffmpegPath) {
          args.push('-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best');
          args.push('--merge-output-format', 'mp4');
        } else {
          args.push('-f', 'best[ext=mp4]/best');
        }
        break;
    }

    args.push(url);
    return args;
  }

  /**
   * Get video information without downloading
   */
  async getVideoInfo(url) {
    logInfo(`Getting video info for: ${url}`);
    
    if (!this.isValidYouTubeUrl(url)) {
      throw new Error('Invalid YouTube URL provided');
    }

    const isAvailable = await this.checkYtDlpAvailable();
    if (!isAvailable) {
      throw new Error(`yt-dlp is not working at: ${this.ytDlpPath}`);
    }

    return new Promise((resolve, reject) => {
      const args = [
        '--dump-json',
        '--no-warnings',
        '--no-check-certificates',
        '--socket-timeout', '30',
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