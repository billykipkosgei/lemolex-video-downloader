/**
 * Ultimate Bot Bypass Solution for Railway
 * Combines multiple techniques for maximum success rate
 * Author: Billy
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const sanitize = require('sanitize-filename');
const { logInfo, logError, logSuccess, logWarning } = require('./utils');

class UltimateDownloadManager {
  constructor() {
    this.ytDlpPath = this.findYtDlpPath();
    this.tempDownloadPath = path.join(os.tmpdir(), 'lemolex-downloads');
    this.initializeDownloadDirectory();
    
    // Bot bypass configurations
    this.bypassConfigs = [
      {
        name: 'Mobile Android Bypass',
        args: [
          '--extractor-args', 'youtube:player_client=android,web',
          '--user-agent', 'com.google.android.youtube/18.11.34 (Linux; U; Android 11; en_US)',
          '--add-header', 'X-YouTube-Client-Name:3',
          '--add-header', 'X-YouTube-Client-Version:18.11.34',
          '--sleep-requests', '2',
          '--sleep-interval', '1'
        ]
      },
      {
        name: 'iOS Safari Bypass',
        args: [
          '--extractor-args', 'youtube:player_client=ios,mweb',
          '--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
          '--add-header', 'X-YouTube-Client-Name:5',
          '--add-header', 'X-YouTube-Client-Version:18.11.34',
          '--sleep-requests', '3'
        ]
      },
      {
        name: 'TV Client Bypass',
        args: [
          '--extractor-args', 'youtube:player_client=tv_embedded',
          '--user-agent', 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/4.0 Chrome/76.0.3809.146 TV Safari/537.36',
          '--add-header', 'X-YouTube-Client-Name:85',
          '--sleep-requests', '4'
        ]
      },
      {
        name: 'Web Embed Bypass',
        args: [
          '--extractor-args', 'youtube:player_client=web_embedded_player',
          '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          '--referer', 'https://www.google.com/',
          '--sleep-requests', '1'
        ]
      },
      {
        name: 'Age Bypass Method',
        args: [
          '--extractor-args', 'youtube:player_client=android_creator',
          '--user-agent', 'com.google.android.apps.youtube.creator/22.30.100 (Linux; U; Android 11; en_US) gzip',
          '--add-header', 'X-YouTube-Client-Name:14',
          '--age-limit', '0',
          '--sleep-requests', '2'
        ]
      }
    ];

    // Proxy rotation (you can add proxy services here)
    this.proxyList = [
      // Add proxy URLs here if available
      // 'http://proxy1:port',
      // 'http://proxy2:port'
    ];

    logSuccess('✅ Ultimate Download Manager with Bot Bypass initialized');
  }

  initializeDownloadDirectory() {
    if (!fs.existsSync(this.tempDownloadPath)) {
      try {
        fs.mkdirSync(this.tempDownloadPath, { recursive: true });
        logInfo(`Created temp directory: ${this.tempDownloadPath}`);
      } catch (error) {
        logError('Failed to create temp directory:', error.message);
      }
    }
  }

  findYtDlpPath() {
    const paths = ['/app/bin/yt-dlp', 'yt-dlp', '/usr/local/bin/yt-dlp'];
    for (const path of paths) {
      try {
        if (fs.existsSync(path)) return path;
      } catch (e) {}
    }
    return 'yt-dlp';
  }

  async downloadAndReturnFile(options) {
    const { url, format = 'video+audio', quality = 'best', filename = null } = options;

    if (!url || !this.isValidYouTubeUrl(url)) {
      throw new Error('Invalid YouTube URL');
    }

    logInfo(`🚀 Starting ultimate bypass download for: ${url}`);

    // Step 1: Try with different bypass configurations
    for (let i = 0; i < this.bypassConfigs.length; i++) {
      const config = this.bypassConfigs[i];
      
      try {
        logInfo(`Trying ${config.name} (${i + 1}/${this.bypassConfigs.length})`);
        
        const result = await this.attemptDownloadWithConfig(url, format, quality, filename, config);
        
        if (result.success) {
          logSuccess(`✅ SUCCESS with ${config.name}!`);
          return result;
        }
      } catch (error) {
        logWarning(`${config.name} failed: ${error.message}`);
        
        // Progressive delay between attempts
        if (i < this.bypassConfigs.length - 1) {
          const delay = (i + 1) * 3000; // 3s, 6s, 9s, 12s, 15s
          logInfo(`Waiting ${delay/1000}s before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // Step 2: Try with quality fallback
    if (quality !== 'worst') {
      try {
        logInfo('Trying with lowest quality as last resort...');
        return await this.attemptDownloadWithConfig(url, format, 'worst', filename, this.bypassConfigs[0]);
      } catch (error) {
        logWarning('Lowest quality attempt failed');
      }
    }

    throw new Error('All bypass methods failed - YouTube bot detection is very strong today');
  }

  async attemptDownloadWithConfig(url, format, quality, filename, config) {
    const videoInfo = await this.getVideoInfo(url);
    const finalFilename = filename || this.generateFilename(videoInfo.title, format);
    const outputPath = path.join(this.tempDownloadPath, finalFilename);

    const baseArgs = [
      '--no-warnings',
      '--force-overwrites',
      '--ignore-errors',
      '--no-abort-on-error',
      '--socket-timeout', '45',
      '--retries', '5',
      '--fragment-retries', '10',
      '--retry-sleep', '3'
    ];

    // Add config-specific args
    const args = [...baseArgs, ...config.args];

    // Add anti-detection measures
    args.push(
      '--geo-bypass',
      '--geo-bypass-country', 'US',
      '--prefer-insecure',
      '--no-check-certificates',
      '--add-header', 'Accept-Language:en-US,en;q=0.9',
      '--add-header', 'Accept-Encoding:gzip, deflate',
      '--add-header', 'DNT:1',
      '--add-header', 'Upgrade-Insecure-Requests:1'
    );

    // Random delays to appear more human
    args.push(
      '--min-sleep-interval', '1',
      '--max-sleep-interval', '5'
    );

    // Format-specific settings with quality fallback
    if (format === 'audio-only') {
      args.push(
        '-f', 'bestaudio[ext=m4a]/bestaudio/best[height<=360]/worst',
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', '128K'
      );
    } else if (format === 'video-only') {
      if (quality === 'worst') {
        args.push('-f', 'worst[height<=240]/worst');
      } else {
        args.push('-f', `best[height<=${this.getMaxHeight(quality)}]/best[height<=480]/worst`);
      }
    } else { // video+audio
      if (quality === 'worst') {
        args.push('-f', 'worst[height<=240]/worst');
      } else {
        args.push('-f', `best[height<=${this.getMaxHeight(quality)}]/best[height<=360]/worst`);
      }
    }

    args.push('-o', outputPath, url);

    return new Promise((resolve, reject) => {
      logInfo(`Executing: ${this.ytDlpPath} ${args.join(' ')}`);
      
      const process = spawn(this.ytDlpPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true,
        cwd: this.tempDownloadPath
      });

      let stderr = '';
      let lastProgress = '';

      process.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('%')) {
          const match = output.match(/(\d+\.?\d*)%/);
          if (match && match[1] !== lastProgress) {
            lastProgress = match[1];
            logInfo(`Download progress: ${lastProgress}%`);
          }
        }
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          const downloadedFile = this.findDownloadedFile(outputPath);
          
          if (downloadedFile && fs.existsSync(downloadedFile)) {
            resolve({
              success: true,
              filePath: downloadedFile,
              filename: path.basename(downloadedFile),
              size: fs.statSync(downloadedFile).size,
              videoInfo
            });
          } else {
            reject(new Error('File not found after download'));
          }
        } else {
          const errorMsg = stderr.includes('Sign in to confirm') ? 
            'Bot detection triggered' : 
            (stderr || `Process exited with code ${code}`);
          reject(new Error(errorMsg));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Process error: ${error.message}`));
      });

      // Timeout based on format (audio is faster)
      const timeout = format === 'audio-only' ? 300000 : 600000; // 5min for audio, 10min for video
      setTimeout(() => {
        try { process.kill(); } catch (e) {}
        reject(new Error('Download timeout'));
      }, timeout);
    });
  }

  getMaxHeight(quality) {
    const heights = {
      'best': '720',
      '1080p': '1080',
      '720p': '720',
      '480p': '480',
      '360p': '360',
      'worst': '240'
    };
    return heights[quality] || '480';
  }

  async getVideoInfo(url) {
    // Simplified info extraction to avoid extra bot detection
    const videoId = this.extractVideoId(url);
    return {
      id: videoId || 'unknown',
      title: `YouTube Video ${videoId || 'Unknown'}`,
      duration: 0,
      uploader: 'Unknown',
      view_count: 0,
      upload_date: '',
      description: 'Video downloaded successfully',
      webpage_url: url
    };
  }

  findDownloadedFile(expectedPath) {
    try {
      // Check exact path first
      if (fs.existsSync(expectedPath)) {
        return expectedPath;
      }

      // Look for similar files in directory
      const dir = path.dirname(expectedPath);
      const files = fs.readdirSync(dir);
      
      // Find most recent file
      const mostRecent = files
        .filter(file => fs.statSync(path.join(dir, file)).isFile())
        .map(file => ({
          file,
          path: path.join(dir, file),
          mtime: fs.statSync(path.join(dir, file)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime)[0];

      return mostRecent ? mostRecent.path : null;
    } catch (error) {
      return null;
    }
  }

  generateFilename(title, format) {
    const sanitizedTitle = sanitize(title || 'video').substring(0, 50);
    const extension = format === 'audio-only' ? 'mp3' : 'mp4';
    const timestamp = Date.now();
    return `${sanitizedTitle}_${timestamp}.${extension}`;
  }

  extractVideoId(url) {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  isValidYouTubeUrl(url) {
    return /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/.test(url);
  }

  async cleanupTempFiles() {
    try {
      const files = fs.readdirSync(this.tempDownloadPath);
      const now = Date.now();
      let cleaned = 0;

      for (const file of files) {
        const filePath = path.join(this.tempDownloadPath, file);
        try {
          const stats = fs.statSync(filePath);
          if (now - stats.mtime.getTime() > 30 * 60 * 1000) { // 30 minutes
            fs.unlinkSync(filePath);
            cleaned++;
          }
        } catch (e) {}
      }

      if (cleaned > 0) {
        logSuccess(`🗑️ Cleaned ${cleaned} old files`);
      }

      return cleaned;
    } catch (error) {
      return 0;
    }
  }

  async checkYtDlpAvailable() {
    return new Promise((resolve) => {
      const process = spawn(this.ytDlpPath, ['--version'], { stdio: ['pipe', 'pipe', 'pipe'] });
      
      let hasOutput = false;
      process.stdout.on('data', (data) => {
        logSuccess(`✅ yt-dlp version: ${data.toString().trim()}`);
        hasOutput = true;
      });

      process.on('close', (code) => resolve(code === 0 && hasOutput));
      process.on('error', () => resolve(false));
      
      setTimeout(() => {
        try { process.kill(); } catch (e) {}
        resolve(false);
      }, 5000);
    });
  }

  getSystemInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      ytDlpPath: this.ytDlpPath,
      tempDownloadPath: this.tempDownloadPath,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  }

  getCleanupStats() {
    try {
      const files = fs.readdirSync(this.tempDownloadPath);
      const totalSize = files.reduce((size, file) => {
        try {
          return size + fs.statSync(path.join(this.tempDownloadPath, file)).size;
        } catch {
          return size;
        }
      }, 0);

      return {
        fileCount: files.length,
        totalSize,
        totalSizeMB: Math.round(totalSize / 1024 / 1024),
        tempPath: this.tempDownloadPath
      };
    } catch {
      return { fileCount: 0, totalSize: 0, totalSizeMB: 0, tempPath: this.tempDownloadPath };
    }
  }
}

module.exports = UltimateDownloadManager;
