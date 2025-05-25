# VPS Deployment Guide for Lemolex Video Downloader

This step-by-step guide will help you deploy the Lemolex Video Downloader on a VPS (Virtual Private Server), which provides better YouTube bot detection bypass and higher success rates compared to Railway deployment.

## Recommended VPS Providers

- **DigitalOcean** - Basic Droplet ($5-6/month)
- **Linode** - Shared CPU 1GB ($5/month)
- **Vultr** - Cloud Compute ($5/month)

Any of these options will work well. The smallest tier (1GB RAM) is sufficient for this application.

## Why Use a VPS?

VPS providers offer several advantages for this application:

- **Better IP Reputation**: Clean IP addresses with less chance of being flagged by YouTube
- **Persistent Storage**: Your data remains intact between restarts
- **Full Control**: Complete control over the server environment
- **Cost-Effective**: Basic plans ($5-6/month) are sufficient for this application

## Step 1: Create a VPS

1. **Create an Account**:
   - Sign up with your preferred VPS provider (DigitalOcean, Linode, or Vultr)
   - Verify your account (you'll need a credit/debit card or PayPal)

2. **Create a Server/Droplet**:
   - Choose **Ubuntu 22.04 LTS** as the operating system
   - Select the **Basic** plan (1GB RAM / 1 CPU)
   - Select a datacenter region closest to your location
   - Set up authentication using either:
     - **Password**: Create a strong root password (easier for beginners)
     - **SSH Keys**: More secure but requires additional setup
   - Give your server a name (e.g., `lemolex-downloader`)
   - Create the server/droplet

3. **Note Your Server Details**:
   - After creation, note your server's **IP address** from the dashboard
   - If you chose password authentication, note the password you created

## Step 2: Connect to Your VPS

### For Windows Users:
1. **Using PuTTY** (recommended for beginners):
   - Download and install [PuTTY](https://www.putty.org/)
   - Open PuTTY and enter your server's IP address in the **Host Name** field
   - Click **Open**
   - When prompted, enter `root` as the username
   - Enter your password (characters won't be visible as you type)

2. **Using Windows Terminal or PowerShell**:
   ```powershell
   ssh root@your_server_ip
   ```

### For Mac/Linux Users:
   ```bash
   ssh root@your_server_ip
   ```

## Step 3: Update System and Install Dependencies

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js and npm
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install required tools
apt install -y git ffmpeg python3 python3-pip

# Install yt-dlp
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
chmod a+rx /usr/local/bin/yt-dlp

# Install youtube-dl as fallback
curl -L https://yt-dl.org/downloads/latest/youtube-dl -o /usr/local/bin/youtube-dl
chmod a+rx /usr/local/bin/youtube-dl

# Install pytube for additional fallback
pip3 install pytube
```

## Step 4: Clone and Set Up the Project

```bash
# Create directory for the app
mkdir -p /opt/lemolex-downloader
cd /opt/lemolex-downloader

# Clone the repository
git clone https://github.com/billykipkosgei/lemolex-video-downloader.git .

# Install dependencies
npm install

# Test the application
node server.js
```

## Step 5: Set Up Process Manager (PM2)

PM2 will keep your application running even after you close the SSH connection.

```bash
# Install PM2
npm install -g pm2

# Start the application with PM2
pm2 start server.js --name "lemolex-downloader"

# Make PM2 start on system boot
pm2 startup
pm2 save
```

## Step 6: Set Up Nginx as Reverse Proxy (Optional but Recommended)

```bash
# Install Nginx
apt install -y nginx

# Create Nginx configuration
cat > /etc/nginx/sites-available/lemolex-downloader << 'EOL'
server {
    listen 80;
    server_name your_server_ip_or_domain;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOL

# Enable the site
ln -s /etc/nginx/sites-available/lemolex-downloader /etc/nginx/sites-enabled/

# Test Nginx configuration
nginx -t

# Restart Nginx
systemctl restart nginx
```

## Step 7: Set Up SSL with Let's Encrypt (Optional but Recommended)

If you have a domain name pointed to your server:

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
certbot --nginx -d your_domain.com

# Certbot will automatically update your Nginx configuration
```

## Step 8: Accessing Your API

Your API will now be available at:
- http://your_server_ip/ (if using just the Node.js app)
- http://your_server_ip/ or https://your_domain.com/ (if using Nginx)

## Maintenance and Updates

To update the application with the latest code:

```bash
cd /opt/lemolex-downloader
git pull
npm install
pm2 restart lemolex-downloader
```

## Troubleshooting

### Check application logs:
```bash
pm2 logs lemolex-downloader
```

### Check Nginx logs:
```bash
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Restart services:
```bash
pm2 restart lemolex-downloader
systemctl restart nginx
```

## Security Considerations

- Consider setting up a firewall with `ufw`
- Create a non-root user for running the application
- Keep your system updated regularly

## Additional Performance Tips

1. **Rotate IP Addresses**: If you experience decreased success rates over time, consider creating a new VPS instance with a fresh IP address.

2. **Multiple Regions**: For even better results, deploy to multiple VPS instances in different geographic regions and implement a load balancer.

3. **Regular Updates**: Keep yt-dlp and other dependencies updated regularly to benefit from the latest bot detection bypasses.
