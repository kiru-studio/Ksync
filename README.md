# 🎵 ksync

A beautiful, auto-hiding Spotify desktop dock for Windows that behaves like an intelligent taskbar. Control Spotify playback, experience real-time synchronized karaoke lyrics, watch dynamic BPM-reactive audio spectrums, and track your queue without keeping the Spotify desktop client in view.

---

## 📥 Downloads (v2.4.2)

Download the latest stable release for Windows 10 / 11 (64-bit):

| Package | Download Link | Description |
| :--- | :--- | :--- |
| **Windows Installer** | [**Download ksync Setup v2.4.2 (.exe)**](https://github.com/kiru-studio/Ksync/releases/download/v2.4.2/ksync-Setup-2.4.2.exe) | Standard Windows NSIS installer with auto-update support & Start Menu shortcuts. |
| **Portable Standalone** | [**Download ksync Portable v2.4.2 (.exe)**](https://github.com/kiru-studio/Ksync/releases/download/v2.4.2/ksync-2.4.2.exe) | Single standalone executable. No installation required—run from anywhere. |

> [!NOTE]
> View all versions, release notes, and source code on the [GitHub Releases page](https://github.com/kiru-studio/Ksync/releases).

---

## 📋 What's New in v2.4.2

### 🌟 New Features & Implementations
- **Dynamic BPM Circular Audio Spectrum**: Live reactive circular audio spectrum visualizer dynamically synced to the track's tempo, volume, and playback state.
- **Interactive Vinyl Album Artwork**: Click on album artwork to seamlessly toggle between classic square cover view and a smoothly rotating vinyl disc animation across top and sidebar docks.
- **Top Dock & Vertical Sidebar Modes**: Flexible dock orientations with smooth slide-in auto-hide animations when moving your cursor to the edge of your monitor.
- **Windows SMTC Native Bridge**: Direct C# / .NET 10 System Media Transport Controls integration—enables instant media control (Play/Pause/Skip/Seek) for **Free Spotify accounts** without requiring Spotify Premium Web API permissions.

### ⚡ Improvements
- **Adaptive Lyrics Formatting**: Synced lyrics display now renders with explicit responsive line wrapping to prevent unexpected text truncation or ellipsis clipping in narrow dock widths.
- **Persistent Playback Loop**: Improved audio spectrum and playback state loop persistence when resuming from sleep or background minimize.
- **Lightweight System Tray**: Minimalist tray menu with instant Dock Toggle, lyrics color customization, and low idle CPU footprint.

### 🐛 Bug Fixes
- Fixed race conditions during fast track switching in SMTC sidecar events.
- Resolved lyrics container clipping on multi-monitor high-DPI displays.
- Updated repository endpoints, auto-updater manifests, and branding to `kiru-studio/Ksync`.

---

## ✨ Features

- **Auto-hide functionality** - Slides down when you move your mouse to the top edge
- **Real-time Spotify control** - Play/pause, skip, volume, and progress control
- **Synced lyrics display** - Karaoke-style lyrics with current line highlighting
- **Queue preview** - See upcoming tracks at a glance (unique items, no duplicates)
- **System tray** - Run in background; right-click tray icon to Show/Hide dock or Quit
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
- Spotify account (Free or Premium)
- Spotify desktop app running (Windows required for playback control)

### Installation

1. **Clone and install**
   ```bash
   git clone https://github.com/kiru-studio/Ksync.git
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

5. **Build the SMTC Bridge (for playback control on Free accounts)**
   ksync uses a Windows-native sidecar to control playback without requiring Spotify Premium. You need the .NET SDK to build it.
   ```bash
   cd smtc-bridge
   dotnet publish -r win-x64 --self-contained -p:PublishSingleFile=true
   cd ..
   ```

6. **Run as a standalone app (no terminal needed)**
   To create an app you can double-click and keep running after closing the terminal:
   ```bash
   npm run build
   npm run dist
   ```
   Then open the `release` folder and run **ksync 1.2.4.exe** (or use the installer). The app will stay in the system tray; right-click the tray icon to **Show dock**, **Hide dock**, change lyrics color, or **Quit**.

6. **Use the dock**
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
ksync/
├── main.js                 # Electron main process (tray, window, IPC)
├── preload.js              # Preload script for secure renderer API
├── config.js               # Spotify Client ID and redirect URI
├── build-icon.js           # Converts PNG to ICO for Windows build
├── src/
│   ├── App.js              # Main React component
│   ├── components/
│   │   ├── LoginScreen.js  # Spotify connect / login UI
│   │   ├── NowPlaying.js   # Left panel – controls, progress, volume
│   │   ├── LyricsPanel.js  # Center panel – synced lyrics + volume
│   │   ├── QueuePanel.js   # Right panel – queue (unique items)
│   │   └── UserProfile.js  # User avatar/display
│   ├── services/
│   │   ├── SpotifyAuth.js  # PKCE OAuth and token refresh
│   │   ├── SpotifyAPI.js   # Web API calls (player, queue, playback)
│   │   ├── SpotifyService.js # High-level Spotify logic
│   │   └── LyricsService.js   # Multi-provider lyrics (fallbacks)
│   ├── utils/
│   │   └── tokenStore.js   # Secure token storage (Electron safeStorage)
│   ├── styles.css
│   ├── index.js
│   └── index.html
├── assets/                 # Tray icon and other assets
├── webpack.config.js
└── package.json
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

- **Windows SMTC** - For real-time playback control (no Premium required)
- **Spotify Web API** - For track info and recently played data
- **OAuth 2.0** - For secure authentication

### Supported Actions

- ✅ Play/Pause
- ✅ Skip Next/Previous
- ✅ Progress Seeking (if supported by active session)
- ✅ Recently Played Viewing
- ✅ Real-time Track Info

### Limitations

- Playback control is **Windows-only** (relies on System Media Transport Controls)
- Lyrics require third-party service integration
- Must have Spotify desktop app running

## 🛠️ Troubleshooting

### Common Issues

1. **"Authentication failed"**
   - Ensure your Client ID is correct
   - Check that redirect URI matches exactly

2. **"No track playing"**
   - Ensure Spotify desktop app is running
   - Check that you're playing music in Spotify

3. **Dock not appearing**
   - Check that the app is running
   - Try moving mouse to very top of screen
   - Restart the application

4. **Controls not working**
   - Ensure Spotify is the active playback device
   - Check that you're logged into the correct account
   - Try refreshing the authentication

## 🚀 Building for Distribution

To create a distributable package (installer + portable exe):

```bash
npm run build
npm run build:icon   # optional; generates build/icon.ico from PNG
npm run dist
```

Output is in the **`release`** folder: `ksync Setup 1.2.4.exe` (installer) and `ksync 1.2.4.exe` (portable). The app runs from the system tray; right-click the tray icon to show/hide the dock, change lyrics color, or quit.

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
