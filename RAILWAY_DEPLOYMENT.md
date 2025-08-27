# 🚂 Railway Deployment Guide

This guide will help you deploy your Spotiffy backend to Railway, a modern platform for deploying applications.

## 🚀 Quick Deployment Steps

### 1. **Create Railway Account**
- Go to [railway.app](https://railway.app)
- Sign up with your GitHub account
- Verify your email

### 2. **Deploy from GitHub**
1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Choose your repository: `KiruthikKumar16/ksync`
4. Set **Root Directory** to: `server`
5. Click **"Deploy"**

### 3. **Configure Environment Variables**
Once deployed, go to your project settings and add these environment variables:

```env
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
SPOTIFY_REDIRECT_URI=https://your-app-name.railway.app/callback
NODE_ENV=production
```

### 4. **Get Your Deployment URL**
- Railway will provide a URL like: `https://spotiffy-backend-production-xxxx.up.railway.app`
- Copy this URL for the next steps

## 🔐 Spotify App Configuration

### 1. **Update Spotify App Settings**
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Select your app
3. Click **"Edit Settings"**
4. Add your Railway URL to **Redirect URIs**:
   ```
   https://your-app-name.railway.app/callback
   ```
5. Save changes

### 2. **Update Environment Variables**
In Railway dashboard, update the `SPOTIFY_REDIRECT_URI` to match your actual Railway URL.

## 🎯 **Railway-Specific Features**

### **Automatic Deployments**
- Railway automatically deploys when you push to your main branch
- No manual deployment needed

### **Environment Variables**
- Secure storage of sensitive data
- Easy to update without redeploying

### **Custom Domains**
- Add your own domain if needed
- SSL certificates included

### **Monitoring**
- Built-in logs and metrics
- Health checks automatically configured

## 🔧 **Troubleshooting**

### **Deployment Issues**
1. **Check logs** in Railway dashboard
2. **Verify environment variables** are set correctly
3. **Ensure root directory** is set to `server`

### **Common Errors**
- **Port issues**: Railway sets `PORT` automatically
- **Missing dependencies**: Check `package.json` in server directory
- **Environment variables**: Ensure all required vars are set

### **Health Check Failures**
- The app includes a `/health` endpoint
- Railway will monitor this for uptime

## 📋 **Deployment Checklist**

- [ ] Railway account created
- [ ] GitHub repository connected
- [ ] Root directory set to `server`
- [ ] Environment variables configured
- [ ] Spotify app redirect URI updated
- [ ] Deployment successful
- [ ] Health check passing
- [ ] Frontend updated with new backend URL

## 🔄 **Updating Frontend**

Once deployed, update your frontend to use the Railway URL:

```javascript
// In src/services/SpotifyService.js
this.baseUrl = 'https://your-app-name.railway.app';
```

## 💰 **Pricing**

- **Free tier**: $5 credit monthly
- **Hobby plan**: $5/month
- **Pro plan**: $20/month

The free tier should be sufficient for development and testing.

## 🎉 **Success!**

Once deployed, your Spotiffy backend will be:
- ✅ Publicly accessible
- ✅ Automatically scaled
- ✅ SSL secured
- ✅ Continuously deployed
- ✅ Monitored and logged

Your Spotify dock will now have a production-ready backend! 🎵
