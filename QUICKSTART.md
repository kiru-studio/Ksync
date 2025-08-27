# 🚀 Quick Start Guide

## Get Started in 5 Minutes

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Spotify
```bash
npm run setup
```
Follow the prompts to enter your Spotify Client ID.

**To get your Client ID:**
- Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
- Create a new app
- Add `http://localhost:3000/callback` to Redirect URIs
- Copy the Client ID

### 3. Build and Run
```bash
npm run build
npm start
```

### 4. Use the Dock
- Move your mouse to the **top edge** of your screen
- The dock will slide down smoothly
- Control Spotify, view lyrics, and see your queue
- Move your mouse away to auto-hide

## 🎯 Features at a Glance

### Left Panel - Now Playing
- Album art with hover effects
- Song title and artist
- Play/pause, skip, shuffle, repeat controls
- Progress bar with click-to-seek
- Volume control
- Like button

### Center Panel - Lyrics
- Karaoke-style synced lyrics
- Current line highlighted
- Past lines fade out
- Smooth transitions

### Right Panel - Queue
- Next 3 upcoming tracks
- Album art thumbnails
- Track titles and artists
- Hover effects

## 🎨 Customization

### Change Dock Height
Edit `main.js`:
```javascript
height: 120, // Change this value
```

### Modify Colors
Edit `src/styles.css`:
```css
.app {
  background: linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%);
  /* Change these colors */
}
```

### Adjust Auto-hide Behavior
Edit `main.js`:
```javascript
// Show dock when mouse is at top of screen
if (mouseY <= 5 && !isVisible) {
  showDock();
}
```

## 🔧 Troubleshooting

### Dock Not Appearing
- Make sure the app is running (`npm start`)
- Try moving mouse to the very top edge
- Check that no other apps are blocking the top

### Spotify Not Connecting
- Ensure you have Spotify Premium
- Make sure Spotify desktop app is running
- Check that you're logged into the correct account
- Verify your Client ID is correct

### Controls Not Working
- Ensure Spotify is the active playback device
- Check that music is actually playing in Spotify
- Try refreshing the authentication

## 🎵 Requirements

- **Spotify Premium** (required for Web Playback SDK)
- **Spotify Desktop App** running
- **Windows 10/11** (tested on Windows)
- **Node.js** v16 or higher

## 🚀 Advanced Usage

### Development Mode
```bash
npm run dev
```
This runs the app with hot reloading for development.

### Create Installer
```bash
npm run dist
```
Creates a Windows installer in the `dist` folder.

### Custom Lyrics Integration
To add real lyrics support, integrate with services like:
- Musixmatch API
- Genius API
- Local lyrics files

---

**Enjoy your new Spotify dock! 🎵**
