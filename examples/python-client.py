#!/usr/bin/env python3
"""
Lemolex Video Downloader - Python Client Example with Cookie Authentication
Complete example showing how to integrate with the Lemolex Video Downloader using Python
Supports cookie authentication for accessing restricted videos
Author: Billy
"""

import requests
import time
import json
from typing import Optional, Dict, List, Callable
from datetime import datetime


class LemolexAPI:
    """Python client for Lemolex Video Downloader with Cookie Authentication support"""
    
    def __init__(self, base_url: str = 'http://localhost:3001/api'):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'Lemolex-Python-Client/1.0'
        })
    
    def _make_request(self, method: str, endpoint: str, **kwargs) -> Dict:
        """Make HTTP request with error handling"""
        url = f"{self.base_url}{endpoint}"
        
        try:
            print(f"Making request: {method.upper()} {url}")
            response = self.session.request(method, url, **kwargs)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Request failed: {e}")
            if hasattr(e, 'response') and e.response is not None:
                try:
                    error_data = e.response.json()
                    raise Exception(error_data.get('error', str(e)))
                except json.JSONDecodeError:
                    raise Exception(f"HTTP {e.response.status_code}: {e.response.text}")
            raise Exception(str(e))
    
    def check_health(self) -> Dict:
        """Check API server health"""
        return self._make_request('GET', '/health')
    
    def get_docs(self) -> Dict:
        """Get API documentation"""
        return self._make_request('GET', '/docs')
    
    def get_video_info(self, url: str, cookies: Optional[str] = None, cookies_from_browser: Optional[str] = None, user_agent: Optional[str] = None) -> Dict:
        """Get video information with optional authentication"""
        data = {'url': url}
        
        # Add authentication options if provided
        if cookies:
            data['cookies'] = cookies
        if cookies_from_browser:
            data['cookiesFromBrowser'] = cookies_from_browser
        if user_agent:
            data['userAgent'] = user_agent
            
        return self._make_request('POST', '/info', json=data)
    
    def download_video(self, 
                      url: str,
                      format: str = 'video+audio',
                      quality: str = 'best',
                      output_path: Optional[str] = None,
                      filename: Optional[str] = None,
                      cookies: Optional[str] = None,
                      cookies_from_browser: Optional[str] = None,
                      user_agent: Optional[str] = None) -> Dict:
        """Start video download with optional authentication"""
        data = {
            'url': url,
            'format': format,
            'quality': quality
        }
        
        if output_path:
            data['outputPath'] = output_path
        if filename:
            data['filename'] = filename
        
        # Add authentication options if provided
        if cookies:
            data['cookies'] = cookies
        if cookies_from_browser:
            data['cookiesFromBrowser'] = cookies_from_browser
        if user_agent:
            data['userAgent'] = user_agent
        
        return self._make_request('POST', '/download', json=data)
    
    def get_download_status(self, download_id: str) -> Dict:
        """Get download status"""
        return self._make_request('GET', f'/download/{download_id}')
    
    def get_all_downloads(self, status: Optional[str] = None, limit: int = 50) -> Dict:
        """Get all downloads"""
        params = {'limit': limit}
        if status:
            params['status'] = status
        
        return self._make_request('GET', '/downloads', params=params)
    
    def get_stats(self) -> Dict:
        """Get download statistics"""
        return self._make_request('GET', '/stats')
    
    def clear_completed(self) -> Dict:
        """Clear completed downloads"""
        return self._make_request('DELETE', '/downloads/completed')
    
    def cancel_download(self, download_id: str) -> Dict:
        """Cancel a download"""
        return self._make_request('DELETE', f'/download/{download_id}')
    
    def wait_for_completion(self, 
                          download_id: str, 
                          on_progress: Optional[Callable] = None,
                          check_interval: float = 1.0) -> Dict:
        """Wait for download completion with progress updates"""
        print(f"Monitoring download: {download_id}")
        
        while True:
            try:
                result = self.get_download_status(download_id)
                
                if not result.get('success'):
                    raise Exception(result.get('error', 'Unknown error'))
                
                download = result['data']
                
                # Call progress callback if provided
                if on_progress:
                    on_progress(download)
                
                # Check if download is finished
                if download['status'] == 'completed':
                    return download
                elif download['status'] == 'failed':
                    raise Exception(download.get('error', 'Download failed'))
                elif download['status'] == 'cancelled':
                    raise Exception('Download was cancelled')
                
                time.sleep(check_interval)
                
            except KeyboardInterrupt:
                print("\nCancelling download due to user interrupt...")
                try:
                    self.cancel_download(download_id)
                except:
                    pass
                raise
    
    def download_with_progress(self, 
                             url: str,
                             format: str = 'video+audio',
                             quality: str = 'best',
                             output_path: Optional[str] = None,
                             filename: Optional[str] = None,
                             cookies: Optional[str] = None,
                             cookies_from_browser: Optional[str] = None,
                             user_agent: Optional[str] = None,
                             on_progress: Optional[Callable] = None) -> Dict:
        """Download video with real-time progress tracking"""
        print("Starting download with progress tracking...")
        
        # Start the download
        download_result = self.download_video(
            url=url, 
            format=format, 
            quality=quality, 
            output_path=output_path, 
            filename=filename,
            cookies=cookies,
            cookies_from_browser=cookies_from_browser,
            user_agent=user_agent
        )
        download_id = download_result['data']['id']
        
        print(f"Download started with ID: {download_id}")
        
        # Wait for completion with progress updates
        return self.wait_for_completion(download_id, on_progress)


def format_bytes(bytes_size: int, decimals: int = 2) -> str:
    """Format bytes to human readable format"""
    if bytes_size == 0:
        return "0 B"
    
    k = 1024
    sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    i = int(bytes_size.bit_length() - 1) // 10
    if i >= len(sizes):
        i = len(sizes) - 1
    
    return f"{bytes_size / (k ** i):.{decimals}f} {sizes[i]}"


def format_duration(seconds: int) -> str:
    """Format duration from seconds to readable format"""
    if not seconds:
        return "0:00"
    
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    
    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    else:
        return f"{minutes}:{secs:02d}"


def example1_basic_usage():
    """Example 1: Basic API usage"""
    print("\n=== Example 1: Basic Usage ===")
    
    api = LemolexAPI()
    
    try:
        # Check API health
        health = api.check_health()
        print(f"API Status: {health['status']}")
        print(f"yt-dlp Available: {health['dependencies']['ytDlp']['available']}")
        print(f"ffmpeg Available: {health['dependencies']['ffmpeg']['available']}")
        
        # Get video information
        url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
        print(f"\nGetting info for: {url}")
        
        info = api.get_video_info(url)
        video = info['data']
        
        print(f"Title: {video['title']}")
        print(f"Duration: {format_duration(video['duration'])}")
        print(f"Uploader: {video['uploader']}")
        print(f"Views: {video['view_count']:,}" if video.get('view_count') else "Views: Unknown")
        
    except Exception as e:
        print(f"Example 1 failed: {e}")


def example2_download_video():
    """Example 2: Download video with manual progress checking"""
    print("\n=== Example 2: Download Video ===")
    
    api = LemolexAPI()
    
    try:
        download_options = {
            'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'format': 'video+audio',
            'quality': 'best'
        }
        
        download = api.download_video(**download_options)
        download_id = download['data']['id']
        
        print(f"Download ID: {download_id}")
        print(f"Status: {download['data']['status']}")
        
        # Monitor progress manually
        def check_progress():
            while True:
                status = api.get_download_status(download_id)
                data = status['data']
                
                progress = data.get('progress', 0)
                print(f"Progress: {progress:.1f}% - {data['status']}")
                
                if data['status'] == 'completed':
                    print("✅ Download completed!")
                    print(f"File: {data.get('filename', 'Unknown')}")
                    break
                elif data['status'] == 'failed':
                    print(f"❌ Download failed: {data.get('error', 'Unknown error')}")
                    break
                
                time.sleep(2)
        
        check_progress()
        
    except Exception as e:
        print(f"Example 2 failed: {e}")


def example3_download_audio():
    """Example 3: Download audio only with progress callback"""
    print("\n=== Example 3: Download Audio Only ===")
    
    api = LemolexAPI()
    
    try:
        def progress_callback(progress):
            percent = progress.get('progress', 0)
            status = progress.get('status', 'unknown')
            speed = progress.get('speed', '')
            eta = progress.get('eta', '')
            
            status_icons = {
                'starting': '🚀',
                'downloading': '🎵',
                'processing': '🔄',
                'completed': '✅',
                'failed': '❌'
            }
            
            icon = status_icons.get(status, '⏳')
            speed_text = f" ({speed})" if speed else ""
            eta_text = f" ETA: {eta}" if eta else ""
            
            print(f"   {icon} Audio Download: {percent:.1f}% - {status}{speed_text}{eta_text}")
        
        download_options = {
            'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'format': 'audio-only',
            'quality': 'best'
        }
        
        final_status = api.download_with_progress(
            **download_options,
            on_progress=progress_callback
        )
        
        print("✅ Audio download completed!")
        print(f"   File: {final_status.get('filename', 'Unknown')}")
        print(f"   Location: {final_status.get('outputPath', 'Unknown')}")
        
    except Exception as e:
        print(f"Example 3 failed: {e}")


def example4_batch_downloads():
    """Example 4: Multiple downloads in batch"""
    print("\n=== Example 4: Batch Downloads ===")
    
    api = LemolexAPI()
    
    try:
        # List of videos to download
        urls = [
            'https://www.youtube.com/watch?v=dQw4w9WgXcQ',  # Rick Astley
            'https://www.youtube.com/watch?v=jNQXAC9IVRw'    # First YouTube video
        ]
        
        print(f"Starting batch download of {len(urls)} videos...")
        
        # Start all downloads
        download_ids = []
        for i, url in enumerate(urls):
            try:
                print(f"Starting download {i+1}: {url}")
                download = api.download_video(url=url, format='video+audio', quality='best')
                download_id = download['data']['id']
                download_ids.append(download_id)
                print(f"Download {i+1} started with ID: {download_id}")
            except Exception as e:
                print(f"Error starting download {i+1}: {e}")
        
        # Monitor all downloads until completion
        print("\nMonitoring all downloads...")
        
        while True:
            completed = 0
            for i, download_id in enumerate(download_ids):
                try:
                    status = api.get_download_status(download_id)
                    data = status['data']
                    
                    print(f"Download {i+1}: {data['progress']:.1f}% - {data['status']}")
                    
                    if data['status'] in ['completed', 'failed', 'cancelled']:
                        completed += 1
                except Exception as e:
                    print(f"Error checking download {i}: {e}")
            
            if completed < len(download_ids):
                time.sleep(3)
            else:
                break
        
        print("\n📊 Batch download completed!")
        
    except Exception as e:
        print(f"Example 4 failed: {e}")


def example5_manage_downloads():
    """Example 5: Download management operations"""
    print("\n=== Example 5: Manage Downloads ===")
    
    api = LemolexAPI()
    
    try:
        # Get all downloads
        print("Getting all downloads...")
        all_downloads = api.get_all_downloads()
        downloads = all_downloads.get('data', [])
        
        print(f"Total downloads: {len(downloads)}")
        
        # Get statistics
        print("\nGetting download statistics...")
        stats = api.get_stats()
        download_stats = stats['data']['downloads']
        
        print(f"Total: {download_stats.get('total', 0)}")
        print(f"Completed: {download_stats.get('completed', 0)}")
        print(f"Failed: {download_stats.get('failed', 0)}")
        print(f"In Progress: {download_stats.get('downloading', 0)}")
        
        # Clear completed downloads if there are any
        if download_stats.get('completed', 0) > 0:
            print("\nClearing completed downloads...")
            result = api.clear_completed()
            print(f"Cleared {result.get('count', 0)} downloads")
        
    except Exception as e:
        print(f"Example 5 failed: {e}")


def example6_authentication():
    """Example 6: Using cookie authentication for restricted videos"""
    print("\n=== Example 6: Cookie Authentication ===")
    
    api = LemolexAPI()
    
    try:
        # Example URL that might require authentication
        url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
        
        # Method 1: Using cookies from browser
        print("Method 1: Using cookies from browser")
        print(f"Getting video info for: {url}")
        
        # Specify which browser to extract cookies from
        # Options: 'firefox', 'chrome', 'chromium', 'edge', 'safari', 'opera'
        browser = 'firefox'  # Change to your preferred browser
        
        try:
            info = api.get_video_info(url, cookies_from_browser=browser)
            print(f"Successfully authenticated using {browser} cookies!")
            print(f"Video title: {info['data']['title']}")
        except Exception as e:
            print(f"Browser cookie authentication failed: {e}")
            print("Try using a different browser or make sure you're logged in to YouTube")
        
        # Method 2: Custom user agent
        print("\nMethod 2: Using custom user agent")
        
        custom_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        
        try:
            # Download with custom user agent
            download_options = {
                'url': url,
                'format': 'audio-only',  # Use audio-only for faster download
                'user_agent': custom_agent
            }
            
            print("Starting download with custom user agent...")
            result = api.download_with_progress(**download_options)
            
            print("✅ Download completed with custom user agent!")
            print(f"File: {result.get('filename', 'Unknown')}")
        except Exception as e:
            print(f"Custom user agent download failed: {e}")
        
    except Exception as e:
        print(f"Example 6 failed: {e}")


def complete_workflow():
    """Complete workflow example with all features including authentication"""
    print("\n🚀 === Complete Workflow Example with Authentication ===")
    
    api = LemolexAPI()
    
    try:
        # 1. Check API health
        print("1. Checking API health...")
        health = api.check_health()
        print(f"   API Status: {health['status']}")
        print(f"   yt-dlp Available: {health['dependencies']['ytDlp']['available']}")
        print(f"   ffmpeg Available: {health['dependencies']['ffmpeg']['available']}")
        
        if not health['dependencies']['ytDlp']['available']:
            raise Exception("yt-dlp is not available. Please install it first.")
        
        # 2. Get video information
        video_url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
        print(f"\n2. Getting video information...")
        print(f"   URL: {video_url}")
        
        video_info = api.get_video_info(video_url)
        video = video_info['data']
        
        print(f"   Title: {video['title']}")
        print(f"   Uploader: {video['uploader']}")
        print(f"   Duration: {format_duration(video['duration'])}")
        if video.get('view_count'):
            print(f"   Views: {video['view_count']:,}")
        
        # 3. Start download with authentication
        print("\n3. Starting download with authentication...")
        download_options = {
            'url': video_url,
            'format': 'video+audio',
            'quality': 'best',
            # Uncomment one of these authentication methods if needed
            # 'cookies_from_browser': 'firefox',  # Extract cookies from Firefox
            # 'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        
        download = api.download_video(**download_options)
        download_id = download['data']['id']
        
        print(f"   Download ID: {download_id}")
        print(f"   Format: {download['data']['format']}")
        print(f"   Quality: {download['data']['quality']}")
        print(f"   Output Path: {download['data']['outputPath']}")
        
        # 4. Monitor progress with detailed callback
        print("\n4. Monitoring download progress...")
        
        def detailed_progress(progress):
            percent = round(progress.get('progress', 0))
            status = progress.get('status', 'unknown')
            speed = progress.get('speed', '')
            eta = progress.get('eta', '')
            filename = progress.get('filename', '')
            
            status_icons = {
                'starting': '🚀',
                'downloading': '📥',
                'processing': '🔄',
                'completed': '✅',
                'failed': '❌'
            }
            
            icon = status_icons.get(status, '⏳')
            speed_text = f" ({speed})" if speed else ""
            eta_text = f" ETA: {eta}" if eta else ""
            file_text = f" - {filename}" if filename else ""
            
            print(f"   {icon} {percent}% - {status}{speed_text}{eta_text}{file_text}")
        
        final_status = api.wait_for_completion(download_id, detailed_progress)
        
        # 5. Show final results
        print("\n5. Download completed successfully! 🎉")
        print(f"   File: {final_status.get('filename', 'Unknown')}")
        print(f"   Location: {final_status.get('outputPath', 'Unknown')}")
        
        if final_status.get('startTime'):
            start_time = datetime.fromisoformat(final_status['startTime'].replace('Z', '+00:00'))
            print(f"   Started: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        
        if final_status.get('completedAt'):
            completed_time = datetime.fromisoformat(final_status['completedAt'].replace('Z', '+00:00'))
            print(f"   Completed: {completed_time.strftime('%Y-%m-%d %H:%M:%S')}")
        
        # 6. Show statistics
        print("\n6. Current statistics...")
        stats = api.get_stats()
        download_stats = stats['data']['downloads']
        print(f"   Total downloads: {download_stats.get('total', 0)}")
        print(f"   Completed: {download_stats.get('completed', 0)}")
        print(f"   Failed: {download_stats.get('failed', 0)}")
        print(f"   In Progress: {download_stats.get('downloading', 0)}")
        
        print("\nComplete workflow finished successfully! 🎉")
        
    except Exception as e:
        print(f"Complete workflow failed: {e}")


if __name__ == "__main__":
    print("Lemolex Video Downloader - Python Client Examples")
    print("==================================================")
    print("This script demonstrates how to use the Lemolex Video Downloader.")
    print("It will run through several examples showing different features.")
    print("Make sure the API server is running at http://localhost:3001")
    print("==================================================")
    
    # Run the examples
    try:
        # Run basic examples
        example1_basic_usage()
        example2_download_video()
        example3_download_audio()
        example4_batch_downloads()
        example5_manage_downloads()
        example6_authentication()
        
        # Run the complete workflow
        complete_workflow()
        
        print("\n✨ All examples completed successfully!")
        print("Thank you for using Lemolex Video Downloader")
        
    except KeyboardInterrupt:
        print("\n\nExamples interrupted by user.")
    except Exception as e:
        print(f"\n\nError running examples: {e}")