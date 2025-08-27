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

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- Spotify Premium account (required for Web Playback SDK)
- Spotify app running on your computer

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd spotiffy-dock
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Spotify Developer App**
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Create a new app
   - Add `http://localhost:3000/callback` to Redirect URIs
   - Copy your Client ID

4. **Configure Spotify Client ID**
   - Open `src/services/SpotifyService.js`
   - Replace `YOUR_SPOTIFY_CLIENT_ID` with your actual Client ID

5. **Build and run**
   ```bash
   npm run build
   npm start
   ```

### Development

For development with hot reloading:
```bash
npm run dev
```

## 🔧 Configuration

### Spotify Authentication

The app uses Spotify's Web Playback SDK for real-time control. You'll need:

1. **Spotify Premium account** - Required for Web Playback SDK
2. **Spotify app running** - The dock controls the desktop app
3. **Valid Client ID** - From Spotify Developer Dashboard

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
