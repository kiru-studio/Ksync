# 🔧 Backend Integration Guide

This guide will help you set up the backend server for Spotiffy Dock, which provides real Spotify API integration and lyrics fetching.

## 🚀 Quick Setup

### 1. Set Up Backend

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Configure Spotify credentials
npm run setup

# Start the backend server
npm start
```

### 2. Update Frontend

The frontend has already been updated to use the backend API. Just rebuild and restart:

```bash
# From the root directory
npm run build
npm start
```

## 📋 Backend Features

### ✅ **Spotify OAuth Integration**
- Secure authentication flow
- Automatic token refresh
- Session management

### ✅ **Real-time Spotify Control**
- Play/pause functionality
- Skip next/previous
- Volume control
- Progress seeking
- Queue management

### ✅ **Lyrics Integration**
- Fetch lyrics for current tracks
- Extensible for multiple lyrics providers
- Fallback to mock lyrics

### ✅ **API Endpoints**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/spotify` | GET | Get Spotify OAuth URL |
| `/callback` | GET | OAuth callback handler |
| `/api/current-track` | GET | Get currently playing track |
| `/api/queue` | GET | Get playback queue |
| `/api/lyrics/:trackId` | GET | Get lyrics for track |
| `/api/play` | POST | Play music |
| `/api/pause` | POST | Pause music |
| `/api/skip-next` | POST | Skip to next track |
| `/api/skip-previous` | POST | Skip to previous track |
| `/api/volume` | POST | Set volume |
| `/api/seek` | POST | Seek to position |

## 🔐 Spotify API Setup

### 1. Create Spotify App
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click "Create an App"
4. Fill in the app details:
   - **App name**: Spotiffy Backend
   - **App description**: Backend for Spotiffy Dock
   - **Website**: `http://localhost:3001`
   - **Redirect URIs**: `http://localhost:3001/callback`

### 2. Get Credentials
- Copy the **Client ID**
- Copy the **Client Secret**
- Use these in the setup script

## 🎵 Lyrics Integration

The backend includes a framework for lyrics integration. You can extend it to use:

### **Genius API**
```javascript
// Add to .env
GENIUS_ACCESS_TOKEN=your_genius_token_here
```

### **Musixmatch API**
```javascript
// Add to .env
MUSIXMATCH_API_KEY=your_musixmatch_key_here
```

### **Custom Lyrics Provider**
You can implement your own lyrics fetching logic in `server.js`:

```javascript
async function fetchLyricsFromCustomProvider(trackName, artistName) {
  // Your custom lyrics fetching logic
  return [
    { text: "Lyrics line 1", startTime: 0 },
    { text: "Lyrics line 2", startTime: 4 },
    // ...
  ];
}
```

## 🔄 Frontend-Backend Communication

### **Authentication Flow**
1. Frontend calls `/auth/spotify`
2. Backend returns OAuth URL
3. User authenticates with Spotify
4. Backend receives callback and stores tokens
5. Frontend can now make API calls

### **API Communication**
- All Spotify API calls go through the backend
- Backend handles token management
- Frontend receives clean, formatted data

## 🛠️ Development

### **Backend Development**
```bash
cd server
npm run dev  # Auto-restart on changes
```

### **Frontend Development**
```bash
npm run dev  # Hot reloading
```

### **Environment Variables**
Create a `.env` file in the server directory:

```env
# Spotify API Configuration
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:3001/callback

# Server Configuration
PORT=3001

# Optional: Lyrics API keys
GENIUS_ACCESS_TOKEN=your_genius_token
MUSIXMATCH_API_KEY=your_musixmatch_key
```

## 🚀 Production Deployment

### **Backend Deployment**
1. Set up a production server (Heroku, Vercel, etc.)
2. Update environment variables
3. Deploy the server code
4. Update frontend `baseUrl` to production URL

### **Frontend Deployment**
1. Update `baseUrl` in `SpotifyService.js`
2. Build the frontend: `npm run build`
3. Deploy the built files

## 🔧 Troubleshooting

### **Authentication Issues**
- Check Spotify app settings
- Verify redirect URI matches exactly
- Ensure Client ID and Secret are correct

### **API Errors**
- Check backend server is running
- Verify network connectivity
- Check console for error messages

### **Lyrics Not Loading**
- Check lyrics provider API keys
- Verify track information is correct
- Check network requests in browser dev tools

## 📁 Project Structure

```
spotiffy/
├── server/                 # Backend server
│   ├── server.js          # Main server file
│   ├── package.json       # Backend dependencies
│   ├── setup.js           # Setup script
│   └── .env               # Environment variables
├── src/                   # Frontend React app
│   ├── services/
│   │   └── SpotifyService.js  # Updated to use backend
│   └── ...
└── ...
```

## 🎯 Next Steps

1. **Set up the backend** using the setup script
2. **Start both servers** (backend on 3001, frontend on default)
3. **Test authentication** by clicking play/pause
4. **Add real lyrics integration** using your preferred provider
5. **Deploy to production** when ready

---

**The backend integration is now complete! Your Spotiffy Dock will have full Spotify API access and real-time control.** 🎵
