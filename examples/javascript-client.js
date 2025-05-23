/**
 * Lemolex Video Downloader - JavaScript Client Example
 * Complete example showing how to integrate with the API
 * Author: Billy
 */

class LemolexAPI {
  constructor(baseUrl = 'http://localhost:3001/api') {
    this.baseUrl = baseUrl;
  }

  /**
   * Make HTTP request with error handling
   */
  async makeRequest(endpoint, options = {}) {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const config = {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      };

      console.log(`Making request: ${config.method || 'GET'} ${url}`);
      
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API Request failed:', error.message);
      throw error;
    }
  }

  /**
   * Check API server health
   */
  async checkHealth() {
    return this.makeRequest('/health');
  }

  /**
   * Get API documentation
   */
  async getDocs() {
    return this.makeRequest('/docs');
  }

  /**
   * Get video information
   */
  async getVideoInfo(url) {
    return this.makeRequest('/info', {
      method: 'POST',
      body: JSON.stringify({ url })
    });
  }

  /**
   * Start video download
   */
  async downloadVideo(options) {
    const {
      url,
      format = 'video+audio',
      quality = 'best',
      outputPath = null,
      filename = null
    } = options;

    const body = { url, format, quality };
    if (outputPath) body.outputPath = outputPath;
    if (filename) body.filename = filename;

    return this.makeRequest('/download', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  /**
   * Get download status
   */
  async getDownloadStatus(downloadId) {
    return this.makeRequest(`/download/${downloadId}`);
  }

  /**
   * Get all downloads
   */
  async getAllDownloads(status = null, limit = 50) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (limit) params.append('limit', limit.toString());
    
    const queryString = params.toString();
    const endpoint = `/downloads${queryString ? '?' + queryString : ''}`;
    
    return this.makeRequest(endpoint);
  }

  /**
   * Get download statistics
   */
  async getStats() {
    return this.makeRequest('/stats');
  }

  /**
   * Clear completed downloads
   */
  async clearCompleted() {
    return this.makeRequest('/downloads/completed', {
      method: 'DELETE'
    });
  }

  /**
   * Cancel a download
   */
  async cancelDownload(downloadId) {
    return this.makeRequest(`/download/${downloadId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Wait for download completion with progress updates
   */
  async waitForCompletion(downloadId, onProgress = null) {
    return new Promise((resolve, reject) => {
      const checkProgress = async () => {
        try {
          const result = await this.getDownloadStatus(downloadId);
          
          if (!result.success) {
            reject(new Error(result.error));
            return;
          }

          const download = result.data;
          
          // Call progress callback if provided
          if (onProgress && typeof onProgress === 'function') {
            onProgress(download);
          }

          // Check if download is finished
          if (download.status === 'completed') {
            resolve(download);
          } else if (download.status === 'failed') {
            reject(new Error(download.error || 'Download failed'));
          } else if (download.status === 'cancelled') {
            reject(new Error('Download was cancelled'));
          } else {
            // Continue checking
            setTimeout(checkProgress, 1000);
          }
        } catch (error) {
          reject(error);
        }
      };

      checkProgress();
    });
  }

  /**
   * Download video with real-time progress
   */
  async downloadWithProgress(options, onProgress = null) {
    console.log('Starting download with progress tracking...');
    
    // Start the download
    const downloadResult = await this.downloadVideo(options);
    const downloadId = downloadResult.data.id;
    
    console.log(`Download started with ID: ${downloadId}`);
    
    // Wait for completion with progress updates
    return this.waitForCompletion(downloadId, onProgress);
  }
}

// Example usage functions
async function example1_BasicUsage() {
  console.log('\n=== Example 1: Basic Usage ===');
  
  const api = new LemolexAPI();
  
  try {
    // Check if API is healthy
    const health = await api.checkHealth();
    console.log('API Status:', health.status);
    
    // Get video information
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    console.log(`Getting info for: ${url}`);
    
    const info = await api.getVideoInfo(url);
    console.log('Video Title:', info.data.title);
    console.log('Duration:', info.data.duration + ' seconds');
    console.log('Uploader:', info.data.uploader);
    
  } catch (error) {
    console.error('Example 1 failed:', error.message);
  }
}

async function example2_DownloadVideo() {
  console.log('\n=== Example 2: Download Video ===');
  
  const api = new LemolexAPI();
  
  try {
    const downloadOptions = {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      format: 'video+audio',
      quality: 'best'
    };
    
    const download = await api.downloadVideo(downloadOptions);
    console.log('Download ID:', download.data.id);
    console.log('Status:', download.data.status);
    
    // Check progress every 2 seconds
    const checkProgress = async () => {
      const status = await api.getDownloadStatus(download.data.id);
      console.log(`Progress: ${status.data.progress}% - ${status.data.status}`);
      
      if (status.data.status === 'completed') {
        console.log('✅ Download completed!');
        console.log('File:', status.data.filename);
      } else if (status.data.status === 'failed') {
        console.log('❌ Download failed:', status.data.error);
      } else {
        setTimeout(checkProgress, 2000);
      }
    };
    
    checkProgress();
    
  } catch (error) {
    console.error('Example 2 failed:', error.message);
  }
}

async function example3_DownloadAudio() {
  console.log('\n=== Example 3: Download Audio Only ===');
  
  const api = new LemolexAPI();
  
  try {
    const downloadOptions = {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      format: 'audio-only',
      quality: 'best'
    };
    
    // Download with progress callback
    const finalStatus = await api.downloadWithProgress(
      downloadOptions,
      (progress) => {
        console.log(`🎵 Audio Download: ${progress.progress}% (${progress.speed || 'calculating...'})`);
      }
    );
    
    console.log('✅ Audio download completed!');
    console.log('File:', finalStatus.filename);
    
  } catch (error) {
    console.error('Example 3 failed:', error.message);
  }
}

async function example4_BatchDownloads() {
  console.log('\n=== Example 4: Batch Downloads ===');
  
  const api = new LemolexAPI();
  
  try {
    const urls = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=L_jWHffIx5E',
      'https://www.youtube.com/watch?v=fJ9rUzIMcZQ'
    ];
    
    console.log(`Starting batch download of ${urls.length} videos...`);
    
    // Start all downloads
    const downloadPromises = urls.map(async (url, index) => {
      try {
        const download = await api.downloadVideo({
          url,
          format: 'audio-only',
          quality: 'best'
        });
        
        console.log(`Download ${index + 1} started: ${download.data.id}`);
        
        // Wait for completion
        return api.waitForCompletion(download.data.id, (progress) => {
          console.log(`Download ${index + 1}: ${progress.progress}% - ${progress.status}`);
        });
      } catch (error) {
        console.error(`Download ${index + 1} failed:`, error.message);
        return null;
      }
    });
    
    // Wait for all downloads to complete
    const results = await Promise.allSettled(downloadPromises);
    
    console.log('\n📊 Batch Download Results:');
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        console.log(`✅ Download ${index + 1}: ${result.value.filename}`);
      } else {
        console.log(`❌ Download ${index + 1}: Failed`);
      }
    });
    
  } catch (error) {
    console.error('Example 4 failed:', error.message);
  }
}

async function example5_ManageDownloads() {
  console.log('\n=== Example 5: Manage Downloads ===');
  
  const api = new LemolexAPI();
  
  try {
    // Get all downloads
    const allDownloads = await api.getAllDownloads();
    console.log(`Total downloads: ${allDownloads.data.length}`);
    
    // Get only completed downloads
    const completedDownloads = await api.getAllDownloads('completed');
    console.log(`Completed downloads: ${completedDownloads.data.length}`);
    
    // Get statistics
    const stats = await api.getStats();
    console.log('Download Statistics:', stats.data.downloads);
    
    // Clear completed downloads
    if (completedDownloads.data.length > 0) {
      const cleared = await api.clearCompleted();
      console.log(`Cleared ${cleared.clearedCount} completed downloads`);
    }
    
    // Show remaining downloads
    const remaining = await api.getAllDownloads();
    console.log(`Remaining downloads: ${remaining.data.length}`);
    
  } catch (error) {
    console.error('Example 5 failed:', error.message);
  }
}

async function example6_ErrorHandling() {
  console.log('\n=== Example 6: Error Handling ===');
  
  const api = new LemolexAPI();
  
  try {
    // Test with invalid URL
    console.log('Testing invalid URL...');
    try {
      await api.getVideoInfo('https://invalid-url.com');
    } catch (error) {
      console.log('✅ Caught invalid URL error:', error.message);
    }
    
    // Test with non-existent video
    console.log('Testing non-existent video...');
    try {
      await api.getVideoInfo('https://www.youtube.com/watch?v=nonexistent123');
    } catch (error) {
      console.log('✅ Caught non-existent video error:', error.message);
    }
    
    // Test with invalid download ID
    console.log('Testing invalid download ID...');
    try {
      await api.getDownloadStatus('invalid-id-123');
    } catch (error) {
      console.log('✅ Caught invalid download ID error:', error.message);
    }
    
  } catch (error) {
    console.error('Example 6 failed:', error.message);
  }
}

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Helper function to format duration
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

// Complete workflow example
async function completeWorkflow() {
  console.log('\n🚀 === Complete Workflow Example ===');
  
  const api = new LemolexAPI();
  
  try {
    // 1. Check API health
    console.log('1. Checking API health...');
    const health = await api.checkHealth();
    console.log(`   API Status: ${health.status}`);
    console.log(`   yt-dlp Available: ${health.dependencies.ytDlp.available}`);
    console.log(`   ffmpeg Available: ${health.dependencies.ffmpeg.available}`);
    
    if (!health.dependencies.ytDlp.available) {
      throw new Error('yt-dlp is not available. Please install it first.');
    }
    
    // 2. Get video information
    const videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    console.log('\n2. Getting video information...');
    console.log(`   URL: ${videoUrl}`);
    
    const videoInfo = await api.getVideoInfo(videoUrl);
    const video = videoInfo.data;
    
    console.log(`   Title: ${video.title}`);
    console.log(`   Uploader: ${video.uploader}`);
    console.log(`   Duration: ${formatDuration(video.duration)}`);
    console.log(`   Views: ${video.view_count?.toLocaleString() || 'Unknown'}`);
    
    // 3. Start download
    console.log('\n3. Starting download...');
    const downloadOptions = {
      url: videoUrl,
      format: 'video+audio',
      quality: 'best'
    };
    
    const download = await api.downloadVideo(downloadOptions);
    const downloadId = download.data.id;
    
    console.log(`   Download ID: ${downloadId}`);
    console.log(`   Format: ${download.data.format}`);
    console.log(`   Quality: ${download.data.quality}`);
    console.log(`   Output Path: ${download.data.outputPath}`);
    
    // 4. Monitor progress
    console.log('\n4. Monitoring download progress...');
    
    const finalStatus = await api.waitForCompletion(downloadId, (progress) => {
      const percent = Math.round(progress.progress || 0);
      const status = progress.status;
      const speed = progress.speed || '';
      const eta = progress.eta || '';
      
      let statusIcon = '⏳';
      if (status === 'downloading') statusIcon = '📥';
      else if (status === 'processing') statusIcon = '🔄';
      else if (status === 'completed') statusIcon = '✅';
      else if (status === 'failed') statusIcon = '❌';
      
      console.log(`   ${statusIcon} ${percent}% - ${status} ${speed ? `(${speed})` : ''} ${eta ? `ETA: ${eta}` : ''}`);
    });
    
    // 5. Show final results
    console.log('\n5. Download completed successfully! 🎉');
    console.log(`   File: ${finalStatus.filename}`);
    console.log(`   Location: ${finalStatus.outputPath}`);
    console.log(`   Started: ${new Date(finalStatus.startTime).toLocaleString()}`);
    console.log(`   Completed: ${new Date(finalStatus.completedAt).toLocaleString()}`);
    
    // 6. Show statistics
    console.log('\n6. Current statistics...');
    const stats = await api.getStats();
    console.log(`   Total downloads: ${stats.data.downloads.total}`);
    console.log(`   Completed: ${stats.data.downloads.completed || 0}`);
    console.log(`   Failed: ${stats.data.downloads.failed || 0}`);
    console.log(`   Currently downloading: ${stats.data.downloads.downloading || 0}`);
    
  } catch (error) {
    console.error('\n❌ Workflow failed:', error.message);
    
    // Show help information
    console.log('\n💡 Troubleshooting:');
    console.log('   - Make sure the API server is running: npm start');
    console.log('   - Check that yt-dlp is installed: pip install yt-dlp');
    console.log('   - Verify the video URL is valid and accessible');
    console.log('   - Check the API health: curl http://localhost:3001/api/health');
  }
}

// Main execution
async function main() {
  console.log('🎬 Lemolex Video Downloader API - JavaScript Client Examples');
  console.log('============================================================');
  
  // Uncomment the examples you want to run:
  
  // await example1_BasicUsage();
  // await example2_DownloadVideo();
  // await example3_DownloadAudio();
  // await example4_BatchDownloads();
  // await example5_ManageDownloads();
  // await example6_ErrorHandling();
  
  // Run the complete workflow
  await completeWorkflow();
  
  console.log('\n✨ Examples completed!');
}

// Run examples if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

// Export for use as a module
module.exports = {
  LemolexAPI,
  formatBytes,
  formatDuration,
  completeWorkflow
};