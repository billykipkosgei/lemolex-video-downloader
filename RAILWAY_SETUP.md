# Railway Deployment Guide

## Prerequisites
- Node.js 18.x or higher
- Railway account
- Git

## Setup Instructions

1. **Clone the Repository**
   ```bash
   # Clone directly from the project repository
   git clone https://github.com/billykipkosgei/lemolex-video-downloader.git
   cd lemolex-video-downloader
   ```

   OR if you have your own fork:
   ```bash
   # Clone your fork
   git clone https://github.com/YOUR_USERNAME/lemolex-video-downloader.git
   cd lemolex-video-downloader
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your Railway configuration:
   ```
   PORT=3000
   NODE_ENV=production
   ```

4. **Deploy to Railway**
   - Go to [Railway](https://railway.app)
   - Create a new project
   - Connect your GitHub repository
   - Deploy the project
   - Railway will automatically use the `Procfile` and `railway.json`

## Railway Configuration

### Procfile
```bash
web: npm start
```

### Railway Variables
- `PORT`: Application port (default: 3000)
- `NODE_ENV`: Environment (production/development)

## File Management

The application uses a temporary directory for downloads:
- Location: `/tmp/lemolex-downloads`
- Automatic cleanup: Files are deleted after successful download
- Periodic cleanup: Runs every hour to remove old files

## API Endpoints

### Health Check
```bash
GET /api/health
```

### Download Video
```bash
POST /api/download/video
Content-Type: application/json
{
    "url": "https://youtube.com/watch?v=..."
}
```

### Download Audio
```bash
POST /api/download/audio
Content-Type: application/json
{
    "url": "https://youtube.com/watch?v=..."
}
```

### Combined Download
```bash
POST /api/download
Content-Type: application/json
{
    "url": "https://youtube.com/watch?v=...",
    "format": "video+audio"  // Options: video, audio, video+audio
}
```

## Troubleshooting

1. **Disk Space Issues**
   - Check `/tmp/lemolex-downloads` directory
   - Verify cleanup is working
   - Increase Railway disk space if needed

2. **Download Failures**
   - Check logs for yt-dlp errors
   - Verify YouTube URL is valid
   - Check for rate limiting

3. **Performance Issues**
   - Monitor Railway resources
   - Consider scaling up if needed
   - Check for concurrent download limits
