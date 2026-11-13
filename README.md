<div align="center">

<img src="assets/k-logo-white.png" alt="ksync Logo" width="88" height="88" />

# ksync

**A sleek, auto-hiding Spotify desktop dock with dynamic audio visualizer, synced lyrics, and native media controls for Windows.**

[![Release](https://img.shields.io/github/v/release/kiru-studio/Ksync?style=flat-square&color=1DB954&label=release)](https://github.com/kiru-studio/Ksync/releases/latest)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-0078D6?style=flat-square)](https://github.com/kiru-studio/Ksync/releases)
[![Electron](https://img.shields.io/badge/Electron-28-47848F?style=flat-square)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square)](https://react.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-gray?style=flat-square)](LICENSE)

</div>

---

## 📥 Downloads

Get the latest release for **Windows 10 / 11 (64-bit)**:

| Edition | Direct Download | Notes |
| :--- | :--- | :--- |
| **Installer** | [**`ksync-Setup-2.5.4.exe`**](https://github.com/kiru-studio/Ksync/releases/download/v2.5.4/ksync-Setup-2.5.4.exe) | Recommended. NSIS installer with auto-update support & Start menu integration. |
| **Portable** | [**`ksync-2.5.4.exe`**](https://github.com/kiru-studio/Ksync/releases/download/v2.5.4/ksync-2.5.4.exe) | Single standalone executable. Run anywhere without installing. |

> Check the [GitHub Releases](https://github.com/kiru-studio/Ksync/releases) page for release notes and cryptographic checksums (`SHA256SUMS.txt`).

---

## ✨ Features

- **Smart Auto-Hide Dock** — Slides smoothly into view when your cursor approaches the screen edge. Supports both **Top Dock** and **Vertical Sidebar** orientations.
- **Dynamic BPM Audio Visualizer** — Real-time reactive circular spectrum that pulses and animates in sync with song tempo, amplitude, and playback status.
- **Interactive Vinyl Art** — Click album artwork to toggle between classic cover art and an authentic rotating vinyl disc.
- **Synced Karaoke Lyrics** — Multi-provider real-time synchronized lyrics with responsive line wrapping and automatic scrolling.
- **Native Windows SMTC Bridge** — Built-in .NET 10 System Media Transport Controls sidecar enabling instant playback controls (Play, Pause, Skip, Seek) for **both Spotify Free and Premium** users.
- **Discord Rich Presence** — Broadcast your active playback, album art, and track details to your Discord profile.
- **Low Footprint** — System tray integration with negligible idle CPU and RAM usage when hidden.

---

## 🚀 Quick Start (Developers)

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [.NET SDK 10.0](https://dotnet.microsoft.com/) (to compile the SMTC native sidecar)
- Spotify Desktop app running on Windows

### Installation & Development

```bash
# 1. Clone the repository
git clone https://github.com/kiru-studio/Ksync.git
cd Ksync

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

### Production Build

```bash
# Compile frontend, build icons, and package Windows binaries
npm run dist
```
Distributable installers and portable executables are generated in the `release/` directory.

---

## 📁 Project Architecture

```text
Ksync/
├── assets/         # App icons, tray icons, and visual assets
├── build/          # Windows installer configuration, scripts & icon files
├── scripts/        # Build automation, icon generation & packaging utilities
├── smtc-bridge/    # C# / .NET 10 native Windows SMTC sidecar
├── src/            # React frontend (components, contexts, services)
├── config.js       # App configuration & runtime defaults
├── dev-app-update.yml # Local auto-updater manifest
├── main.js         # Electron main process & native IPC channels
├── package.json    # Dependencies, build metadata & npm scripts
├── preload.js      # Secure context bridge between Electron & React
└── webpack.config.js # Frontend module bundler config
```

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

Developed with ❤️ by **[kiru studio](https://github.com/kiru-studio)**.
