# Lemolex Video Downloader - API Documentation

📖 **Complete API Reference Guide**

This document provides detailed information about all API endpoints, request/response formats, error codes, and integration examples.

## 📋 Table of Contents

1. [API Overview](#api-overview)
2. [Authentication](#authentication)
3. [Base URL & Headers](#base-url--headers)
4. [Response Format](#response-format)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)
7. [Endpoints](#endpoints)
8. [Data Models](#data-models)
9. [Status Codes](#status-codes)
10. [Integration Examples](#integration-examples)
11. [SDKs & Libraries](#sdks--libraries)
12. [Changelog](#changelog)

## 🌐 API Overview

The Lemolex Video Downloader provides a RESTful API service that allows you to download YouTube videos and audio files programmatically. It supports multiple formats, quality options, and provides real-time progress tracking.

### Key Features
- 📺 YouTube video downloads (MP4)
- 🎵 Audio extraction (MP3)
- 📊 Real-time progress tracking
- 🎯 Multiple quality options
- 📁 Custom output paths
- 🔄 Batch processing support
- 📋 Download history management

### Supported Platforms
- YouTube videos and playlists
- YouTube Shorts
- YouTube Music (audio extraction)

## 🔐 Authentication

Currently, the API supports optional API key authentication. If an API key is configured on the server, include it in your requests:

```http
X-API-Key: your-api-key-here
```

**Note:** Authentication is optional and depends on server configuration.

## 🌍 Base URL & Headers

### Base URL
```
http://localhost:3001/api
```

### Required Headers
```http
Content-Type: application/json
```

### Optional Headers
```http
X-API-Key: your-api-key (if authentication enabled)
User-Agent: your-app-name/version
```

## 📤 Response Format

All API responses follow a consistent JSON format:

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data here
  },
  "message": "Optional success message",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "code": 400,
  "details": "Additional error details (optional)",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## 🚨 Error Handling

### HTTP Status Codes
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (invalid API key)
- `404` - Not Found (resource not found)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

### Common Error Types
- `INVALID_URL` - YouTube URL is malformed or invalid
- `VIDEO_UNAVAILABLE` - Video is private, deleted, or restricted
- `DOWNLOAD_FAILED` - Download process failed
- `INVALID_FORMAT` - Unsupported format specified
- `INVALID_QUALITY` - Unsupported quality specified

## 🕰️ Rate Limiting

Default rate limits (configurable):
- **100 requests per 15 minutes** per IP address
- Headers returned with each response:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Requests remaining in current window
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

## 🛠️ Endpoints

### 1. Health Check

Check API server status and dependencies.

```http
GET /api/health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "server": "Lemolex Video Downloader API",
    "version": "1.0.0",
    "uptime": 3600,
    "system": {
      "platform": "linux",
      "arch": "x64",
      "nodeVersion": "v18.17.0",
      "memory": {
        "rss": 45678592,
        "heapTotal": 20971520,
        "heapUsed": 15234567,
        "external": 1234567
      }
    },
    "dependencies": {
      "ytDlp": {
        "available": true,
        "path": "/usr/local/bin/yt-dlp"
      },
      "ffmpeg": {
        "available": true,
        "path": "/usr/local/bin/ffmpeg"
      }
    },
    "downloads": {
      "total": 25,
      "completed": 20,
      "failed": 2,
      "downloading": 1,
      "cancelled": 2
    }
  }
}
```

### 2. API Documentation

Get complete API documentation and endpoint information.

```http
GET /api/docs
```

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "Lemolex Video Downloader",
    "version": "1.0.0",
    "description": "Professional YouTube Video & Audio Downloader API",
    "author": "Billy",
    "baseUrl": "http://localhost:3001/api",
    "endpoints": {
      // Detailed endpoint information
    },
    "supportedFormats": [
      "video+audio - MP4 with audio (default)",
      "video-only - MP4 without audio",
      "audio-only - MP3 audio extraction"
    ],
    "supportedQualities": [
      "best - Highest available quality (default)",
      "1080p - Full HD",
      "720p - HD",
      "480p - SD",
      "360p - Low quality"
    ]
  }
}
```

### 3. Get Video Information

Retrieve detailed information about a YouTube video without downloading.

```http
POST /api/info
```

**Request Body:**
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "dQw4w9WgXcQ",
    "title": "Rick Astley - Never Gonna Give You Up (Official Video)",
    "duration": 213,
    "thumbnail": "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    "uploader": "RickAstleyVEVO",
    "view_count": 1234567890,
    "upload_date": "20091025",
    "description": "The official video for Rick Astley's 'Never Gonna Give You Up'...",
    "formats": {
      "video": [
        {
          "format_id": "137",
          "ext": "mp4",
          "resolution": "1920x1080",
          "filesize": 45678901,
          "fps": 30
        }
      ],
      "audio": [
        {
          "format_id": "140",
          "ext": "m4a",
          "abr": 128,
          "filesize": 3456789
        }
      ]
    },
    "webpage_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 4. Start Download

Initiate a video or audio download.

```http
POST /api/download
```

**Request Body:**
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "format": "video+audio",
  "quality": "best",
  "outputPath": "/path/to/downloads",
  "filename": "custom-filename.mp4"
}
```

**Parameters:**
- `url` (required): YouTube video URL
- `format` (optional): Download format
  - `video+audio` (default): MP4 with audio
  - `video-only`: MP4 without audio
  - `audio-only`: MP3 audio extraction
- `quality` (optional): Video quality
  - `best` (default): Highest available
  - `1080p`, `720p`, `480p`, `360p`: Specific resolutions
- `outputPath` (optional): Custom download directory
- `filename` (optional): Custom filename

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "abc123-def456-ghi789",
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "format": "video+audio",
    "quality": "best",
    "status": "starting",
    "progress": 0,
    "speed": "",
    "eta": "",
    "filename": "",
    "outputPath": "/Users/billy/Downloads/Lemolex",
    "error": null,
    "startTime": "2024-01-01T12:00:00.000Z",
    "updatedAt": "2024-01-01T12:00:00.000Z"
  },
  "message": "Download started successfully",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 5. Get Download Status

Check the progress and status of a specific download.

```http
GET /api/download/{downloadId}
```

**Path Parameters:**
- `downloadId`: Unique download identifier

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "abc123-def456-ghi789",
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "format": "video+audio",
    "quality": "best",
    "status": "downloading",
    "progress": 45.2,
    "speed": "1.23MiB/s",
    "eta": "02:15",
    "filename": "Rick Astley - Never Gonna Give You Up.mp4",
    "outputPath": "/Users/billy/Downloads/Lemolex",
    "error": null,
    "startTime": "2024-01-01T12:00:00.000Z",
    "updatedAt": "2024-01-01T12:01:30.000Z"
  },
  "timestamp": "2024-01-01T12:01:30.000Z"
}
```

### 6. Get All Downloads

Retrieve a list of all downloads with optional filtering.

```http
GET /api/downloads?status={status}&limit={limit}
```

**Query Parameters:**
- `status` (optional): Filter by download status
  - `starting`, `downloading`, `processing`, `completed`, `failed`, `cancelled`
- `limit` (optional): Maximum number of results (default: 50, max: 100)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "abc123-def456-ghi789",
      "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "format": "video+audio",
      "status": "completed",
      "progress": 100,
      "filename": "Rick Astley - Never Gonna Give You Up.mp4",
      "startTime": "2024-01-01T12:00:00.000Z",
      "completedAt": "2024-01-01T12:03:45.000Z"
    }
  ],
  "total": 1,
  "timestamp": "2024-01-01T12:05:00.000Z"
}
```

### 7. Get Statistics

Get download statistics and system information.

```http
GET /api/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "downloads": {
      "total": 100,
      "completed": 85,
      "failed": 5,
      "downloading": 2,
      "cancelled": 8
    },
    "system": {
      "uptime": 7200,
      "memory": {
        "rss": 45678592,
        "heapTotal": 20971520,
        "heapUsed": 15234567
      },
      "platform": "linux"
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 8. Clear Completed Downloads

Remove completed and failed downloads from the system.

```http
DELETE /api/downloads/completed
```

**Response:**
```json
{
  "success": true,
  "message": "Cleared 15 completed/failed downloads",
  "clearedCount": 15,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 9. Cancel Download

Cancel an active download.

```http
DELETE /api/download/{downloadId}
```

**Path Parameters:**
- `downloadId`: Unique download identifier

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "abc123-def456-ghi789",
    "status": "cancelled",
    "cancelledAt": "2024-01-01T12:00:00.000Z"
  },
  "message": "Download cancelled successfully",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## 📊 Data Models

### Download Object
```typescript
interface Download {
  id: string;                    // Unique identifier
  url: string;                   // YouTube video URL
  format: string;                // Download format
  quality: string;               // Video quality
  status: DownloadStatus;        // Current status
  progress: number;              // Progress percentage (0-100)
  speed: string;                 // Download speed (e.g., "1.23MiB/s")
  eta: string;                   // Estimated time remaining
  filename: string;              // Output filename
  outputPath: string;            // Download directory
  error: string | null;          // Error message if failed
  startTime: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  completedAt?: string;          // ISO timestamp (if completed)
  failedAt?: string;             // ISO timestamp (if failed)
  cancelledAt?: string;          // ISO timestamp (if cancelled)
}
```

### Download Status
```typescript
type DownloadStatus = 
  | 'starting'     // Download is being prepared
  | 'downloading'  // Active download in progress
  | 'processing'   // Post-processing (merging, converting)
  | 'completed'    // Download finished successfully
  | 'failed'       // Download failed with error
  | 'cancelled';   // Download was cancelled by user
```

### Video Info Object
```typescript
interface VideoInfo {
  id: string;                    // Video ID
  title: string;                 // Video title
  duration: number;              // Duration in seconds
  thumbnail: string;             // Thumbnail image URL
  uploader: string;              // Channel name
  view_count: number;            // View count
  upload_date: string;           // Upload date (YYYYMMDD)
  description: string;           // Video description (truncated)
  formats: {
    video: VideoFormat[];        // Available video formats
    audio: AudioFormat[];        // Available audio formats
  };
  webpage_url: string;           // Original video URL
}
```

## 🔢 Status Codes

### Download Status Flow
```
starting → downloading → processing → completed
    ↓           ↓            ↓
  failed    failed      failed
    ↓           ↓            ↓
cancelled  cancelled   cancelled
```

### HTTP Status Codes
- `200 OK` - Request successful
- `201 Created` - Resource created (download started)
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Invalid or missing API key
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - Service temporarily unavailable

## 💻 Integration Examples

### JavaScript/Node.js
```javascript
const API_BASE = 'http://localhost:3001/api';

async function downloadVideo(url, format = 'video+audio') {
  // Start download
  const response = await fetch(`${API_BASE}/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, format })
  });
  
  const download = await response.json();
  const downloadId = download.data.id;
  
  // Monitor progress
  return new Promise((resolve, reject) => {
    const checkProgress = async () => {
      const statusRes = await fetch(`${API_BASE}/download/${downloadId}`);
      const status = await statusRes.json();
      
      console.log(`Progress: ${status.data.progress}%`);
      
      if (status.data.status === 'completed') {
        resolve(status.data);
      } else if (status.data.status === 'failed') {
        reject(new Error(status.data.error));
      } else {
        setTimeout(checkProgress, 1000);
      }
    };
    
    checkProgress();
  });
}

// Usage
downloadVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  .then(result => console.log('Download completed:', result.filename))
  .catch(error => console.error('Download failed:', error));
```

### Python
```python
import requests
import time

def download_video(url, format='video+audio'):
    # Start download
    response = requests.post('http://localhost:3001/api/download', 
                           json={'url': url, 'format': format})
    download = response.json()
    download_id = download['data']['id']
    
    # Monitor progress
    while True:
        status_response = requests.get(f'http://localhost:3001/api/download/{download_id}')
        status = status_response.json()
        
        print(f"Progress: {status['data']['progress']}%")
        
        if status['data']['status'] == 'completed':
            return status['data']
        elif status['data']['status'] == 'failed':
            raise Exception(status['data']['error'])
        
        time.sleep(1)

# Usage
try:
    result = download_video('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    print(f"Download completed: {result['filename']}")
except Exception as e:
    print(f"Download failed: {e}")
```

### cURL
```bash
# Start download
curl -X POST http://localhost:3001/api/download \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "format": "audio-only",
    "quality": "best"
  }'

# Check progress (replace DOWNLOAD_ID with actual ID)
curl http://localhost:3001/api/download/DOWNLOAD_ID

# Get all downloads
curl http://localhost:3001/api/downloads

# Cancel download
curl -X DELETE http://localhost:3001/api/download/DOWNLOAD_ID
```

## 📚 SDKs & Libraries

### Official Clients
- **JavaScript/Node.js**: See `examples/javascript-client.js`
- **Python**: See `examples/python-client.py`
- **cURL**: See `examples/curl-examples.sh`

### Community Libraries
*Community-contributed libraries will be listed here as they become available.*

## 📝 Changelog

### Version 1.0.0 (2024-01-01)
- Initial API release
- Support for YouTube video and audio downloads
- Real-time progress tracking
- Multiple format and quality options
- RESTful API design
- Comprehensive error handling
- Rate limiting support
- Optional API key authentication

---

## 🚀 Getting Started

1. **Install the API server** following the setup guide
2. **Start the server**: `npm start`
3. **Test the API**: `curl http://localhost:3001/api/health`
4. **Try the examples** in the `examples/` directory
5. **Integrate** into your application using the endpoints above

## 📞 Support

- **Health Check**: `GET /api/health`
- **API Documentation**: `GET /api/docs`
- **GitHub Issues**: (if using GitHub repository)

---

*This documentation is for Lemolex Video Downloader API v1.0.1*  
*Last updated: 2025-05-24*