# Deploying Lemolex Video Downloader to Railway

This guide will help you deploy the Lemolex Video Downloader API to Railway.

## Prerequisites

- A Railway account (https://railway.app/)
- Git installed on your computer (if deploying from local repository)

## Deployment Options

### Option 1: Deploy from GitHub (Recommended)

1. Fork or push this repository to your GitHub account
2. Log in to Railway
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Select your repository
6. Railway will automatically detect the Node.js project and deploy it

### Option 2: Deploy from CLI

1. Install the Railway CLI:
   ```
   npm install -g @railway/cli
   ```

2. Login to Railway:
   ```
   railway login
   ```

3. Initialize the project:
   ```
   cd lemolex-video-downloader
   railway init
   ```

4. Deploy the project:
   ```
   railway up
   ```

## Environment Variables

Railway will automatically set most environment variables, but you may want to configure:

- `PORT`: Set by Railway automatically
- `HOST`: Set by Railway automatically
- `NODE_ENV`: Set to "production" by default
- `DEFAULT_DOWNLOAD_PATH`: Will use the default Railway temporary directory

## Testing the Deployment

Once deployed, you can test the API with:

1. Health check:
   ```
   curl https://your-railway-url.railway.app/api/health
   ```

2. Download a video:
   ```
   curl -X POST https://your-railway-url.railway.app/api/download -H "Content-Type: application/json" -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","format":"video+audio","quality":"best"}' --output video.mp4
   ```

## Important Notes for Railway Deployment

1. Railway provides temporary storage that is cleared periodically, which works well with the automatic cleanup feature of this API.

2. The API automatically detects the Railway environment and configures paths accordingly.

3. Railway has a free tier with limitations on usage and storage. For production use, consider upgrading to a paid plan.

4. The deployment includes the necessary dependencies (yt-dlp and ffmpeg) that will be installed automatically.

5. Railway deployments are automatically secured with HTTPS.
