# 🎵 Spotiffy Dock

A beautiful, auto-hiding Spotify dock that behaves like the Windows taskbar but at the top of your screen. Control Spotify, view synced lyrics, and see your queue without opening the main app.

## ✨ Features

- **Auto-hide functionality** - Slides down when you move your mouse to the top edge
- **Real-time Spotify control** - Play/pause, skip, volume, and progress control
- **Synced lyrics display** - Karaoke-style lyrics with current line highlighting
- **Queue preview** - See upcoming tracks at a glance
- **Modern UI** - Beautiful dark theme with smooth animations
- **Always on top** - Stays accessible without interfering with your work

## 🎯 How it Works

The dock normally stays hidden above your screen. When you flick your mouse to the top edge, it smoothly slides down just like the Windows taskbar. Move your mouse away and it auto-hides again.

### Three-Panel Layout

1. **Left Panel** - Album art, song details, playback controls, and progress bar
2. **Center Panel** - Synced lyrics with karaoke-style highlighting
3. **Right Panel** - Queue/upcoming tracks preview

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- Spotify account (Premium recommended for best experience)
- Spotify desktop app running

### Installation

1. **Clone and install**
   ```bash
   git clone <repository-url>
   cd ksync
   npm install
   ```

2. **Create a Spotify app (PKCE – no client secret needed)**
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Create a new app
   - In **Settings**, add this Redirect URI: `http://127.0.0.1:8888/callback`
   - In **Settings → User Management**, add the Spotify email you will use to log in (required in Development Mode; otherwise you get 403 Forbidden)
   - Copy your **Client ID**

3. **Configure the app**
   - Open `config.js` in the project root
   - Set `SPOTIFY_CLIENT_ID` (or replace `YOUR_SPOTIFY_CLIENT_ID` in the `spotify.clientId` field) with your Client ID
   - Redirect URI is already set to `http://127.0.0.1:8888/callback`

4. **Build and run**
   ```bash
   npm run build
   npm start
   ```

5. **Use the dock**
   - Move your mouse to the **top edge** of the screen to show the dock
   - Click **Connect with Spotify** and sign in in your browser
   - After authorizing, the dock will show your current track, lyrics, and queue. No backend server required.

### Development

```bash
npm run dev
```

## Configuration

### Spotify (PKCE)

The app uses Spotify’s **PKCE** flow: only your **Client ID** is needed (no client secret). Tokens are stored locally and refreshed automatically.

1. **Spotify app running** – The dock controls the active Spotify device.
2. **Client ID** – From your app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
3. **Redirect URI** – Must be exactly `http://127.0.0.1:8888/callback` in both `config.js` and your Spotify app settings.
4. **403 Forbidden** – In Development Mode, only users added in **Settings → User Management** can use the app. Add the Spotify email you log in with.

### Customization

You can customize the dock by modifying:

- **Height**: Change `height: 120px` in `main.js` and CSS
- **Colors**: Modify the CSS variables in `src/styles.css`
- **Animations**: Adjust timing in the CSS animations
- **Position**: The dock is designed for top-of-screen, but can be modified

## 📁 Project Structure

```
spotiffy-dock/
├── main.js                 # Electron main process
├── preload.js             # Preload script for security
├── src/
│   ├── App.js             # Main React component
│   ├── components/        # React components
│   │   ├── NowPlaying.js  # Left panel - controls
│   │   ├── LyricsPanel.js # Center panel - lyrics
│   │   └── QueuePanel.js  # Right panel - queue
│   ├── services/
│   │   └── SpotifyService.js # Spotify API integration
│   ├── styles.css         # Main stylesheet
│   └── index.js           # React entry point
├── webpack.config.js      # Webpack configuration
└── package.json           # Dependencies and scripts
```

## 🎨 UI Features

- **Dark theme** with Spotify-inspired colors
- **Smooth animations** using CSS transitions
- **Responsive design** that adapts to screen size
- **Hover effects** for interactive elements
- **Progress bars** for song progress and volume
- **Karaoke-style lyrics** with current line highlighting

## 🔌 Spotify Integration

The app integrates with Spotify using:

- **Web Playback SDK** - For real-time control
- **Spotify Web API** - For track info and queue data
- **OAuth 2.0** - For secure authentication

### Supported Actions

- ✅ Play/Pause
- ✅ Skip Next/Previous
- ✅ Volume Control
- ✅ Progress Seeking
- ✅ Queue Viewing
- ✅ Real-time Track Info

### Limitations

- Requires Spotify Premium
- Lyrics require third-party service integration
- Must have Spotify desktop app running

## 🛠️ Troubleshooting

### Common Issues

1. **"Authentication failed"**
   - Ensure your Client ID is correct
   - Check that redirect URI matches exactly
   - Make sure you have Spotify Premium

2. **"No track playing"**
   - Ensure Spotify desktop app is running
   - Check that you're playing music in Spotify
   - Verify your account has Premium

3. **Dock not appearing**
   - Check that the app is running
   - Try moving mouse to very top of screen
   - Restart the application

4. **Controls not working**
   - Ensure Spotify is the active playback device
   - Check that you're logged into the correct account
   - Try refreshing the authentication

## 🚀 Building for Distribution

To create a distributable package:

```bash
npm run build
npm run dist
```

This creates an installer in the `dist` folder.

## 📝 License

MIT License - feel free to use and modify as needed.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🙏 Acknowledgments

- Spotify for the Web Playback SDK
- Electron team for the desktop framework
- React team for the UI library
- Lucide for the beautiful icons

---

**Note**: This is a personal project and not affiliated with Spotify. Use at your own discretion.
