/**
 * Lemolex Video Downloader - Download Manager
 * Core download functionality for YouTube videos/audio
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
    
    logSuccess('✅ DownloadManager initialized');
    logInfo(`Using yt-dlp path: ${this.ytDlpPath}`);
  }

  /**
   * Initialize default download directory
   */
  initializeDownloadDirectory() {
    const defaultPath = path.join(os.homedir(), 'Downloads', 'Lemolex');
    if (!fs.existsSync(defaultPath)) {
      try {
        fs.mkdirSync(defaultPath, { recursive: true });
        logInfo(`Created default download directory: ${defaultPath}`);
      } catch (error) {
        logError('Failed to create default download directory:', error.message);
      }
    }
    this.defaultDownloadPath = defaultPath;
  }

  /**
   * Find yt-dlp executable path
   */
  findYtDlpPath() {
    const username = os.userInfo().username;
    logInfo(`🔍 Looking for yt-dlp for user: ${username}`);
    
    const possiblePaths = [
      // User-specific Python installations
      `C:\\Users\\${username}\\AppData\\Roaming\\Python\\Python313\\Scripts\\yt-dlp.exe`,
      `C:\\Users\\${username}\\AppData\\Roaming\\Python\\Python312\\Scripts\\yt-dlp.exe`,
      `C:\\Users\\${username}\\AppData\\Roaming\\Python\\Python311\\Scripts\\yt-dlp.exe`,
      `C:\\Users\\${username}\\AppData\\Roaming\\Python\\Python310\\Scripts\\yt-dlp.exe`,
      
      // Local project paths
      path.join(__dirname, '../bin/yt-dlp.exe'),
      path.join(process.cwd(), 'bin/yt-dlp.exe'),
      
      // System installations
      'C:\\Python313\\Scripts\\yt-dlp.exe',
      'C:\\Python312\\Scripts\\yt-dlp.exe',
      'C:\\Python311\\Scripts\\yt-dlp.exe',
      'C:\\Python310\\Scripts\\yt-dlp.exe',
      
      // Unix-like systems
      '/usr/local/bin/yt-dlp',
      '/usr/bin/yt-dlp',
      
      // PATH fallback
      'yt-dlp',
      'yt-dlp.exe'
    ];

    logInfo('🔍 Checking paths:');
    
    for (const ytdlpPath of possiblePaths) {
      try {
        logInfo(`   Checking: ${ytdlpPath}`);
        if (fs.existsSync(ytdlpPath)) {
          const stats = fs.statSync(ytdlpPath);
          if (stats.size > 0) {
            logSuccess(`✅ Found yt-dlp at: ${ytdlpPath} (${Math.round(stats.size / 1024 / 1024)}MB)`);
            return ytdlpPath;
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

    // Fallback to Python installation path
    const pythonPath = `C:\\Users\\${username}\\AppData\\Roaming\\Python\\Python313\\Scripts\\yt-dlp.exe`;
    logWarning(`⚠️  Using fallback Python installation path: ${pythonPath}`);
    return pythonPath;
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
          shell: true,
          windowsHide: true
        });

        let hasOutput = false;

        process.stdout.on('data', (data) => {
          const version = data.toString().trim();
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
   * Get video information without downloading
   */
  async getVideoInfo(url) {
    logInfo(`Getting video info for: ${url}`);
    
    // Validate URL
    if (!this.isValidYouTubeUrl(url)) {
      throw new Error('Invalid YouTube URL provided');
    }

    // Check if yt-dlp is available
    const isAvailable = await this.checkYtDlpAvailable();
    if (!isAvailable) {
      const errorMsg = `yt-dlp is not working at path: ${this.ytDlpPath}\n\nPlease ensure yt-dlp is installed:\n1. pip install yt-dlp\n2. Or download yt-dlp.exe to bin/ folder`;
      logError(errorMsg);
      throw new Error(errorMsg);
    }

    return new Promise((resolve, reject) => {
      const args = [
        '--dump-json',
        '--no-warnings',
        '--no-check-certificates',
        '--socket-timeout', '30',
        url
      ];

      logInfo(`Running command: "${this.ytDlpPath}" ${args.join(' ')}`);

      try {
        const process = spawn(this.ytDlpPath, args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true,
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
          logInfo(`yt-dlp info process exited with code: ${code}`);
          if (code === 0) {
            try {
              const info = JSON.parse(stdout);
              logSuccess(`✅ Successfully got info for: ${info.title}`);
              resolve({
                id: info.id,
                title: info.title,
                duration: info.duration,
                thumbnail: info.thumbnail,
                uploader: info.uploader,
                view_count: info.view_count,
                upload_date: info.upload_date,
                description: info.description?.substring(0, 500) + '...',
                formats: this.parseFormats(info.formats || []),
                webpage_url: info.webpage_url
              });
            } catch (error) {
              logError('Failed to parse video information:', error);
              logError('Raw output:', stdout);
              reject(new Error('Failed to parse video information'));
            }
          } else {
            logError('yt-dlp stderr:', stderr);
            reject(new Error(stderr || 'Failed to get video information'));
          }
        });

        process.on('error', (error) => {
          logError('yt-dlp process error:', error);
          if (error.code === 'ENOENT' || error.code === 'UNKNOWN') {
            reject(new Error(`yt-dlp not found at: ${this.ytDlpPath}\n\nInstallation guide:\n1. pip install yt-dlp\n2. Restart terminal\n3. Or download yt-dlp.exe to bin/ folder`));
          } else {
            reject(new Error(`yt-dlp process error: ${error.message}`));
          }
        });

        // Timeout after 60 seconds for info
        setTimeout(() => {
          try {
            process.kill();
          } catch (e) {}
          reject(new Error('Video info request timed out'));
        }, 60000);
      } catch (error) {
        reject(new Error(`Failed to spawn yt-dlp: ${error.message}`));
      }
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
   * Parse available formats from yt-dlp
   */
  parseFormats(formats) {
    const videoFormats = [];
    const audioFormats = [];

    formats.forEach(format => {
      if (format.vcodec !== 'none' && format.acodec === 'none') {
        // Video only
        videoFormats.push({
          format_id: format.format_id,
          ext: format.ext,
          resolution: format.resolution,
          filesize: format.filesize,
          fps: format.fps
        });
      } else if (format.vcodec === 'none' && format.acodec !== 'none') {
        // Audio only
        audioFormats.push({
          format_id: format.format_id,
          ext: format.ext,
          abr: format.abr,
          filesize: format.filesize
        });
      }
    });

    return { 
      video: videoFormats.slice(0, 10), // Limit to top 10
      audio: audioFormats.slice(0, 5)   // Limit to top 5
    };
  }

  /**
   * Download video/audio based on specified format
   */
  async download(options) {
    // Check if yt-dlp is available
    const isAvailable = await this.checkYtDlpAvailable();
    if (!isAvailable) {
      throw new Error('yt-dlp is not installed or not accessible. Please install yt-dlp first.');
    }

    const downloadId = uuidv4();
    const {
      url,
      format = 'video+audio',
      outputPath = this.defaultDownloadPath,
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

    // Prepare output path
    let cleanOutputPath = path.normalize(outputPath);
    logInfo(`📁 Using output path: ${cleanOutputPath}`);

    // Ensure output directory exists
    if (!fs.existsSync(cleanOutputPath)) {
      try {
        fs.mkdirSync(cleanOutputPath, { recursive: true });
        logSuccess(`✅ Created directory: ${cleanOutputPath}`);
      } catch (error) {
        logError(`❌ Failed to create directory: ${error.message}`);
        cleanOutputPath = this.defaultDownloadPath;
        logInfo(`📁 Falling back to: ${cleanOutputPath}`);
      }
    }

    // Initialize download status
    const downloadStatus = {
      id: downloadId,
      url,
      format,
      quality,
      status: 'starting',
      progress: 0,
      speed: '',
      eta: '',
      filename: '',
      outputPath: cleanOutputPath,
      error: null,
      startTime: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.downloads.set(downloadId, downloadStatus);
    logInfo(`📥 Download queued: ${downloadId}`);

    // Start download in background
    this.startBackgroundDownload(downloadStatus, url, format, cleanOutputPath, quality, filename);
    
    return downloadStatus;
  }

  /**
   * Start download in background
   */
  async startBackgroundDownload(downloadStatus, url, format, outputPath, quality, filename) {
    try {
      const args = this.buildYtDlpArgs(url, format, outputPath, quality, filename);
      
      logInfo(`Starting download: "${this.ytDlpPath}" ${args.join(' ')}`);
      
      const spawnOptions = {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        windowsHide: true,
        cwd: outputPath
      };

      const process = spawn(this.ytDlpPath, args, spawnOptions);

      let stderr = '';

      // Update status to downloading
      this.updateDownloadStatus(downloadStatus.id, { status: 'downloading' });
      logInfo(`📥 Download started: ${downloadStatus.id}`);

      // Handle stdout for progress
      process.stdout.on('data', (data) => {
        const output = data.toString();
        this.parseProgress(output, downloadStatus);
      });

      // Handle stderr
      process.stderr.on('data', (data) => {
        const errorOutput = data.toString();
        stderr += errorOutput;
        
        if (!errorOutput.includes('ERROR:') && !errorOutput.includes('WARNING:')) {
          this.parseProgress(errorOutput, downloadStatus);
        }
      });

      // Handle completion
      process.on('close', (code) => {
        logInfo(`Download process exited with code: ${code}`);
        if (code === 0) {
          this.updateDownloadStatus(downloadStatus.id, {
            status: 'completed',
            progress: 100,
            completedAt: new Date().toISOString()
          });
          logSuccess(`✅ Download completed: ${downloadStatus.filename}`);
        } else {
          this.updateDownloadStatus(downloadStatus.id, {
            status: 'failed',
            error: stderr || 'Download failed',
            failedAt: new Date().toISOString()
          });
          logError(`❌ Download failed: ${stderr}`);
        }
      });

      // Handle errors
      process.on('error', (error) => {
        logError('Process error:', error);
        this.updateDownloadStatus(downloadStatus.id, {
          status: 'failed',
          error: error.code === 'ENOENT' ? 'yt-dlp executable not found' : error.message,
          failedAt: new Date().toISOString()
        });
      });

    } catch (error) {
      logError('Failed to start download:', error);
      this.updateDownloadStatus(downloadStatus.id, {
        status: 'failed',
        error: error.message,
        failedAt: new Date().toISOString()
      });
    }
  }

  /**
   * Update download status
   */
  updateDownloadStatus(downloadId, updates) {
    const download = this.downloads.get(downloadId);
    if (download) {
      Object.assign(download, updates, { updatedAt: new Date().toISOString() });
      this.downloads.set(downloadId, download);
    }
  }

  /**
   * Build yt-dlp command arguments
   */
  buildYtDlpArgs(url, format, outputPath, quality, customFilename) {
    const args = [
      '--no-warnings',
      '--newline',
      '--force-overwrites',
      '--ignore-errors',
      '--no-abort-on-error'
    ];

    // Output template
    let template;
    if (customFilename) {
      template = path.join(outputPath, sanitize(customFilename));
    } else {
      const suffix = format === 'audio-only' ? '_audio' : format === 'video-only' ? '_video' : '';
      template = path.join(outputPath, `%(title)s${suffix}.%(ext)s`);
    }
    
    args.push('-o', `"${template}"`);

    // FFmpeg location
    if (format === 'video+audio' && ffmpegPath) {
      args.push('--ffmpeg-location', `"${ffmpegPath}"`);
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
   * Parse progress from yt-dlp output
   */
  parseProgress(output, downloadStatus) {
    if (downloadStatus.status === 'completed') return;

    // Progress pattern
    const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%\s+of\s+[~]?(\d+\.?\d*\w+)\s+at\s+(\d+\.?\d*\w+\/s)(?:\s+ETA\s+(\d+:\d+))?/);
    if (progressMatch) {
      this.updateDownloadStatus(downloadStatus.id, {
        progress: parseFloat(progressMatch[1]),
        speed: progressMatch[3],
        eta: progressMatch[4] || ''
      });
    }

    // Filename
    if (!downloadStatus.filename) {
      const filenameMatch = output.match(/\[download\]\s+Destination:\s+(.+)/);
      if (filenameMatch) {
        this.updateDownloadStatus(downloadStatus.id, {
          filename: path.basename(filenameMatch[1])
        });
      }
    }

    // Completion
    if (output.includes('[download] 100%') || output.includes('has already been downloaded')) {
      this.updateDownloadStatus(downloadStatus.id, {
        progress: 100,
        status: 'completed',
        completedAt: new Date().toISOString()
      });
    }

    // Processing
    if (output.includes('[ffmpeg]') || output.includes('Merging formats')) {
      this.updateDownloadStatus(downloadStatus.id, { status: 'processing' });
    }
  }

  /**
   * Get download status by ID
   */
  getDownloadStatus(downloadId) {
    return this.downloads.get(downloadId) || null;
  }

  /**
   * Get all downloads
   */
  getAllDownloads() {
    return Array.from(this.downloads.values()).sort((a, b) => 
      new Date(b.startTime) - new Date(a.startTime)
    );
  }

  /**
   * Get downloads by status
   */
  getDownloadsByStatus(status) {
    return this.getAllDownloads().filter(download => download.status === status);
  }

  /**
   * Clear completed downloads
   */
  clearCompleted() {
    let cleared = 0;
    for (const [id, download] of this.downloads.entries()) {
      if (download.status === 'completed' || download.status === 'failed') {
        this.downloads.delete(id);
        cleared++;
      }
    }
    logInfo(`🗑️  Cleared ${cleared} completed/failed downloads`);
    return cleared;
  }

  /**
   * Cancel download by ID
   */
  cancelDownload(downloadId) {
    const download = this.downloads.get(downloadId);
    if (!download) {
      throw new Error('Download not found');
    }

    if (download.status === 'completed') {
      throw new Error('Cannot cancel completed download');
    }

    this.updateDownloadStatus(downloadId, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString()
    });

    logInfo(`🚫 Download cancelled: ${downloadId}`);
    return download;
  }

  /**
   * Get download statistics
   */
  getStats() {
    const downloads = this.getAllDownloads();
    const stats = {
      total: downloads.length,
      completed: 0,
      failed: 0,
      downloading: 0,
      cancelled: 0,
      totalSize: 0
    };

    downloads.forEach(download => {
      stats[download.status] = (stats[download.status] || 0) + 1;
    });

    return stats;
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
      defaultDownloadPath: this.defaultDownloadPath,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  }
}

module.exports = DownloadManager;