# Digital Ocean Deployment Guide for Lemolex Video Downloader

This step-by-step guide will help you deploy the Lemolex Video Downloader on Digital Ocean, which provides better YouTube bot detection bypass and higher success rates compared to Railway deployment.

## Why Digital Ocean?

Digital Ocean offers several advantages for this application:

- **Better IP Reputation**: Clean IP addresses with less chance of being flagged by YouTube
- **Persistent Storage**: Your data remains intact between restarts
- **Full Control**: Complete control over the server environment
- **Cost-Effective**: Basic Droplet ($5-6/month) is sufficient for this application

## Step 1: Create a Digital Ocean Account & Droplet

1. **Create an Account**:
   - Go to [Digital Ocean](https://www.digitalocean.com/)
   - Sign up with your email address
   - Verify your account (you'll need a credit/debit card or PayPal)

2. **Create a Droplet**:
   - From the Digital Ocean dashboard, click **Create** > **Droplets**
   - Choose **Ubuntu 22.04 LTS** as the operating system
   - Select the **Basic** plan
   - Choose the **Regular CPU / Basic** option with **1GB RAM / 1 CPU** ($5-6/month)
   - Select a datacenter region closest to your location
   - Under **Authentication**, choose either:
     - **Password**: Create a strong root password (easier for beginners)
     - **SSH Keys**: More secure but requires additional setup
   - Give your Droplet a name (e.g., `lemolex-downloader`)
   - Click **Create Droplet**

3. **Note Your Server Details**:
   - After creation, note your server's **IP address** from the dashboard
   - If you chose password authentication, note the password you created

## Step 2: Connect to Your Droplet

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

> **Note**: Replace `your_server_ip` with the actual IP address of your Droplet.
> When connecting for the first time, you may see a security alert - this is normal, select **Yes** to continue.

## Step 3: Update System and Install Dependencies

After connecting to your Droplet, you'll need to install all the required software. Copy and paste each command block below, one at a time:

```bash
# Update system packages
apt update && apt upgrade -y
```

```bash
# Install Node.js and npm
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs
```

```bash
# Install required tools (git, ffmpeg, python)
apt install -y git ffmpeg python3 python3-pip
```

```bash
# Install yt-dlp (the main YouTube downloader tool)
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
chmod a+rx /usr/local/bin/yt-dlp
```

```bash
# Install youtube-dl as fallback
curl -L https://yt-dl.org/downloads/latest/youtube-dl -o /usr/local/bin/youtube-dl
chmod a+rx /usr/local/bin/youtube-dl
```

```bash
# Install pytube for additional fallback
pip3 install pytube
```

> **Note**: After each command, wait for it to complete before running the next one. You'll know it's complete when you see the command prompt (`root@your-droplet:~#`) again.

## Step 4: Clone and Set Up the Project

Now you'll download the project code and set it up:

```bash
# Create directory for the app
mkdir -p /opt/lemolex-downloader
cd /opt/lemolex-downloader
```

```bash
# Clone the repository from GitHub
git clone https://github.com/billykipkosgei/lemolex-video-downloader.git .
```

```bash
# Install project dependencies
npm install
```

### Setting Up Environment Variables

Create an environment file with the proper settings:

```bash
# Copy the example environment file
cp .env.example .env
```

```bash
# Open the file for editing
nano .env
```

In the editor:
1. Press `Ctrl+W` and search for `PORT` to find the port setting
2. Change any settings as needed (the defaults should work fine)
3. Press `Ctrl+X` to exit
4. Press `Y` to save changes
5. Press `Enter` to confirm the filename

### Test the Application

```bash
# Run the application to test it
node server.js
```

You should see output indicating that the server is running. Press `Ctrl+C` to stop the server after confirming it works.

## Step 5: Set Up Process Manager (PM2)

PM2 is a process manager that will keep your application running even after you close the SSH connection and will restart it automatically if it crashes.

```bash
# Install PM2 globally
npm install -g pm2
```

```bash
# Start the application with PM2
pm2 start server.js --name "lemolex-downloader"
```

```bash
# Configure PM2 to start automatically on system boot
pm2 startup
```

After running the above command, you'll see a command output that you need to copy and paste. It will look something like this:
```
[PM2] To setup the Startup Script, copy/paste the following command:
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u root --hp /root
```

Copy the command that was output (not the example above) and paste it into the terminal, then run:

```bash
# Save the current PM2 process list
pm2 save
```

### Verify PM2 Setup

```bash
# Check if the application is running
pm2 status
```

You should see your application listed as "online" in green text.

## Step 6: Set Up Nginx as Reverse Proxy

Nginx will serve as a reverse proxy for your application, providing better security and performance.

```bash
# Install Nginx
apt install -y nginx
```

```bash
# Create Nginx configuration file
nano /etc/nginx/sites-available/lemolex-downloader
```

Copy and paste the following configuration into the editor (replace `your_server_ip` with your actual server IP):

```nginx
server {
    listen 80;
    server_name your_server_ip;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        
        # Increase timeout for large file downloads
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }
}
```

Save and exit the editor (press `Ctrl+X`, then `Y`, then `Enter`).

```bash
# Create a symbolic link to enable the site
ln -s /etc/nginx/sites-available/lemolex-downloader /etc/nginx/sites-enabled/
```

```bash
# Test Nginx configuration for errors
nginx -t
```

```bash
# If no errors, restart Nginx to apply changes
systemctl restart nginx
```

### Configure Firewall (UFW)

Set up a basic firewall to improve security:

```bash
# Install UFW if not already installed
apt install -y ufw
```

```bash
# Allow SSH (so you don't get locked out)
ufw allow ssh
```

```bash
# Allow HTTP traffic
ufw allow http
```

```bash
# Enable the firewall
ufw enable
```

Type `y` and press Enter when prompted to proceed.

```bash
# Check firewall status
ufw status
```

## Step 7: Set Up SSL with Let's Encrypt (Optional)

If you have a domain name pointed to your server, you can set up SSL for secure HTTPS connections. If you don't have a domain name yet, you can skip this step and come back to it later.

### Prerequisites:
- A registered domain name (e.g., example.com)
- DNS A record pointing to your server's IP address
- Wait for DNS propagation (can take up to 24-48 hours)

### Installation Steps:

```bash
# Install Certbot and Nginx plugin
apt install -y certbot python3-certbot-nginx
```

```bash
# Update your Nginx configuration to use your domain name
nano /etc/nginx/sites-available/lemolex-downloader
```

Change the `server_name` line to use your domain instead of the IP address:
```nginx
server_name your_domain.com www.your_domain.com;
```

Save and exit (press `Ctrl+X`, then `Y`, then `Enter`).

```bash
# Test and reload Nginx configuration
nginx -t && systemctl reload nginx
```

```bash
# Obtain SSL certificate
certbot --nginx -d your_domain.com -d www.your_domain.com
```

Follow the prompts from Certbot:
1. Enter your email address
2. Agree to the terms of service
3. Choose whether to redirect HTTP traffic to HTTPS (recommended)

Certbot will automatically update your Nginx configuration to use HTTPS.

## Step 8: Accessing Your API

Your API is now deployed and ready to use!

### API Endpoints:

- **Main API**: http://your_server_ip/ (replace with your actual server IP)
- **Health Check**: http://your_server_ip/api/health
- **API Documentation**: http://your_server_ip/api/docs

If you set up a domain name with SSL:
- **Secure API**: https://your_domain.com/

### Testing with Postman:

1. Download and install [Postman](https://www.postman.com/downloads/)
2. Create a new POST request to: `http://your_server_ip/api/download/video`
3. Set the request body to JSON format and enter:
   ```json
   {
     "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
   }
   ```
4. Send the request - Postman will download the video file automatically

### Testing with cURL:

```bash
# Get video information
curl -X POST http://your_server_ip/api/info \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'

# Download video
curl -X POST http://your_server_ip/api/download/video \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}' \
  --output video.mp4
```

## Maintenance and Updates

### Updating the Application

To update the application with the latest code:

```bash
# Navigate to the application directory
cd /opt/lemolex-downloader

# Pull the latest code from GitHub
git pull

# Install any new dependencies
npm install

# Restart the application
pm2 restart lemolex-downloader
```

### Updating System Packages

Regularly update your system to keep it secure:

```bash
# Update package lists
apt update

# Upgrade installed packages
apt upgrade -y

# Remove unused packages
apt autoremove -y
```

### Updating yt-dlp

YouTube frequently changes their systems, so keeping yt-dlp updated is important:

```bash
# Update yt-dlp
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
chmod a+rx /usr/local/bin/yt-dlp
```

## Troubleshooting

### Common Issues and Solutions

#### Application Not Starting

```bash
# Check application logs
pm2 logs lemolex-downloader
```

Common solutions:
- Make sure all dependencies are installed: `npm install`
- Check if the port is already in use: `lsof -i :3001`
- Verify the .env file exists: `ls -la /opt/lemolex-downloader/.env`

#### Nginx Not Working

```bash
# Check Nginx status
systemctl status nginx
```

```bash
# Check Nginx error logs
tail -f /var/log/nginx/error.log
```

```bash
# Check Nginx access logs
tail -f /var/log/nginx/access.log
```

Common solutions:
- Verify Nginx configuration: `nginx -t`
- Check if the application is running: `pm2 status`
- Restart Nginx: `systemctl restart nginx`

#### YouTube Downloads Failing

```bash
# Test yt-dlp directly
yt-dlp --version
```

```bash
# Try downloading a video directly with yt-dlp
yt-dlp -f 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]' https://www.youtube.com/watch?v=dQw4w9WgXcQ -o test_video.mp4
```

Common solutions:
- Update yt-dlp: `curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && chmod a+rx /usr/local/bin/yt-dlp`
- Check if YouTube cookies are working (see Cookie section below)
- Try a different video URL to rule out region restrictions

### Restarting Services

```bash
# Restart the application
pm2 restart lemolex-downloader
```

```bash
# Restart Nginx
systemctl restart nginx
```

```bash
# Restart the entire server (use with caution)
reboot
```

## Security Considerations

### Secure Your Server

1. **Create a Non-Root User** (Recommended for Production):
   ```bash
   # Create a new user
   adduser appuser
   
   # Add user to sudo group
   usermod -aG sudo appuser
   
   # Switch to the new user
   su - appuser
   ```

2. **Update Regularly**:
   ```bash
   # Set up automatic security updates
   apt install -y unattended-upgrades
   dpkg-reconfigure -plow unattended-upgrades
   ```

3. **Secure SSH** (Optional but Recommended):
   ```bash
   # Edit SSH config
   nano /etc/ssh/sshd_config
   ```
   
   Make these changes:
   ```
   # Disable root login
   PermitRootLogin no
   
   # Disable password authentication if using SSH keys
   PasswordAuthentication no
   ```
   
   ```bash
   # Restart SSH service
   systemctl restart sshd
   ```

4. **Monitor Logs**:
   ```bash
   # Install log monitoring tool
   apt install -y logwatch
   
   # Configure daily email reports
   nano /etc/cron.daily/00logwatch
   ```

### Backup Your Data

Set up regular backups of your application:

```bash
# Create a backup script
nano /root/backup.sh
```

Add this content:
```bash
#!/bin/bash
BACKUP_DIR="/root/backups"
APP_DIR="/opt/lemolex-downloader"
DATETIME=$(date +"%Y%m%d-%H%M%S")

mkdir -p "$BACKUP_DIR"
tar -czf "$BACKUP_DIR/lemolex-backup-$DATETIME.tar.gz" "$APP_DIR"

# Keep only the 5 most recent backups
ls -t "$BACKUP_DIR" | tail -n +6 | xargs -I {} rm "$BACKUP_DIR/{}"
```

```bash
# Make the script executable
chmod +x /root/backup.sh
```

```bash
# Schedule daily backups with cron
(crontab -l 2>/dev/null; echo "0 2 * * * /root/backup.sh") | crontab -
```

## YouTube Cookie Authentication

This application uses cookies to bypass YouTube's bot detection. The repository already includes a working cookie file, but if you need to update it in the future, follow these steps:

### Using the Included Cookies

The repository includes a working YouTube cookie file located at `/cookies/youtube_cookies.txt`. This should work out of the box without any changes needed.

### Updating Cookies (If Needed in the Future)

If downloads start failing due to bot detection, you may need to update the cookies:

1. **Install a Cookie Export Extension** in your browser:
   - For Chrome: "Get cookies.txt" or "EditThisCookie"
   - For Firefox: "Cookie Quick Manager"

2. **Log in to YouTube** with your account

3. **Export cookies** in Netscape format (cookies.txt)

4. **Upload the cookie file** to your server:
   - If using Windows, you can use tools like WinSCP or FileZilla
   - Or use SCP command from your local machine:
     ```bash
     scp path/to/local/cookies.txt root@your_server_ip:/opt/lemolex-downloader/cookies/youtube_cookies.txt
     ```

5. **Restart the application**:
   ```bash
   pm2 restart lemolex-downloader
   ```

## Additional Performance Tips

1. **Rotate IP Addresses**: If you experience decreased success rates over time, consider creating a new server/droplet with Ubuntu 22.04 LTS (recommended) IP address.

2. **Multiple Regions**: For even better results, deploy to multiple Droplets in different geographic regions.

3. **Regular Updates**: Keep yt-dlp and other dependencies updated regularly to benefit from the latest bot detection bypasses.

   ```bash
   # Install monitoring tool
   pm2 install pm2-server-monit
   ```

## Conclusion

Congratulations! You've successfully deployed the Lemolex Video Downloader on Digital Ocean. This deployment should provide better reliability and success rates compared to Railway.

If you encounter any issues or need assistance, please refer to the troubleshooting section above or contact the developer for support.
