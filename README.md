# Lemolex Video Downloader

🚀 **Professional YouTube Video & Audio Downloader**

A powerful, easy-to-use application for downloading YouTube videos and audio files. Built with Node.js and Express, featuring real-time progress tracking, multiple format support, and comprehensive error handling.

## ✨ Features

- 📺 **YouTube Video Downloads** - Support for all YouTube video formats
- 🎵 **Audio Extraction** - Convert videos to MP3 with high quality
- 📊 **Real-time Progress** - Track download progress with live updates
- 🎯 **Multiple Formats** - Video+Audio, Video-only, Audio-only
- 🔧 **Quality Selection** - Choose from best, 1080p, 720p, 480p, 360p
- 📁 **Custom Output Paths** - Download to any directory
- 🔄 **Batch Processing** - Handle multiple downloads simultaneously
- 📋 **Download History** - Track all download activities
- 🛡️ **Error Handling** - Comprehensive error reporting
- 📖 **API Documentation** - Built-in interactive documentation

## 🛠️ Quick Start

### Prerequisites

- **Node.js** (v14.0.0 or higher)
- **npm** (v6.0.0 or higher)
- **yt-dlp** - YouTube downloader tool
- **ffmpeg** - Video processing (optional but recommended)

### Installation

1. **Clone or download this project**
```bash
git clone <repository-url>
cd lemolex-video-downloader
```

2. **Install dependencies**
```bash
npm install
```

3. **Install yt-dlp**
```bash
# Option 1: Using pip (recommended)
pip install yt-dlp

# Option 2: Download executable to bin/ folder
# Visit: https://github.com/yt-dlp/yt-dlp/releases
```

4. **Start the server**
```bash
npm start
```

5. **Test the API**
```bash
curl http://localhost:3001/api/health
```

## 🚀 Usage

### Basic Example

```javascript
// Get video information
const response = await fetch('http://localhost:3001/api/info', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://youtu.be/hibXYI7KWf4?si=sbu_ZV58ILIUkSsy'
  })
});

const videoInfo = await response.json();
console.log('Video Title:', videoInfo.data.title);

// Start download
const downloadResponse = await fetch('http://localhost:3001/api/download', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://youtu.be/hibXYI7KWf4?si=sbu_ZV58ILIUkSsy',
    format: 'video+audio',
    quality: 'best'
  })
});

const download = await downloadResponse.json();
const downloadId = download.data.id;

// Check progress
const statusResponse = await fetch(`http://localhost:3001/api/download/${downloadId}`);
const status = await statusResponse.json();
console.log('Progress:', status.data.progress + '%');
```

## 📡 API Endpoints

### Base URL: `http://localhost:3001/api`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health check |
| GET | `/docs` | API documentation |
| POST | `/info` | Get video information |
| POST | `/download` | Start download |
| GET | `/download/:id` | Get download status |
| GET | `/downloads` | Get all downloads |
| GET | `/stats` | Get statistics |
| DELETE | `/downloads/completed` | Clear completed downloads |
| DELETE | `/download/:id` | Cancel download |

### 📋 Get Video Information

**POST** `/api/info`

```json
{
  "url": "https://youtu.be/hibXYI7KWf4?si=sbu_ZV58ILIUkSsy"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "hibXYI7KWf4",
    "title": "Billy Kipkosgei - Creating a portfolio website with Figma",
    "duration": 213,
    "thumbnail": "https://img.youtube.com/vi/hibXYI7KWf4/maxresdefault.jpg",
    "uploader": "BillyKipkosgei",
    "view_count": 5,
    "upload_date": "20240314",
    "description": "my description here",
    "webpage_url": "https://youtu.be/hibXYI7KWf4?si=sbu_ZV58ILIUkSsy"
  }
}
```

### 📥 Start Download

**POST** `/api/download`

```json
{
  "url": "https://youtu.be/hibXYI7KWf4?si=sbu_ZV58ILIUkSsy",
  "format": "video+audio",
  "quality": "best",
  "outputPath": "/path/to/downloads",
  "filename": "custom-name"
}
```

**Parameters:**
- `url` (required) - YouTube video URL
- `format` (optional) - `video+audio`, `video-only`, `audio-only` (default: `video+audio`)
- `quality` (optional) - `best`, `1080p`, `720p`, `480p`, `360p` (default: `best`)
- `outputPath` (optional) - Download directory path
- `filename` (optional) - Custom filename

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "abc123-def456-ghi789",
    "url": "https://youtu.be/hibXYI7KWf4?si=sbu_ZV58ILIUkSsy",
    "format": "video+audio",
    "quality": "best",
    "status": "starting",
    "progress": 0,
    "outputPath": "/Users/username/Downloads",
    "startTime": "2024-01-01T12:00:00.000Z"
  }
}
```

### 📊 Check Download Progress

**GET** `/api/download/:id`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "abc123-def456-ghi789",
    "status": "downloading",
    "progress": 45.2,
    "speed": "1.23MiB/s",
    "eta": "00:45",
    "filename": "Billy Kipkosgei - Creating a portfolio website with Figma.mp4"
  }
}
```

**Download Status Values:**
- `starting` - Download is being prepared
- `downloading` - Active download in progress
- `processing` - Post-processing (merging video/audio)
- `completed` - Download finished successfully
- `failed` - Download failed (check error field)
- `cancelled` - Download was cancelled

## 🛠️ Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Server Configuration
PORT=3001
HOST=localhost
NODE_ENV=development

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080

# Download Configuration
DEFAULT_DOWNLOAD_PATH=/path/to/downloads
MAX_CONCURRENT_DOWNLOADS=3

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000
```

## 🔧 Development

### Scripts

```bash
npm start          # Start production server
npm run dev        # Start development server with auto-reload
npm test           # Run API tests
npm run health     # Quick health check
npm run docs       # Open API documentation
```

### Project Structure

```
lemolex-video-downloader/
├── server.js                    # Main server file
├── package.json                 # Dependencies
├── .env.example                 # Environment template
├── src/
│   ├── downloadManager.js       # Core download logic
│   ├── routes.js                # API routes
│   └── utils.js                 # Helper functions
├── examples/
│   ├── javascript-client.js     # JavaScript examples
│   ├── python-client.py         # Python examples
│   └── curl-examples.sh         # cURL examples
└── docs/
    └── api-documentation.md     # Detailed docs
```

## 📚 Client Examples

### JavaScript/Node.js

```javascript
class LemolexAPI {
  constructor(baseUrl = 'http://localhost:3001/api') {
    this.baseUrl = baseUrl;
  }

  async getVideoInfo(url) {
    const response = await fetch(`${this.baseUrl}/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    return response.json();
  }

  async downloadVideo(url, options = {}) {
    const response = await fetch(`${this.baseUrl}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, ...options })
    });
    return response.json();
  }

  async getDownloadStatus(downloadId) {
    const response = await fetch(`${this.baseUrl}/download/${downloadId}`);
    return response.json();
  }
}

// Usage
const api = new LemolexAPI();
const download = await api.downloadVideo('https://youtube.com/watch?v=...', {
  format: 'audio-only',
  quality: 'best'
});
```

### Python

```python
import requests
import time

class LemolexAPI:
    def __init__(self, base_url='http://localhost:3001/api'):
        self.base_url = base_url
    
    def get_video_info(self, url):
        response = requests.post(f'{self.base_url}/info', json={'url': url})
        return response.json()
    
    def download_video(self, url, format='video+audio', quality='best'):
        data = {'url': url, 'format': format, 'quality': quality}
        response = requests.post(f'{self.base_url}/download', json=data)
        return response.json()
    
    def get_download_status(self, download_id):
        response = requests.get(f'{self.base_url}/download/{download_id}')
        return response.json()
    
    def wait_for_completion(self, download_id):
        while True:
            status = self.get_download_status(download_id)
            if status['data']['status'] in ['completed', 'failed']:
                return status
            time.sleep(1)

# Usage
api = LemolexAPI()
result = api.download_video('https://youtube.com/watch?v=...', 'audio-only')
final_status = api.wait_for_completion(result['data']['id'])
```

### cURL

```bash
# Get video info
curl -X POST http://localhost:3001/api/info \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'

# Start download
curl -X POST http://localhost:3001/api/download \
  -H "Content-Type: application/json" \
  -d '{
    "url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "format":"video+audio",
    "quality":"best"
  }'

# Check progress
curl http://localhost:3001/api/download/[DOWNLOAD_ID]
```

## 🚨 Troubleshooting

### Common Issues

**1. yt-dlp not found**
```
Error: yt-dlp is not working at path: [path]
```
**Solution:** Install yt-dlp using `pip install yt-dlp`

**2. Permission denied**
```
Error: EACCES: permission denied
```
**Solution:** Check download directory permissions or use a different path

**3. Download fails immediately**
```
Status: failed, Error: [youtube] Video unavailable
```
**Solution:** Video may be private, age-restricted, or unavailable in your region

**4. Slow downloads**
- Check your internet connection
- Try different quality settings
- Ensure ffmpeg is installed for video+audio format

### Debug Mode

Enable detailed logging:
```bash
NODE_ENV=development npm start
```

## 📄 License

MIT License - see LICENSE file for details

## 👨‍💻 Author

**Billy** - Lemolex Video Downloader API

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

- 📖 **Documentation:** `http://localhost:3001/api/docs`
- 🏥 **Health Check:** `http://localhost:3001/api/health`
- 🐛 **Issues:** Create an issue in the repository
- 💬 **Questions:** Contact the maintainer

---

⭐ **Star this project if it helps you!**