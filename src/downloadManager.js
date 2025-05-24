/**
 * Alternative YouTube Downloader Manager
 * Uses multiple downloader libraries as fallbacks when yt-dlp fails
 * Author: Billy
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const sanitize = require('sanitize-filename');
const { logInfo, logError, logSuccess, logWarning } = require('./utils');

class AlternativeDownloadManager {
  constructor() {
    this.tempDownloadPath = path.join(os.tmpdir(), 'lemolex-downloads');
    this.initializeDownloadDirectory();
    
    // Cleanup settings
    this.cleanupMaxAge = 30 * 60 * 1000; // 30 minutes
    this.maxTempFiles = 50;
    
    logSuccess('✅ Alternative Download Manager initialized');
  }

  /**
   * Initialize temporary download directory
   */
  initializeDownloadDirectory() {
    if (!fs.existsSync(this.tempDownloadPath)) {
      try {
        fs.mkdirSync(this.tempDownloadPath, { recursive: true });
        logInfo(`Created temporary download directory: ${this.tempDownloadPath}`);
      } catch (error) {
        logError('Failed to create temporary download directory:', error.message);
      }
    }
  }

  /**
   * Main download method with multiple fallbacks
   */
  async downloadAndReturnFile(options) {
    await this.cleanupTempFiles();

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
    logInfo(`📥 Starting alternative download: ${downloadId}`);

    // Try different downloader methods in order
    const methods = [
      () => this.downloadWithYoutubeDl(url, format, filename),
      () => this.downloadWithPytube(url, format, filename),
      () => this.downloadWithYtDlpBypass(url, format, filename),
      () => this.downloadWithGenericExtractor(url, format, filename)
    ];

    let lastError = null;

    for (let i = 0; i < methods.length; i++) {
      try {
        logInfo(`Trying download method ${i + 1}/${methods.length}`);
        
        const result = await methods[i]();
        
        if (result.success) {
          logSuccess(`✅ Download successful with method ${i + 1}`);
          return result;
        }
      } catch (error) {
        logWarning(`Method ${i + 1} failed: ${error.message}`);
        lastError = error;
        
        // Add delay between attempts
        if (i < methods.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        continue;
      }
    }

    throw lastError || new Error('All download methods failed');
  }

  /**
   * Method 1: Try youtube-dl (often works when yt-dlp doesn't)
   */
  async downloadWithYoutubeDl(url, format, filename) {
    logInfo('Trying youtube-dl...');
    
    const finalFilename = filename || this.generateFilename('video', format);
    const outputPath = path.join(this.tempDownloadPath, finalFilename);

    return new Promise((resolve, reject) => {
      // Try youtube-dl first
      let command = 'youtube-dl';
      const args = [
        '--no-warnings',
        '--ignore-errors',
        '--no-check-certificate',
        '--prefer-insecure',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        '--referer', 'https://www.youtube.com/',
        '-o', outputPath
      ];

      // Format specific settings
      if (format === 'audio-only') {
        args.push('-x', '--audio-format', 'mp3', '--audio-quality', '192K');
      } else if (format === 'video-only') {
        args.push('-f', 'best[height<=720]');
      } else {
        args.push('-f', 'best[height<=720]');
      }

      args.push(url);

      const process = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false
      });

      let stderr = '';
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          const downloadedFile = this.findDownloadedFile(this.tempDownloadPath, finalFilename);
          
          if (downloadedFile && fs.existsSync(downloadedFile)) {
            resolve({
              success: true,
              filePath: downloadedFile,
              filename: path.basename(downloadedFile),
              size: fs.statSync(downloadedFile).size,
              videoInfo: { title: 'Downloaded Video', duration: 0, uploader: 'Unknown' }
            });
          } else {
            reject(new Error('Downloaded file not found'));
          }
        } else {
          reject(new Error(stderr || 'youtube-dl failed'));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`youtube-dl not available: ${error.message}`));
      });

      setTimeout(() => {
        try { process.kill(); } catch (e) {}
        reject(new Error('youtube-dl timeout'));
      }, 300000);
    });
  }

  /**
   * Method 2: Try pytube via Python
   */
  async downloadWithPytube(url, format, filename) {
    logInfo('Trying pytube via Python...');
    
    const finalFilename = filename || this.generateFilename('video', format);
    const outputPath = path.join(this.tempDownloadPath, finalFilename);

    const pythonScript = this.generatePytubeScript(url, outputPath, format);
    const scriptPath = path.join(this.tempDownloadPath, `pytube_${Date.now()}.py`);
    
    try {
      fs.writeFileSync(scriptPath, pythonScript);
      
      return new Promise((resolve, reject) => {
        const process = spawn('python3', [scriptPath], {
          stdio: ['pipe', 'pipe', 'pipe']
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
          try { fs.unlinkSync(scriptPath); } catch (e) {}
          
          if (code === 0 && fs.existsSync(outputPath)) {
            resolve({
              success: true,
              filePath: outputPath,
              filename: path.basename(outputPath),
              size: fs.statSync(outputPath).size,
              videoInfo: { title: 'Downloaded Video', duration: 0, uploader: 'Unknown' }
            });
          } else {
            reject(new Error(stderr || 'pytube failed'));
          }
        });

        process.on('error', (error) => {
          try { fs.unlinkSync(scriptPath); } catch (e) {}
          reject(new Error(`Python/pytube not available: ${error.message}`));
        });

        setTimeout(() => {
          try { process.kill(); } catch (e) {}
          try { fs.unlinkSync(scriptPath); } catch (e) {}
          reject(new Error('pytube timeout'));
        }, 300000);
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Method 3: yt-dlp with extreme bypass settings
   */
  async downloadWithYtDlpBypass(url, format, filename) {
    logInfo('Trying yt-dlp with extreme bypass...');
    
    const finalFilename = filename || this.generateFilename('video', format);
    const outputPath = path.join(this.tempDownloadPath, finalFilename);

    return new Promise((resolve, reject) => {
      const args = [
        '--no-warnings',
        '--force-overwrites',
        '--ignore-errors',
        '--no-abort-on-error',
        '--socket-timeout', '60',
        '--retries', '15',
        '--fragment-retries', '15',
        '--retry-sleep', '5',
        
        // Extreme bypass settings
        '--extractor-args', 'youtube:player_client=android,ios,web,mweb,smarttv',
        '--user-agent', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        '--referer', 'https://www.google.com/',
        '--add-header', 'Accept:*/*',
        '--add-header', 'Accept-Language:en-US,en;q=0.5',
        '--add-header', 'Cache-Control:no-cache',
        '--add-header', 'Pragma:no-cache',
        
        // Geographic and network bypass
        '--geo-bypass',
        '--geo-bypass-country', 'US',
        '--prefer-insecure',
        '--no-check-certificates',
        '--force-ipv4',
        
        // Age and content bypass
        '--age-limit', '0',
        '--mark-watched',
        
        // Throttling to avoid detection
        '--sleep-requests', '3',
        '--sleep-interval', '2',
        '--max-sleep-interval', '5',
        
        '-o', outputPath
      ];

      // Format settings
      if (format === 'audio-only') {
        args.push('-f', 'bestaudio[ext=m4a]/bestaudio/best', '--extract-audio', '--audio-format', 'mp3');
      } else if (format === 'video-only') {
        args.push('-f', 'best[height<=360][ext=mp4]/best[ext=mp4]/best');
      } else {
        args.push('-f', 'best[height<=360][ext=mp4]/best');
      }

      args.push(url);

      const ytDlpPath = this.findYtDlpPath();
      const process = spawn(ytDlpPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false
      });

      let stderr = '';
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          const downloadedFile = this.findDownloadedFile(this.tempDownloadPath, finalFilename);
          
          if (downloadedFile && fs.existsSync(downloadedFile)) {
            resolve({
              success: true,
              filePath: downloadedFile,
              filename: path.basename(downloadedFile),
              size: fs.statSync(downloadedFile).size,
              videoInfo: { title: 'Downloaded Video', duration: 0, uploader: 'Unknown' }
            });
          } else {
            reject(new Error('Downloaded file not found'));
          }
        } else {
          reject(new Error(stderr || 'yt-dlp extreme bypass failed'));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`yt-dlp process error: ${error.message}`));
      });

      setTimeout(() => {
        try { process.kill(); } catch (e) {}
        reject(new Error('yt-dlp extreme bypass timeout'));
      }, 600000);
    });
  }

  /**
   * Method 4: Generic extractor fallback
   */
  async downloadWithGenericExtractor(url, format, filename) {
    logInfo('Trying generic extractor...');
    
    const finalFilename = filename || this.generateFilename('video', format);
    const outputPath = path.join(this.tempDownloadPath, finalFilename);

    return new Promise((resolve, reject) => {
      const ytDlpPath = this.findYtDlpPath();
      const args = [
        '--no-warnings',
        '--force-overwrites',
        '--ignore-errors',
        '--default-search', 'ytsearch',
        '--extractor-args', 'generic:',
        '--user-agent', 'curl/7.68.0',
        '--no-check-certificates',
        '-f', 'worst',
        '-o', outputPath,
        url
      ];

      const process = spawn(ytDlpPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false
      });

      let stderr = '';
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          const downloadedFile = this.findDownloadedFile(this.tempDownloadPath, finalFilename);
          
          if (downloadedFile && fs.existsSync(downloadedFile)) {
            resolve({
              success: true,
              filePath: downloadedFile,
              filename: path.basename(downloadedFile),
              size: fs.statSync(downloadedFile).size,
              videoInfo: { title: 'Downloaded Video', duration: 0, uploader: 'Unknown' }
            });
          } else {
            reject(new Error('Downloaded file not found'));
          }
        } else {
          reject(new Error('Generic extractor failed'));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Generic extractor error: ${error.message}`));
      });

      setTimeout(() => {
        try { process.kill(); } catch (e) {}
        reject(new Error('Generic extractor timeout'));
      }, 300000);
    });
  }

  /**
   * Generate pytube Python script
   */
  generatePytubeScript(url, outputPath, format) {
    return `
#!/usr/bin/env python3
import sys
import os

try:
    from pytube import YouTube
    
    def download_video(url, output_path, format_type):
        try:
            yt = YouTube(url)
            
            if format_type == 'audio-only':
                stream = yt.streams.filter(only_audio=True).first()
            else:
                stream = yt.streams.filter(progressive=True, file_extension='mp4').order_by('resolution').desc().first()
                if not stream:
                    stream = yt.streams.filter(adaptive=True, file_extension='mp4').order_by('resolution').desc().first()
            
            if stream:
                # Download to specific path
                directory = os.path.dirname(output_path)
                filename = os.path.basename(output_path)
                stream.download(output_path=directory, filename=filename)
                print(f"Downloaded: {output_path}")
                return True
            else:
                print("No suitable stream found")
                return False
                
        except Exception as e:
            print(f"Error: {str(e)}")
            return False
    
    # Main execution
    url = "${url}"
    output_path = "${outputPath}"
    format_type = "${format}"
    
    success = download_video(url, output_path, format_type)
    
    if not success:
        sys.exit(1)
        
except ImportError:
    print("pytube not available")
    sys.exit(1)
except Exception as e:
    print(f"Unexpected error: {str(e)}")
    sys.exit(1)
`;
  }

  /**
   * Find yt-dlp path
   */
  findYtDlpPath() {
    const paths = ['/app/bin/yt-dlp', 'yt-dlp', '/usr/local/bin/yt-dlp'];
    for (const path of paths) {
      try {
        if (fs.existsSync(path)) {
          return path;
        }
      } catch (e) {}
    }
    return 'yt-dlp';
  }

  /**
   * Find downloaded file
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
   * Get video info (simplified)
   */
  async getVideoInfo(url) {
    return {
      id: this.extractVideoId(url) || 'unknown',
      title: 'YouTube Video',
      duration: 0,
      thumbnail: null,
      uploader: 'Unknown',
      view_count: 0,
      upload_date: '',
      description: 'Downloaded via alternative method',
      webpage_url: url
    };
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
   * Clean up temp files
   */
  async cleanupTempFiles() {
    try {
      const files = fs.readdirSync(this.tempDownloadPath);
      const now = Date.now();
      let cleaned = 0;

      for (const file of files) {
        const filePath = path.join(this.tempDownloadPath, file);
        try {
          const stats = fs.statSync(filePath);
          if (now - stats.mtime.getTime() > this.cleanupMaxAge) {
            fs.unlinkSync(filePath);
            cleaned++;
          }
        } catch (error) {
          continue;
        }
      }

      if (cleaned > 0) {
        logSuccess(`✅ Cleaned up ${cleaned} old files`);
      }

      return cleaned;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Check if yt-dlp is available
   */
  async checkYtDlpAvailable() {
    return new Promise((resolve) => {
      try {
        const process = spawn(this.findYtDlpPath(), ['--version'], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let hasOutput = false;

        process.stdout.on('data', (data) => {
          logSuccess(`✅ yt-dlp version: ${data.toString().trim()}`);
          hasOutput = true;
        });

        process.on('close', (code) => {
          resolve(code === 0 && hasOutput);
        });

        process.on('error', () => {
          resolve(false);
        });

        setTimeout(() => {
          try { process.kill(); } catch (e) {}
          resolve(false);
        }, 5000);

      } catch (error) {
        resolve(false);
      }
    });
  }

  /**
   * Get system info
   */
  getSystemInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      tempDownloadPath: this.tempDownloadPath,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  }

  /**
   * Get cleanup stats
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

module.exports = AlternativeDownloadManager;