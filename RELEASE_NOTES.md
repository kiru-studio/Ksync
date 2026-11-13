## 🎵 ksync v2.5.4 — Interactive Edge Trigger Configurator, In-App Volume & Studio Polish

Welcome to the official **v2.5.4** release of **ksync** by [kiru studio](https://github.com/kiru-studio)!

---

### 🌟 What's New & Fixed in v2.5.4

#### 1. 🎯 Interactive Edge Trigger Area Configurator
- **Live Cinematic Screen Simulation**: Real-time visual stage simulating monitor edges (Top, Left, Right) with live hotspot rendering, depth indicators, and trigger tag tracking.
- **Geometry Presets**: Choose between calibrated profiles:
  - *Full Screen Edge (100%)*
  - *Center Focus (60%)* — protects browser tabs and top corner window controls
  - *Compact Hotspot (35%)* — tight hotspot for power users
  - *Dock Bounds Match* — geometric lock matching dock pixel footprint
  - *Left/Right Corner Focus (35%)*
  - *Manual Custom* — unconstrained width percentage and position offset tuning
- **Hover Dwell Delay (Brush-By Shield)**: Built-in dwell filter (`Instant 0ms`, `Quick 100ms`, `Balanced 200ms`, `Deliberate 350ms`) requiring cursor to linger before revealing the dock, preventing accidental triggers when sweeping across the screen.
- **Precision Reveal Depth**: Tune hotspot reveal distance from absolute 1px screen boundary up to 16px.
- **Clean Bento Architecture**: Fully collapsible configurator card with balanced, simplified bento controls.

#### 2. 🔊 Dedicated Spotify In-App Volume Slider & Zero-Latency Sync
- **Restored In-App Volume Slider**: Dedicated slider for direct Spotify volume control.
- **Race Condition & Overlap Elimination**: Re-architected volume event handling with debouncing and optimistic local state to prevent overlapping events and ensure instant response.

#### 3. 🎨 Dynamic Theme Harmonization & Accent Sync
- **Dock-Harmonized Settings Styling**: Settings window now shares the dock's backdrop blur, glassmorphism, and seamless titlebar aesthetics.
- **100% Theme-Reactive Controls**: Replaced all hardcoded emerald green accents across Settings with dynamic CSS tokens (`var(--accent)`, `var(--accent-soft)`, `var(--accent-glow)`).
- **Theme-Synced Wireframe Mocks**: Album art wireframes (Vinyl & Square), framing previews (Full Screen & Dynamic Island), and screen position wireframes (Left, Top, Right) now react dynamically in real-time to the current album artwork or user theme.

#### 4. ✨ UI Layout Polish
- **Balanced Font Weight Grid**: Font weight options aligned into a clean 3x2 grid.
- **Docked Font Upload**: The custom font upload button is now docked directly alongside the font family selector bar.
- **Contextual Framing Options**: Dynamic Island shape selector (Square vs Rectangle) is displayed conditionally only when Floating Dynamic Island framing is active.
- **Responsive Artwork Sizing**: Album art size slider with responsive scaling and presentation previews.

---

### 📦 Downloads & Installation

| File | Type | Description |
| :--- | :--- | :--- |
| [**`ksync-Setup-2.5.4.exe`**](https://github.com/kiru-studio/Ksync/releases/download/v2.5.4/ksync-Setup-2.5.4.exe) | **Windows Installer** | Recommended NSIS installer with automatic Start Menu shortcuts and background update checking. |
| [**`ksync-2.5.4.exe`**](https://github.com/kiru-studio/Ksync/releases/download/v2.5.4/ksync-2.5.4.exe) | **Portable Standalone** | Self-contained executable. No installation required—just download and double-click to run. |

> **Windows SmartScreen Note**: As an independent open-source project without a costly enterprise EV code-signing certificate, Windows SmartScreen may show an alert on first launch. Click *"More info"* → *"Run anyway"* to run the app safely.

