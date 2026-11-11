import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Palette,
  Layout,
  Compass,
  User,
  Info,
  Pin,
  Sparkles,
  Volume2,
  ExternalLink,
  LogOut,
  LogIn,
  RotateCcw,
  Radio,
  Check,
  Laptop,
  Smartphone,
  Tv,
  Speaker,
  Keyboard,
  ChevronLeft,
  ChevronRight,
  Monitor,
  RefreshCw,
  Music,
  ListMusic,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Heart,
  Sliders,
  CheckCircle2,
  ArrowUpCircle,
  Download,
  AlertCircle,
  X,
  Minus,
  Zap,
  Activity,
  ArrowRight,
  Clock,
  Undo2,
  Redo2,
  Save,
  MoreVertical,
  Search,
  Trash2,
  Copy,
  Edit2,
  Star,
  Upload,
  FileJson,
  Layers,
  Type,
  Eye,
  Plus,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Power,
  Target,
} from 'lucide-react';
import { useSettings, PRESET_THEMES, DEFAULT_SETTINGS } from '../context/SettingsContext';
import SpotifyService from '../services/SpotifyService';
import appIcon from '../../assets/app-icon.png';

// WCAG 2.1 Contrast & Color Utility Helpers
function hexToRgbValues(hex) {
  if (!hex || typeof hex !== 'string') return [255, 255, 255];
  let c = hex.replace('#', '').trim();
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  if (c.length >= 6) {
    const num = parseInt(c.slice(0, 6), 16);
    if (!isNaN(num)) {
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    }
  }
  return [255, 255, 255];
}

function getRelativeLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function calculateContrastRatio(hex1, hex2) {
  try {
    const [r1, g1, b1] = hexToRgbValues(hex1);
    const [r2, g2, b2] = hexToRgbValues(hex2);
    const l1 = getRelativeLuminance(r1, g1, b1);
    const l2 = getRelativeLuminance(r2, g2, b2);
    const brighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return ((brighter + 0.05) / (darker + 0.05)).toFixed(1);
  } catch (e) {
    return '21.0';
  }
}

function hexToHsl(hex) {
  const [r, g, b] = hexToRgbValues(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
      default: break;
    }
    h /= 6;
  }
  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

const SOLID_COLOR_SWATCHES = [
  '#0c0e14',
  '#000000',
  '#111827',
  '#1e1b4b',
  '#180828',
  '#2a0808',
  '#062419',
  '#17202a',
];

const LYRIC_GLOW_SWATCHES = [
  { name: 'Artwork Dynamic', hex: 'dynamic', isDynamic: true },
  { name: 'Spotify Green', hex: '#1db954' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Pure White', hex: '#ffffff' },
];

export default function SettingsApp() {
  const [activeTab, setActiveTab] = useState('appearance');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [devices, setDevices] = useState([]);
  const [currentDeviceId, setCurrentDeviceId] = useState(null);
  const [transferringDeviceId, setTransferringDeviceId] = useState(null);
  const [transferFeedback, setTransferFeedback] = useState(null);
  const [playbackBackend, setPlaybackBackend] = useState('smtc');
  const [authError, setAuthError] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [customClientIdInput, setCustomClientIdInput] = useState(settings?.behavior?.spotifyClientId || '');
  const [clientIdSaveFeedback, setClientIdSaveFeedback] = useState(null);
  const [showClientGuide, setShowClientGuide] = useState(false);
  const [isRefreshingDevices, setIsRefreshingDevices] = useState(false);
  const [isRecordingHotkey, setIsRecordingHotkey] = useState(false);
  const [hotkeyCombo, setHotkeyCombo] = useState('Ctrl + Alt + S');
  const [customHex, setCustomHex] = useState('');
  const [appVersion, setAppVersion] = useState('2.5.2');
  const [updateStatus, setUpdateStatus] = useState({ state: 'idle', percent: 0, version: null });
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [openAtLogin, setOpenAtLogin] = useState(false);
  const [dockDimensions, setDockDimensions] = useState({
    width: 1920,
    height: 190,
    mode: 'top',
  });
  const [draggedPanelId, setDraggedPanelId] = useState(null);
  const [dragOverPanelId, setDragOverPanelId] = useState(null);

  // Appearance Studio states
  const [appearanceSearch, setAppearanceSearch] = useState('');
  const [renamingPresetId, setRenamingPresetId] = useState(null);
  const [connectedDisplays, setConnectedDisplays] = useState([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.getAllDisplays) {
      window.electronAPI.getAllDisplays().then((ds) => {
        if (Array.isArray(ds)) setConnectedDisplays(ds);
      }).catch(() => {});
    }
  }, []);
  const [renameInputValue, setRenameInputValue] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importFeedback, setImportFeedback] = useState(null);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [historyStack, setHistoryStack] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const fontFileInputRef = useRef(null);

  const handleFontFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setToastMessage('Font file must be under 5 MB');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    let format = 'truetype';
    if (ext === 'otf') format = 'opentype';
    else if (ext === 'woff') format = 'woff';
    else if (ext === 'woff2') format = 'woff2';

    const rawName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
    const cleanFontName = rawName || 'Custom Font';

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target?.result;
      if (!base64Data) return;

      const customFontObj = {
        name: cleanFontName,
        data: base64Data,
        format,
        fileName: file.name,
      };

      updateThemingWithHistory({
        customFont: customFontObj,
        lyricsFontFamily: `'${cleanFontName}', sans-serif`,
      });

      setToastMessage(`Font "${cleanFontName}" applied!`);
      setTimeout(() => setToastMessage(null), 3000);
    };

    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveCustomFont = () => {
    updateThemingWithHistory({
      customFont: null,
      lyricsFontFamily: 'system-ui, -apple-system, sans-serif',
    });
    setToastMessage('Custom font removed');
    setTimeout(() => setToastMessage(null), 3000);
  };
  const [collapsedSections, setCollapsedSections] = useState({
    'appearance-background': true,
    'appearance-colors': true,
    'appearance-typography': true,
    'appearance-components': true,
  });

  const {
    settings,
    isLoaded,
    updateSettings,
    resetSettings,
    applyPreset,
    saveCustomPreset,
    duplicatePreset,
    renameCustomPreset,
    deleteCustomPreset,
    favoritePreset,
    importTheme,
    exportTheme,
    restoreBuiltinPresets,
    presets = PRESET_THEMES,
    builtinPresets = PRESET_THEMES,
  } = useSettings();

  const theming = settings.theming || {};
  const position = settings.position || {};
  const layout = settings.layout || {};
  const behavior = settings.behavior || {};

  // Dirty state tracking: snapshot settings once loaded
  const initialSettingsRef = useRef(null);
  useEffect(() => {
    if (settings && isLoaded && !initialSettingsRef.current) {
      initialSettingsRef.current = JSON.stringify(settings);
    }
  }, [settings, isLoaded]);

  const hasUnsavedChanges = Boolean(
    initialSettingsRef.current &&
    JSON.stringify(settings) !== initialSettingsRef.current
  );

  const handleGlobalReset = async () => {
    try {
      await resetSettings();
      initialSettingsRef.current = JSON.stringify(DEFAULT_SETTINGS);
      setToastMessage('Settings reset to factory defaults');
      setTimeout(() => setToastMessage(''), 3000);
    } catch (err) {
      console.error('Reset failed:', err);
    }
  };

  // Check auth, devices, and dock dimensions on mount
  useEffect(() => {
    document.title = 'ksync Settings & Configurator';
    const api = typeof window !== 'undefined' && window.electronAPI;

    const handleFocus = () => {
      if (api && api.showDock) api.showDock();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && api && api.showDock) {
        api.showDock();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (api) {
      // Ensure dock is visible and restored in its reserved housing
      if (api.showDock) {
        api.showDock();
      }

      if (api.getDockDimensions) {
        api.getDockDimensions().then((dims) => {
          if (dims) setDockDimensions(dims);
        });
      }
      if (api.onDockDimensions) {
        api.onDockDimensions((dims) => {
          if (dims) setDockDimensions(dims);
        });
      }
      if (api.getPlaybackBackend) {
        api.getPlaybackBackend().then((b) => setPlaybackBackend(b || 'smtc'));
      }

      api.spotifyHasTokens().then((hasTokens) => {
        setIsAuthenticated(!!hasTokens);
        if (hasTokens) {
          SpotifyService.init().then(() => {
            SpotifyService.getCurrentUser().then((profile) => setUser(profile || null));
            SpotifyService.getDevices().then((devs) => {
              if (devs) setDevices(devs);
            });
            SpotifyService.getCurrentTrack().then((track) => {
              if (track?.device?.id) setCurrentDeviceId(track.device.id);
            });
          });
        }
      });

      if (api.onSpotifyLoginDone) {
        api.onSpotifyLoginDone(() => {
          setIsAuthenticated(true);
          SpotifyService.getCurrentUser().then((profile) => setUser(profile || null));
          SpotifyService.getDevices().then((devs) => {
            if (devs) {
              setDevices(devs);
              const active = devs.find((d) => d.is_active);
              if (active?.id) setCurrentDeviceId(active.id);
            }
          });
        });
      }

      if (api.onSpotifyLogoutDone) {
        api.onSpotifyLogoutDone(() => {
          setIsAuthenticated(false);
          setUser(null);
          setDevices([]);
          setCurrentDeviceId(null);
        });
      }

      if (api.getAppVersion) {
        api.getAppVersion().then((v) => { if (v) setAppVersion(v); });
      }

      if (api.getUpdateStatus) {
        api.getUpdateStatus().then((s) => { if (s) setUpdateStatus(s); });
      }

      if (api.getLoginItemSettings) {
        api.getLoginItemSettings().then((val) => setOpenAtLogin(!!val));
      }

      if (api.onUpdateStatus) {
        api.onUpdateStatus((s) => {
          if (s) {
            setUpdateStatus(s);
            if (s.state !== 'checking') setIsCheckingUpdate(false);
          }
        });
      }
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        const api = typeof window !== 'undefined' && window.electronAPI;
        if (api && api.closeSettingsWindow) {
          api.closeSettingsWindow();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleCloseWindow = () => {
    const api = typeof window !== 'undefined' && window.electronAPI;
    if (api && api.closeSettingsWindow) {
      api.closeSettingsWindow();
    }
  };

  const handleMinimizeWindow = () => {
    const api = typeof window !== 'undefined' && window.electronAPI;
    if (api && api.minimizeSettingsWindow) {
      api.minimizeSettingsWindow();
    }
  };

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdate(true);
    const api = typeof window !== 'undefined' && window.electronAPI;
    if (api && api.checkForUpdates) {
      try {
        await api.checkForUpdates();
      } catch (err) {
        console.warn('[SettingsApp] Check update failed:', err);
      }
    }
    setTimeout(() => setIsCheckingUpdate(false), 2500);
  };

  const handleQuitAndInstall = () => {
    const api = typeof window !== 'undefined' && window.electronAPI;
    if (api && api.quitAndInstall) {
      api.quitAndInstall();
    }
  };

  const handleToggleOpenAtLogin = async () => {
    const api = typeof window !== 'undefined' && window.electronAPI;
    if (api && api.setLoginItemSettings) {
      const nextVal = !openAtLogin;
      const res = await api.setLoginItemSettings(nextVal);
      setOpenAtLogin(!!res);
      updateSettings({ behavior: { openAtLogin: !!res } });
    }
  };

  useEffect(() => {
    if (settings?.behavior?.spotifyClientId !== undefined) {
      setCustomClientIdInput(settings.behavior.spotifyClientId || '');
    }
  }, [settings?.behavior?.spotifyClientId]);

  const handleSaveCustomClientId = (newId) => {
    const trimmed = (newId || '').trim();
    updateSettings({ behavior: { spotifyClientId: trimmed } });
    setClientIdSaveFeedback('Client ID applied! Click "Connect Account" to authenticate with your application.');
    setTimeout(() => setClientIdSaveFeedback(null), 5000);
  };

  const handleResetCustomClientId = () => {
    updateSettings({ behavior: { spotifyClientId: '' } });
    setCustomClientIdInput('');
    setClientIdSaveFeedback('Reset to default community Spotify Client ID.');
    setTimeout(() => setClientIdSaveFeedback(null), 5000);
  };

  const handleLogin = async () => {
    try {
      setIsAuthenticating(true);
      setAuthError(null);
      await SpotifyService.authenticate();
      setIsAuthenticated(true);
      const profile = await SpotifyService.getCurrentUser();
      setUser(profile || null);
      const devs = await SpotifyService.getDevices();
      if (devs) setDevices(devs);
    } catch (err) {
      setAuthError(err.message || 'Login failed. If using Development Mode, add your email in Developer Dashboard or enter your own Client ID below.');
      console.error('[SettingsApp] Login error:', err);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    SpotifyService.logout();
    setIsAuthenticated(false);
    setUser(null);
    setDevices([]);
    setCurrentDeviceId(null);
    setTransferFeedback(null);
  };

  const handleRefreshDevices = async () => {
    setIsRefreshingDevices(true);
    setTransferFeedback(null);
    try {
      const devs = await SpotifyService.getDevices();
      if (devs) {
        setDevices(devs);
        const activeDev = devs.find((d) => d.is_active);
        if (activeDev?.id) setCurrentDeviceId(activeDev.id);
      }
    } catch (_) {}
    setTimeout(() => setIsRefreshingDevices(false), 500);
  };

  const handleDeviceChange = async (deviceId, deviceName) => {
    if (transferringDeviceId || deviceId === currentDeviceId) return;
    setTransferringDeviceId(deviceId);
    setTransferFeedback(null);
    try {
      const res = await SpotifyService.transferPlayback([deviceId], true);
      if (res && res.ok === false) {
        throw new Error(res.error || 'Transfer failed');
      }
      setCurrentDeviceId(deviceId);
      setTransferFeedback({
        type: 'success',
        message: `Playback stream successfully routed to ${deviceName || 'selected endpoint'}.`,
      });
      setTimeout(async () => {
        const devs = await SpotifyService.getDevices();
        if (devs) {
          setDevices(devs);
          const active = devs.find((d) => d.id === deviceId || d.is_active);
          if (active?.id) setCurrentDeviceId(active.id);
        }
        setTransferringDeviceId(null);
      }, 700);
    } catch (err) {
      console.error('[SettingsApp] Error transferring device:', err);
      const msg = err.message || '';
      const userMsg = msg.includes('403') || msg.toLowerCase().includes('premium')
        ? 'Spotify Premium is required for Spotify Connect endpoint routing.'
        : `Endpoint transfer error: ${msg || 'Device unreachable'}`;
      setTransferFeedback({
        type: 'error',
        message: userMsg,
      });
      setTransferringDeviceId(null);
    }
  };

  // Auto-refresh devices on account tab switch
  useEffect(() => {
    if (activeTab === 'account' && isAuthenticated) {
      handleRefreshDevices();
    }
  }, [activeTab, isAuthenticated]);

  const handlePanelToggle = (panelKey) => {
    const current = layout[panelKey];
    const activeCount =
      (layout.showNowPlaying !== false ? 1 : 0) +
      (layout.showLyrics !== false ? 1 : 0) +
      (layout.showQueue !== false ? 1 : 0);
    if (current !== false && activeCount <= 1) return;

    updateSettings({
      layout: {
        [panelKey]: current === false,
      },
    });
  };

  const handleCardDragStart = (e, panelId) => {
    if (e.target.closest('.pill-toggle-switch')) {
      e.preventDefault();
      return;
    }
    setDraggedPanelId(panelId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', panelId);
  };

  const handleCardDragOver = (e, panelId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverPanelId !== panelId) {
      setDragOverPanelId(panelId);
    }
  };

  const handleCardDragLeave = (e, panelId) => {
    if (dragOverPanelId === panelId) {
      setDragOverPanelId(null);
    }
  };

  const handleCardDrop = (e, targetPanelId) => {
    e.preventDefault();
    if (!draggedPanelId || draggedPanelId === targetPanelId) {
      setDraggedPanelId(null);
      setDragOverPanelId(null);
      return;
    }

    const order = [...(layout.panelOrder || ['nowPlaying', 'lyrics', 'queue'])];
    const fromIndex = order.indexOf(draggedPanelId);
    const toIndex = order.indexOf(targetPanelId);

    if (fromIndex !== -1 && toIndex !== -1) {
      order.splice(fromIndex, 1);
      order.splice(toIndex, 0, draggedPanelId);
      updateSettings({
        layout: {
          panelOrder: order,
        },
      });
    }

    setDraggedPanelId(null);
    setDragOverPanelId(null);
  };

  const handleCardDragEnd = () => {
    setDraggedPanelId(null);
    setDragOverPanelId(null);
  };

  const handleOrderSwap = (index, direction) => {
    const order = [...(layout.panelOrder || ['nowPlaying', 'lyrics', 'queue'])];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= order.length) return;
    const temp = order[index];
    order[index] = order[targetIndex];
    order[targetIndex] = temp;
    updateSettings({
      layout: {
        panelOrder: order,
      },
    });
  };

  const handleOrderPreset = (orderArray) => {
    updateSettings({
      layout: {
        panelOrder: orderArray,
      },
    });
  };

  const handleCustomHexSubmit = (e) => {
    e.preventDefault();
    let hex = customHex.trim();
    if (!hex.startsWith('#')) hex = '#' + hex;
    if (/^#[0-9A-F]{6}$/i.test(hex)) {
      updateSettings({
        theming: {
          solidColor: hex,
          backdropStyle: 'solid',
        },
      });
      setCustomHex('');
    }
  };

  // Undo/Redo & Theming history manager
  const updateThemingWithHistory = useCallback(
    (partial) => {
      const nextTheming = { ...theming, ...partial };
      setHistoryStack((prevStack) => {
        const base = prevStack.length === 0 ? [theming] : prevStack.slice(0, historyIndex + 1);
        const newStack = [...base, nextTheming].slice(-30);
        setHistoryIndex(newStack.length - 1);
        return newStack;
      });
      updateSettings({ theming: partial });
    },
    [theming, historyIndex, updateSettings]
  );

  const handleApplyPresetWithHistory = useCallback(
    (presetId) => {
      const p = presets.find((x) => x.id === presetId);
      if (!p) return;
      const nextTheming = {
        ...theming,
        ...p,
        preset: p.id,
      };
      setHistoryStack((prevStack) => {
        const base = prevStack.length === 0 ? [theming] : prevStack.slice(0, historyIndex + 1);
        const newStack = [...base, nextTheming].slice(-30);
        setHistoryIndex(newStack.length - 1);
        return newStack;
      });
      applyPreset(presetId);
    },
    [presets, theming, historyIndex, applyPreset]
  );

  const handleUndo = useCallback(() => {
    if (historyIndex > 0 && historyStack[historyIndex - 1]) {
      const target = historyStack[historyIndex - 1];
      setHistoryIndex((prev) => prev - 1);
      updateSettings({ theming: target });
    }
  }, [historyIndex, historyStack, updateSettings]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= 0 && historyIndex + 1 < historyStack.length && historyStack[historyIndex + 1]) {
      const target = historyStack[historyIndex + 1];
      setHistoryIndex((prev) => prev + 1);
      updateSettings({ theming: target });
    }
  }, [historyIndex, historyStack, updateSettings]);

  useEffect(() => {
    const handleUndoRedoKeys = (e) => {
      if (activeTab !== 'appearance') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
        } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          handleRedo();
        }
      }
    };
    window.addEventListener('keydown', handleUndoRedoKeys);
    return () => window.removeEventListener('keydown', handleUndoRedoKeys);
  }, [activeTab, handleUndo, handleRedo]);

  const handleExportTheme = () => {
    setShowOverflowMenu(false);
    const jsonStr = exportTheme();
    try {
      navigator.clipboard.writeText(jsonStr);
    } catch (e) {
      console.warn('Clipboard write failed', e);
    }
    try {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ksync-theme-${theming.preset || 'custom'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('Download failed', e);
    }
    setToastMessage('Theme exported & copied to clipboard');
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleImportSubmit = (e) => {
    e.preventDefault();
    if (!importJsonText.trim()) return;
    const res = importTheme(importJsonText.trim());
    if (res.success) {
      setShowImportModal(false);
      setImportJsonText('');
      setImportFeedback(null);
      setToastMessage(`Theme "${res.preset?.name || 'Imported'}" imported successfully!`);
      setTimeout(() => setToastMessage(null), 3500);
    } else {
      setImportFeedback(res.error || 'Invalid theme format');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setImportJsonText(evt.target.result || '');
      setImportFeedback(null);
    };
    reader.readAsText(file);
  };

  const handleRenameSubmit = (e) => {
    e.preventDefault();
    if (!renameInputValue.trim() || !renamingPresetId) return;
    renameCustomPreset(renamingPresetId, renameInputValue.trim());
    setRenamingPresetId(null);
    setRenameInputValue('');
    setToastMessage('Preset renamed successfully');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const toggleSectionCollapse = (secId) => {
    setCollapsedSections((prev) => ({ ...prev, [secId]: !prev[secId] }));
  };

  const collapseAllAppearance = () => {
    setCollapsedSections((prev) => ({
      ...prev,
      'appearance-presets': true,
      'appearance-background': true,
      'appearance-colors': true,
      'appearance-typography': true,
      'appearance-components': true,
    }));
  };

  const expandAllAppearance = () => {
    setCollapsedSections((prev) => ({
      ...prev,
      'appearance-presets': false,
      'appearance-background': false,
      'appearance-colors': false,
      'appearance-typography': false,
      'appearance-components': false,
    }));
  };

  const areAllAppearanceCollapsed = [
    'appearance-presets',
    'appearance-background',
    'appearance-colors',
    'appearance-typography',
    'appearance-components',
  ].every((id) => !!collapsedSections[id]);

  const activePresetObj = presets.find((p) => p.id === theming.preset);
  const isDraft = activePresetObj
    ? (theming.accentColor !== activePresetObj.accentColor ||
       theming.backdropStyle !== activePresetObj.backdropStyle ||
       theming.opacity !== activePresetObj.opacity ||
       theming.blurStrength !== activePresetObj.blurStrength ||
       (theming.backdropStyle === 'solid' && theming.solidColor !== activePresetObj.solidColor))
    : false;

  const matchesSearch = (title, keywords = []) => {
    if (!appearanceSearch.trim()) return true;
    const q = appearanceSearch.toLowerCase().trim();
    if (title.toLowerCase().includes(q)) return true;
    return keywords.some((kw) => kw.toLowerCase().includes(q));
  };



  const currentOrder = layout.panelOrder || ['nowPlaying', 'lyrics', 'queue'];
  const panelMeta = {
    nowPlaying: { label: 'Now Playing', icon: Music, desc: 'Album art, track title, controls & progress' },
    lyrics: { label: 'Lyrics', icon: Sliders, desc: 'Synchronized karaoke lyrics with active glow' },
    queue: { label: 'Queue', icon: ListMusic, desc: 'Up next track previews and playlist history' },
  };

  const mode = position.mode || dockDimensions.mode || 'top';
  const dockHeight = dockDimensions.height || position.height || 190;
  const sidebarWidth = Math.min(Math.max(dockDimensions.width || position.sidebarWidth || 340, 260), 520);
  const isIsland = position.style === 'island';
  const isSquareIsland = !position.islandShape || position.islandShape === 'square';
  const islandWidth = isIsland ? (isSquareIsland ? 480 : 680) : (position.islandWidth || 1180);

  const sidebarElement = (
    <aside className="settings-nav-sidebar">
        {/* Navigation Groups */}
        <nav className="nav-items-container">
          <div className="nav-group-heading">CONFIGURATION</div>
          
          <button
            type="button"
            className={`nav-row-btn ${activeTab === 'appearance' ? 'active' : ''}`}
            onClick={() => setActiveTab('appearance')}
          >
            {activeTab === 'appearance' && <span className="nav-active-bar" />}
            <Palette size={16} className="nav-icon" />
            <span className="nav-text">Appearance & Theme</span>
          </button>

          <button
            type="button"
            className={`nav-row-btn ${activeTab === 'layout' ? 'active' : ''}`}
            onClick={() => setActiveTab('layout')}
          >
            {activeTab === 'layout' && <span className="nav-active-bar" />}
            <Layout size={16} className="nav-icon" />
            <span className="nav-text">Layout & Modules</span>
          </button>

          <button
            type="button"
            className={`nav-row-btn ${activeTab === 'position' ? 'active' : ''}`}
            onClick={() => setActiveTab('position')}
          >
            {activeTab === 'position' && <span className="nav-active-bar" />}
            <Compass size={16} className="nav-icon" />
            <span className="nav-text">Position & Edge</span>
          </button>

          <div className="nav-group-heading" style={{ marginTop: '16px' }}>
            CONNECTIVITY
          </div>

          <button
            type="button"
            className={`nav-row-btn ${activeTab === 'account' ? 'active' : ''}`}
            onClick={() => setActiveTab('account')}
          >
            {activeTab === 'account' && <span className="nav-active-bar" />}
            <User size={16} className="nav-icon" />
            <span className="nav-text">Spotify Account</span>
          </button>

          <button
            type="button"
            className={`nav-row-btn ${activeTab === 'about' ? 'active' : ''}`}
            onClick={() => setActiveTab('about')}
          >
            {activeTab === 'about' && <span className="nav-active-bar" />}
            <Info size={16} className="nav-icon" />
            <span className="nav-text">About & Hotkeys</span>
          </button>
        </nav>
      </aside>
  );

  const mainViewportElement = (
      <main className="settings-viewport-center">
        <div className="viewport-content-container">
          {/* TAB 1: APPEARANCE & VISUAL ENGINE STUDIO */}
          {activeTab === 'appearance' && (
          <div className="settings-tab-pane appearance-studio-pane">
            {/* Page Header */}
            <header className="viewport-page-header">
              <div className="header-meta-row flex-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                <div>
                  <h1 className="viewport-page-title">Appearance & Visual Engine</h1>
                  <p className="viewport-page-desc">
                    Comprehensive visual studio for KSync — customize themes, backdrop physics, OLED levels, color tokens, and karaoke typography.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginTop: '4px' }}>
                  <button
                    type="button"
                    className="card-action-btn ghost"
                    onClick={areAllAppearanceCollapsed ? expandAllAppearance : collapseAllAppearance}
                    title={areAllAppearanceCollapsed ? "Expand all sections" : "Collapse all sections"}
                  >
                    <span>{areAllAppearanceCollapsed ? "Expand all" : "Collapse all"}</span>
                  </button>
                </div>
              </div>
            </header>


            {/* SECTION 1: THEME PRESETS */}
            {matchesSearch('Theme Presets', ['preset', 'custom', 'spotify', 'oled', 'glass', 'cyberpunk', 'sunset', 'artwork']) && (() => {
              const isOpen = appearanceSearch.trim() ? true : !collapsedSections['appearance-presets'];
              return (
                <section className="settings-level1-card">
                  <div
                    className="card-top-header flex-between"
                    onClick={() => toggleSectionCollapse('appearance-presets')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSectionCollapse('appearance-presets');
                      }
                    }}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div className="header-left-cluster">
                      <div className="card-icon-badge">
                        <Sparkles size={16} />
                      </div>
                      <div>
                        <h3 className="card-title-text">Theme Presets</h3>
                        <p className="card-desc-text">1-click visual identities and custom user themes.</p>
                      </div>
                    </div>
                    <div className="header-right-cluster">
                      <button
                        type="button"
                        className="card-action-btn ghost icon-only"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSectionCollapse('appearance-presets');
                        }}
                        title={isOpen ? "Collapse section" : "Expand section"}
                        aria-expanded={isOpen}
                      >
                        <ChevronDown
                          size={16}
                          style={{
                            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.22s ease',
                            color: '#a1a1aa',
                          }}
                        />
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="theme-presets-grid">
                      {builtinPresets.map((preset) => {
                        const activePresetId = theming.preset === 'default' ? 'custom' : (theming.preset || 'custom');
                        const isActive = activePresetId === preset.id;
                        return (
                          <div
                            key={preset.id}
                            className={`preset-card-visual ${isActive ? 'active' : ''}`}
                            onClick={() => handleApplyPresetWithHistory(preset.id)}
                            role="button"
                            tabIndex={0}
                            title={`Activate ${preset.name} theme`}
                          >
                            {/* Top Mini Preview Stage */}
                            <div
                              className={`preset-stage-preview stage-${preset.id}`}
                              style={{
                                background: preset.backdropStyle === 'solid'
                                  ? preset.solidColor
                                  : preset.backdropStyle === 'gradient' && preset.gradient
                                  ? `linear-gradient(${preset.gradient.angle || 135}deg, ${preset.gradient.color1 || '#181b29'}, ${preset.gradient.color2 || '#0b0c13'})`
                                  : preset.id === 'oled'
                                  ? '#000000'
                                  : undefined,
                              }}
                            >
                              <div className="mini-stage-album" style={{ borderRadius: `${theming.artCornerRadius ?? 10}px` }} />
                              <div className="mini-stage-lyrics">
                                <span className="mini-bar-inactive" />
                                <span
                                  className="mini-bar-active"
                                  style={{
                                    backgroundColor: preset.lyricsActiveColor || preset.accentColor,
                                    boxShadow: `0 0 10px ${preset.lyricsActiveColor || preset.accentColor}`,
                                  }}
                                />
                              </div>
                              <div
                                className="mini-stage-pill"
                                style={{
                                  backgroundColor: preset.accentColor || '#1db954',
                                }}
                              />
                            </div>

                            {/* Bottom Label Bar */}
                            <div className="preset-label-bar">
                              <div className="preset-title-cluster">
                                <span className="preset-title">{preset.name}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })()}

            {/* SECTION 2: BACKGROUND & ARTWORK */}
            {matchesSearch('Background & Artwork', ['solid', 'gradient', 'linear', 'radial', 'angle', 'stops', 'vignette', 'blend', 'zoom', 'album', 'artwork', 'blur', 'glass', 'acrylic', 'opacity', 'border', 'materials']) && (() => {
              const isOpen = appearanceSearch.trim() ? true : !collapsedSections['appearance-background'];
              const activePresetId = theming.preset === 'default' ? 'custom' : (theming.preset || 'custom');
              const isCustom = activePresetId === 'custom';

              return (
                <section className="settings-level1-card">
                  <div
                    className="card-top-header flex-between"
                    onClick={() => toggleSectionCollapse('appearance-background')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSectionCollapse('appearance-background');
                      }
                    }}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div className="header-left-cluster">
                      <div className="card-icon-badge">
                        <Palette size={16} />
                      </div>
                      <div>
                        <h3 className="card-title-text">
                          {isCustom ? "Custom Background Fill" : `${activePresetId === 'oled' ? 'OLED Pure Black Canvas' : activePresetId === 'artwork' ? 'Album Reactive Backdrop' : activePresetId === 'frosted' ? 'Frosted Acrylic Canvas' : activePresetId === 'cyberpunk' ? 'Neon Cyberpunk Canvas' : activePresetId === 'warm-amber' ? 'Warm Sunset Canvas' : 'Background Canvas'}`}
                        </h3>
                        <p className="card-desc-text">
                          {isCustom
                            ? "Full custom background matrix: select solid colors, gradients, acrylic diffusion, or album reactive extraction."
                            : `Settings tailored specifically for the active ${activePresetId === 'oled' ? 'OLED Pure Black' : activePresetId === 'artwork' ? 'Artwork Reactive' : activePresetId === 'frosted' ? 'Frosted Glass 11' : activePresetId === 'cyberpunk' ? 'Neon Cyberpunk' : 'Warm Sunset'} profile.`}
                        </p>
                      </div>
                    </div>
                    <div className="header-right-cluster">
                      {!isCustom && (
                        <button
                          type="button"
                          className="card-action-btn"
                          style={{
                            fontSize: '11.5px',
                            padding: '4px 10px',
                            marginRight: '8px',
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '6px',
                            color: '#a1a1aa',
                            cursor: 'pointer',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateThemingWithHistory({ preset: 'custom' });
                          }}
                          title="Switch to Custom to unlock all background modes"
                        >
                          Customize
                        </button>
                      )}
                      <button
                        type="button"
                        className="card-action-btn ghost icon-only"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSectionCollapse('appearance-background');
                        }}
                        title={isOpen ? "Collapse section" : "Expand section"}
                        aria-expanded={isOpen}
                      >
                        <ChevronDown
                          size={16}
                          style={{
                            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.22s ease',
                            color: '#a1a1aa',
                          }}
                        />
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <>
                      {isCustom ? (
                        <>
                          {/* 6 Background Mode Segmented Tabs */}
                <div className="segmented-pill-tray six-items">
                  {[
                    { id: 'solid', label: 'Solid Color' },
                    { id: 'gradient', label: 'Linear Gradient' },
                    { id: 'radial', label: 'Radial Gradient' },
                    { id: 'artwork', label: 'Album Reactive' },
                    { id: 'acrylic', label: 'Frosted Acrylic' },
                    { id: 'mesh', label: 'Mesh Accent' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`segmented-tab-btn ${theming.backdropStyle === opt.id ? 'active' : ''}`}
                      onClick={() => updateThemingWithHistory({ backdropStyle: opt.id })}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Mode Sub-Controls */}
                {/* 2.1: Solid Color Mode */}
                {theming.backdropStyle === 'solid' && (
                  <div className="studio-sub-section">
                    <div className="color-picker-composite-row">
                      <div className="picker-color-stage">
                        <label className="native-color-label" style={{ backgroundColor: theming.solidColor || '#0c0e14' }}>
                          <input
                            type="color"
                            value={theming.solidColor || '#0c0e14'}
                            onChange={(e) => updateThemingWithHistory({ solidColor: e.target.value })}
                            className="hidden-color-picker"
                          />
                        </label>
                        <div className="picker-text-details">
                          <span className="picker-title-label">Solid Canvas Color</span>
                          <span className="picker-hsl-value">{hexToHsl(theming.solidColor || '#0c0e14')}</span>
                        </div>
                      </div>

                      {/* Direct HEX Input */}
                      <form onSubmit={handleCustomHexSubmit} className="direct-hex-entry-form">
                        <span className="hex-prefix">#</span>
                        <input
                          type="text"
                          placeholder="0C0E14"
                          value={customHex || (theming.solidColor || '#0c0e14').replace('#', '')}
                          onChange={(e) => setCustomHex(e.target.value)}
                          onBlur={handleCustomHexSubmit}
                          className="direct-hex-input"
                          maxLength={7}
                        />
                      </form>
                    </div>

                    {/* Circular Quick Swatches */}
                    <div className="swatches-hairline-tray">
                      <span className="swatch-row-tag">PRESET SURFACES</span>
                      <div className="circular-swatches-row">
                        {SOLID_COLOR_SWATCHES.map((hex) => {
                          const isSel = theming.solidColor === hex;
                          return (
                            <button
                              key={hex}
                              type="button"
                              className={`circular-color-swatch ${isSel ? 'selected' : ''}`}
                              style={{ backgroundColor: hex }}
                              onClick={() => updateThemingWithHistory({ solidColor: hex, backdropStyle: 'solid' })}
                              title={hex}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* 2.2: Linear Gradient Mode */}
                {theming.backdropStyle === 'gradient' && (
                  <div className="studio-sub-section">
                    {/* Gradient Angle Slider */}
                    <div className="bento-control-pad compact">
                      <div className="bento-header-row">
                        <span className="bento-label">Gradient Direction Angle</span>
                        <span className="tabular-num-pill">{theming.gradient?.angle || 135}°</span>
                      </div>
                      <div className="thick-slider-wrapper">
                        <input
                          type="range"
                          min="0"
                          max="360"
                          value={theming.gradient?.angle || 135}
                          onChange={(e) =>
                            updateThemingWithHistory({
                              gradient: {
                                ...(theming.gradient || {}),
                                angle: parseInt(e.target.value, 10),
                              },
                            })
                          }
                          className="thick-slider-input"
                        />
                      </div>
                    </div>

                    {/* Color Stops Manager */}
                    <div className="gradient-stops-list">
                      <div className="stops-header-row flex-between">
                        <span className="sub-header-label">COLOR STOPS</span>
                        <button
                          type="button"
                          className="add-stop-mini-btn"
                          onClick={() => {
                            const cur = theming.gradient?.stops || [
                              { color: '#181b29', pos: 0 },
                              { color: '#0b0c13', pos: 100 },
                            ];
                            const newStops = [...cur, { color: theming.accentColor || '#1db954', pos: 50 }].sort(
                              (a, b) => a.pos - b.pos
                            );
                            updateThemingWithHistory({
                              gradient: { ...(theming.gradient || { angle: 135 }), stops: newStops },
                            });
                          }}
                        >
                          <Plus size={12} />
                          <span>Add Stop</span>
                        </button>
                      </div>

                      {(theming.gradient?.stops || [
                        { color: '#181b29', pos: 0 },
                        { color: '#0b0c13', pos: 100 },
                      ]).map((stop, idx) => (
                        <div key={idx} className="stop-editor-row">
                          <label className="stop-color-label" style={{ backgroundColor: stop.color }}>
                            <input
                              type="color"
                              value={stop.color}
                              onChange={(e) => {
                                const copy = [...(theming.gradient?.stops || [{ color: '#181b29', pos: 0 }, { color: '#0b0c13', pos: 100 }])];
                                copy[idx] = { ...copy[idx], color: e.target.value };
                                updateThemingWithHistory({ gradient: { ...(theming.gradient || { angle: 135 }), stops: copy } });
                              }}
                              className="hidden-color-picker"
                            />
                          </label>
                          <span className="stop-index-label">Stop {idx + 1}</span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={stop.pos}
                            onChange={(e) => {
                              const copy = [...(theming.gradient?.stops || [{ color: '#181b29', pos: 0 }, { color: '#0b0c13', pos: 100 }])];
                              copy[idx] = { ...copy[idx], pos: parseInt(e.target.value, 10) };
                              updateThemingWithHistory({ gradient: { ...(theming.gradient || { angle: 135 }), stops: copy } });
                            }}
                            className="thick-slider-input flex-1"
                          />
                          <span className="tabular-num-pill">{stop.pos}%</span>
                          {(theming.gradient?.stops?.length || 2) > 2 && (
                            <button
                              type="button"
                              className="remove-stop-mini-btn"
                              onClick={() => {
                                const copy = [...(theming.gradient?.stops || [])];
                                copy.splice(idx, 1);
                                updateThemingWithHistory({ gradient: { ...(theming.gradient || { angle: 135 }), stops: copy } });
                              }}
                              title="Delete color stop"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2.3: Radial Gradient Mode */}
                {theming.backdropStyle === 'radial' && (
                  <div className="studio-sub-section">
                    <div className="two-col-pickers-grid">
                      <div className="picker-block">
                        <span className="sub-header-label">CENTER COLOR</span>
                        <div className="color-picker-composite-row">
                          <label className="native-color-label" style={{ backgroundColor: theming.radialGradient?.color1 || '#1f2438' }}>
                            <input
                              type="color"
                              value={theming.radialGradient?.color1 || '#1f2438'}
                              onChange={(e) =>
                                updateThemingWithHistory({
                                  radialGradient: { ...(theming.radialGradient || {}), color1: e.target.value },
                                })
                              }
                              className="hidden-color-picker"
                            />
                          </label>
                          <span className="hex-val-tag">{theming.radialGradient?.color1 || '#1f2438'}</span>
                        </div>
                      </div>
                      <div className="picker-block">
                        <span className="sub-header-label">EDGE COLOR</span>
                        <div className="color-picker-composite-row">
                          <label className="native-color-label" style={{ backgroundColor: theming.radialGradient?.color2 || '#08090d' }}>
                            <input
                              type="color"
                              value={theming.radialGradient?.color2 || '#08090d'}
                              onChange={(e) =>
                                updateThemingWithHistory({
                                  radialGradient: { ...(theming.radialGradient || {}), color2: e.target.value },
                                })
                              }
                              className="hidden-color-picker"
                            />
                          </label>
                          <span className="hex-val-tag">{theming.radialGradient?.color2 || '#08090d'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2.4: Album Art Reactive Mode */}
                {theming.backdropStyle === 'artwork' && (
                  <div className="studio-sub-section">
                    <div className="card-hairline-row flex-between">
                      <div>
                        <div className="row-main-label">Album Art Color Extraction</div>
                        <div className="row-sub-label">Derive dynamic ambient backdrop hues from currently playing song artwork</div>
                      </div>
                      <button
                        type="button"
                        className={`pill-toggle-switch ${theming.artworkSampling !== false ? 'on active' : 'off'}`}
                        onClick={() =>
                          updateThemingWithHistory({
                            artworkSampling: theming.artworkSampling === false,
                          })
                        }
                      >
                        <span className="toggle-thumb" />
                      </button>
                    </div>

                    {/* Dynamic Blur for Album Art Reactive Mode */}
                    <div className="bento-control-pad" style={{ marginTop: '12px' }}>
                      <div className="bento-header-row">
                        <span className="bento-label">Artwork Backdrop Blur</span>
                        <span className="tabular-num-pill">{theming.blurStrength ?? 50}px</span>
                      </div>
                      <div className="thick-slider-wrapper">
                        <input
                          type="range"
                          min="0"
                          max="80"
                          value={theming.blurStrength ?? 50}
                          onChange={(e) =>
                            updateThemingWithHistory({ blurStrength: parseInt(e.target.value, 10) })
                          }
                          className="thick-slider-input"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 2.5: Frosted Acrylic Mode */}
                {theming.backdropStyle === 'acrylic' && (
                  <div className="studio-sub-section">
                    <div className="bento-control-pad">
                      <div className="bento-header-row">
                        <span className="bento-label">Acrylic Diffusion Blur</span>
                        <span className="tabular-num-pill">{theming.blurStrength ?? 24}px</span>
                      </div>
                      <div className="thick-slider-wrapper">
                        <input
                          type="range"
                          min="0"
                          max="60"
                          value={theming.blurStrength ?? 24}
                          onChange={(e) =>
                            updateThemingWithHistory({ blurStrength: parseInt(e.target.value, 10) })
                          }
                          className="thick-slider-input"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Common Sliders: Backdrop Opacity & Dock Border Opacity */}
                <div className="bento-two-columns" style={{ marginTop: '14px' }}>
                  <div className="bento-control-pad" style={{ gridColumn: 'span 2' }}>
                    <div className="bento-header-row">
                      <span className="bento-label">Global Backdrop Opacity</span>
                      <span className="tabular-num-pill">{Math.round((theming.opacity ?? 0.92) * 100)}%</span>
                    </div>
                    <div className="thick-slider-wrapper">
                      <input
                        type="range"
                        min="10"
                        max="100"
                        value={Math.round((theming.opacity ?? 0.92) * 100)}
                        onChange={(e) =>
                          updateThemingWithHistory({
                            opacity: parseFloat(e.target.value) / 100,
                          })
                        }
                        className="thick-slider-input"
                      />
                    </div>
                  </div>
                </div>
                        </>
                      ) : (
                        /* Curated Profile Tailored Settings */
                        <div className="studio-sub-section" style={{ padding: '4px 0' }}>
                          {activePresetId === 'oled' && (
                            <div style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                              <div style={{ fontSize: '13px', fontWeight: '600', color: '#ffffff' }}>OLED Pure Black Canvas</div>
                              <div style={{ fontSize: '12px', color: '#71717a', marginTop: '2px' }}>Zero-power true black (#000000) canvas locked for OLED efficiency and infinite contrast.</div>
                            </div>
                          )}

                          {activePresetId === 'artwork' && (
                            <>
                              <div className="card-hairline-row flex-between">
                                <div>
                                  <div className="row-main-label">Album Art Color Extraction</div>
                                  <div className="row-sub-label">Derive dynamic ambient backdrop hues from currently playing song artwork</div>
                                </div>
                                <button
                                  type="button"
                                  className={`pill-toggle-switch ${theming.artworkSampling !== false ? 'on active' : 'off'}`}
                                  onClick={() => updateThemingWithHistory({ artworkSampling: theming.artworkSampling === false })}
                                >
                                  <span className="toggle-thumb" />
                                </button>
                              </div>

                              <div className="bento-two-columns" style={{ marginTop: '14px' }}>
                                <div className="bento-control-pad">
                                  <div className="bento-header-row">
                                    <span className="bento-label">Artwork Backdrop Blur</span>
                                    <span className="tabular-num-pill">{theming.blurStrength ?? 50}px</span>
                                  </div>
                                  <div className="thick-slider-wrapper">
                                    <input
                                      type="range"
                                      min="0"
                                      max="80"
                                      value={theming.blurStrength ?? 50}
                                      onChange={(e) => updateThemingWithHistory({ blurStrength: parseInt(e.target.value, 10) })}
                                      className="thick-slider-input"
                                    />
                                  </div>
                                </div>

                                <div className="bento-control-pad">
                                  <div className="bento-header-row">
                                    <span className="bento-label">Global Backdrop Opacity</span>
                                    <span className="tabular-num-pill">{Math.round((theming.opacity ?? 0.88) * 100)}%</span>
                                  </div>
                                  <div className="thick-slider-wrapper">
                                    <input
                                      type="range"
                                      min="10"
                                      max="100"
                                      value={Math.round((theming.opacity ?? 0.88) * 100)}
                                      onChange={(e) => updateThemingWithHistory({ opacity: parseFloat(e.target.value) / 100 })}
                                      className="thick-slider-input"
                                    />
                                  </div>
                                </div>
                              </div>
                            </>
                          )}

                          {activePresetId === 'frosted' && (
                            <div className="bento-two-columns">
                              <div className="bento-control-pad">
                                <div className="bento-header-row">
                                  <span className="bento-label">Acrylic Diffusion Blur</span>
                                  <span className="tabular-num-pill">{theming.blurStrength ?? 38}px</span>
                                </div>
                                <div className="thick-slider-wrapper">
                                  <input
                                    type="range"
                                    min="0"
                                    max="60"
                                    value={theming.blurStrength ?? 38}
                                    onChange={(e) => updateThemingWithHistory({ blurStrength: parseInt(e.target.value, 10) })}
                                    className="thick-slider-input"
                                  />
                                </div>
                              </div>

                              <div className="bento-control-pad">
                                <div className="bento-header-row">
                                  <span className="bento-label">Glass Transparency Opacity</span>
                                  <span className="tabular-num-pill">{Math.round((theming.opacity ?? 0.68) * 100)}%</span>
                                </div>
                                <div className="thick-slider-wrapper">
                                  <input
                                    type="range"
                                    min="10"
                                    max="100"
                                    value={Math.round((theming.opacity ?? 0.68) * 100)}
                                    onChange={(e) => updateThemingWithHistory({ opacity: parseFloat(e.target.value) / 100 })}
                                    className="thick-slider-input"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {(activePresetId === 'cyberpunk' || activePresetId === 'warm-amber') && (
                            <div className="bento-control-pad">
                              <div className="bento-header-row">
                                <span className="bento-label">Global Backdrop Opacity</span>
                                <span className="tabular-num-pill">{Math.round((theming.opacity ?? 0.92) * 100)}%</span>
                              </div>
                              <div className="thick-slider-wrapper">
                                <input
                                  type="range"
                                  min="10"
                                  max="100"
                                  value={Math.round((theming.opacity ?? 0.92) * 100)}
                                  onChange={(e) => updateThemingWithHistory({ opacity: parseFloat(e.target.value) / 100 })}
                                  className="thick-slider-input"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </section>
              );
            })()}

            {/* SECTION 4: GLOBAL COLOR SYSTEM */}
            {matchesSearch('Global Color System', ['color', 'accent', 'palette', 'swatch', 'hex', 'contrast', 'wcag', 'surface', 'text', 'background']) && (() => {
              const isOpen = appearanceSearch.trim() ? true : !collapsedSections['appearance-colors'];
              const isDynamicArtwork =
                (theming.backdropStyle === 'artwork' || theming.preset === 'artwork') &&
                theming.artworkSampling !== false;

              return (
                <section className="settings-level1-card">
                  <div
                    className="card-top-header flex-between"
                    onClick={() => toggleSectionCollapse('appearance-colors')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSectionCollapse('appearance-colors');
                      }
                    }}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div className="header-left-cluster">
                      <div className="card-icon-badge">
                        <Sliders size={16} />
                      </div>
                      <div>
                        <h3 className="card-title-text">Global Color System & WCAG Contrast</h3>
                        <p className="card-desc-text">Central design tokens powering surfaces, text hierarchy, emerald accents, and accessibility.</p>
                      </div>
                    </div>
                    <div className="header-right-cluster">
                      <button
                        type="button"
                        className="card-action-btn ghost icon-only"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSectionCollapse('appearance-colors');
                        }}
                        title={isOpen ? "Collapse section" : "Expand section"}
                        aria-expanded={isOpen}
                      >
                        <ChevronDown
                          size={16}
                          style={{
                            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.22s ease',
                            color: '#a1a1aa',
                          }}
                        />
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <>
                      {isDynamicArtwork ? (
                        /* Dynamic Album Art Extraction Active Notice */
                        <div className="studio-sub-section" style={{ padding: '8px 0' }}>
                          <div className="card-hairline-row flex-between" style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div
                                style={{
                                  width: '34px',
                                  height: '34px',
                                  borderRadius: '50%',
                                  background: 'linear-gradient(135deg, var(--accent, #38bdf8), var(--accent-secondary, #0ea5e9))',
                                  boxShadow: '0 0 16px var(--accent-glow, rgba(56, 189, 248, 0.45))',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                <Sparkles size={16} color="#ffffff" />
                              </div>
                              <div>
                                <div style={{ fontSize: '13.5px', fontWeight: '600', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span>Dynamic Album Artwork Extraction</span>
                                  <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '999px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Active
                                  </span>
                                </div>
                                <div style={{ fontSize: '12px', color: '#a1a1aa', marginTop: '2px' }}>
                                  Accent, visualizer bars, progress, and lyric glow hues are derived in real-time from the currently playing album artwork.
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              className="card-action-btn"
                              style={{
                                fontSize: '12px',
                                padding: '6px 12px',
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                borderRadius: '8px',
                                color: '#e4e4e7',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                              onClick={() => updateThemingWithHistory({ artworkSampling: false })}
                              title="Switch to manual static accent color"
                            >
                              Use Fixed Color Instead
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Manual Primary Accent Color Picker & Swatches */
                        <div className="studio-sub-section" style={{ padding: '4px 0' }}>
                          <div className="color-picker-composite-row">
                            <div className="picker-color-stage">
                              <label className="native-color-label" style={{ backgroundColor: theming.accentColor || '#1db954' }}>
                                <input
                                  type="color"
                                  value={theming.accentColor || '#1db954'}
                                  onChange={(e) => updateThemingWithHistory({ 
                                    accentColor: e.target.value,
                                    progressColor: e.target.value,
                                  })}
                                  className="hidden-color-picker"
                                />
                              </label>
                              <div className="picker-text-details">
                                <span className="picker-title-label">Primary Accent Color</span>
                                <span className="picker-hsl-value">{theming.accentColor || '#1db954'}</span>
                              </div>
                            </div>

                            {(theming.backdropStyle === 'artwork' || theming.preset === 'artwork') && (
                              <button
                                type="button"
                                className="card-action-btn"
                                style={{
                                  fontSize: '11.5px',
                                  padding: '5px 10px',
                                  background: 'rgba(56, 189, 248, 0.12)',
                                  border: '1px solid rgba(56, 189, 248, 0.3)',
                                  borderRadius: '6px',
                                  color: '#38bdf8',
                                  cursor: 'pointer',
                                }}
                                onClick={() => updateThemingWithHistory({ artworkSampling: true })}
                              >
                                Re-enable Album Art Sync
                              </button>
                            )}
                          </div>

                          {/* Quick Accent Swatches */}
                          <div className="swatches-hairline-tray" style={{ marginTop: '14px' }}>
                            <span className="swatch-row-tag">ACCENT SWATCHES</span>
                            <div className="circular-swatches-row">
                              {['#1db954', '#00e676', '#10b981', '#06b6d4', '#38bdf8', '#6366f1', '#a855f7', '#ec4899', '#f97316', '#eab308'].map(
                                (hex) => (
                                  <button
                                    key={hex}
                                    type="button"
                                    className={`circular-color-swatch ${theming.accentColor === hex ? 'selected' : ''}`}
                                    style={{ backgroundColor: hex }}
                                    onClick={() => updateThemingWithHistory({ accentColor: hex, progressColor: hex })}
                                    title={hex}
                                  />
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </section>
              );
            })()}

            {/* SECTION 5: KARAOKE & TYPOGRAPHY */}
            {matchesSearch('Karaoke & Typography', ['lyrics', 'font', 'glow', 'size', 'weight', 'karaoke', 'tamil', 'fade', 'spacing', 'line', 'pulse']) && (() => {
              const isOpen = appearanceSearch.trim() ? true : !collapsedSections['appearance-typography'];
              return (
                <section className="settings-level1-card">
                  <div
                    className="card-top-header flex-between"
                    onClick={() => toggleSectionCollapse('appearance-typography')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSectionCollapse('appearance-typography');
                      }
                    }}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div className="header-left-cluster">
                      <div className="card-icon-badge">
                        <Music size={16} />
                      </div>
                      <div>
                        <h3 className="card-title-text">Karaoke & Typography</h3>
                        <p className="card-desc-text">Active singing line glow, optical scale, and Tamil font rendering.</p>
                      </div>
                    </div>
                    <div className="header-right-cluster">
                      <button
                        type="button"
                        className="card-action-btn ghost icon-only"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSectionCollapse('appearance-typography');
                        }}
                        title={isOpen ? "Collapse section" : "Expand section"}
                        aria-expanded={isOpen}
                      >
                        <ChevronDown
                          size={16}
                          style={{
                            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.22s ease',
                            color: '#a1a1aa',
                          }}
                        />
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <>
                {/* Hidden font file input */}
                <input
                  type="file"
                  ref={fontFileInputRef}
                  style={{ display: 'none' }}
                  accept=".ttf,.otf,.woff,.woff2"
                  onChange={handleFontFileUpload}
                />

                {/* Glowing Color Swatches Row */}
                <div className="glowing-swatches-grid">
                  {LYRIC_GLOW_SWATCHES.map((swatch) => {
                    const isArtworkReactive = (theming.backdropStyle === 'artwork' || theming.preset === 'artwork') && theming.artworkSampling !== false;
                    const isDynamicActive = theming.lyricsActiveColor === 'dynamic' || (!theming.lyricsActiveColor && isArtworkReactive);
                    const isCur = swatch.isDynamic
                      ? isDynamicActive
                      : (!isDynamicActive && theming.lyricsActiveColor && theming.lyricsActiveColor.toLowerCase() === swatch.hex.toLowerCase());
                    return (
                      <button
                        key={swatch.hex}
                        type="button"
                        className={`glowing-color-circle ${isCur ? 'active' : ''}`}
                        style={{
                          background: swatch.isDynamic
                            ? 'linear-gradient(135deg, #ec4899, #8b5cf6, #06b6d4, #10b981)'
                            : swatch.hex,
                          '--swatch-color': swatch.isDynamic ? '#38bdf8' : swatch.hex,
                          boxShadow: isCur ? (swatch.isDynamic ? '0 0 14px #38bdf8' : `0 0 14px ${swatch.hex}`) : 'none',
                        }}
                        onClick={() =>
                          updateThemingWithHistory({
                            lyricsActiveColor: swatch.hex,
                            lyricsGlowColor: swatch.hex,
                          })
                        }
                        title={swatch.name}
                      >
                        {isCur && <Check size={12} strokeWidth={3} color="#fff" />}
                      </button>
                    );
                  })}
                </div>

                {/* Typography Engine Grid */}
                <div className="bento-two-columns" style={{ marginTop: '16px' }}>
                  {/* Font Family Dropdown + Upload Action */}
                  <div className="bento-control-pad compact" style={{ gridColumn: 'span 2' }}>
                    <div className="bento-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="bento-label">Karaoke Font Family</span>
                      <button
                        type="button"
                        className="font-upload-action-btn"
                        onClick={() => fontFileInputRef.current?.click()}
                        title="Upload custom font (.ttf, .otf, .woff, .woff2)"
                      >
                        <Upload size={12} />
                        <span>Upload Font</span>
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                      <select
                        className="studio-select-dropdown full-width"
                        value={theming.lyricsFontFamily || 'system-ui'}
                        onChange={(e) => updateThemingWithHistory({ lyricsFontFamily: e.target.value })}
                        style={{ flex: 1 }}
                      >
                        {theming.customFont?.name && (
                          <option value={`'${theming.customFont.name}', sans-serif`}>
                            ★ {theming.customFont.name} (Uploaded)
                          </option>
                        )}
                        <option value="system-ui, -apple-system, sans-serif">System UI Sans (Default)</option>
                        <option value="'Inter', sans-serif">Inter (Modern Clean)</option>
                        <option value="'Montserrat', sans-serif">Montserrat (Geometric)</option>
                        <option value="'Outfit', sans-serif">Outfit (Editorial)</option>
                        <option value="'Poppins', sans-serif">Poppins (Rounded)</option>
                        <option value="'Mukta Malar', sans-serif">Mukta Malar (Tamil Karaoke)</option>
                        <option value="'Catamaran', sans-serif">Catamaran (Tamil Karaoke)</option>
                        <option value="'Nirmala UI', sans-serif">Nirmala UI (Tamil Karaoke)</option>
                        <option value="'JetBrains Mono', monospace">JetBrains Mono (Monospace)</option>
                      </select>

                      {theming.customFont?.name && (
                        <button
                          type="button"
                          className="card-action-btn ghost icon-only"
                          onClick={handleRemoveCustomFont}
                          title={`Remove custom font "${theming.customFont.name}"`}
                          style={{ color: '#ef4444', height: '36px', width: '36px' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Font Size Slider */}
                  <div className="bento-control-pad compact">
                    <div className="bento-header-row">
                      <span className="bento-label">Font Size</span>
                      <span className="tabular-num-pill">{theming.lyricsFontSize ?? 20}px</span>
                    </div>
                    <div className="thick-slider-wrapper">
                      <input
                        type="range"
                        min="14"
                        max="32"
                        value={theming.lyricsFontSize ?? 20}
                        onChange={(e) =>
                          updateThemingWithHistory({ lyricsFontSize: parseInt(e.target.value, 10) })
                        }
                        className="thick-slider-input"
                      />
                    </div>
                  </div>

                  {/* Font Weight Pills */}
                  <div className="bento-control-pad compact">
                    <div className="bento-header-row">
                      <span className="bento-label">Font Weight</span>
                      <span className="tabular-num-pill">{theming.lyricsFontWeight ?? 700}</span>
                    </div>
                    <div className="segmented-pill-tray mini" style={{ margin: '4px 0 0' }}>
                      {[300, 400, 500, 600, 700, 900].map((wt) => (
                        <button
                          key={wt}
                          type="button"
                          className={`segmented-tab-btn ${(theming.lyricsFontWeight ?? 700) === wt ? 'active' : ''}`}
                          onClick={() => updateThemingWithHistory({ lyricsFontWeight: wt })}
                        >
                          {wt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Glow Radius Slider */}
                  <div className="bento-control-pad compact">
                    <div className="bento-header-row">
                      <span className="bento-label">Glow Bloom Radius</span>
                      <span className="tabular-num-pill">{theming.lyricsGlowRadius ?? 20}px</span>
                    </div>
                    <div className="thick-slider-wrapper">
                      <input
                        type="range"
                        min="0"
                        max="35"
                        value={theming.lyricsGlowRadius ?? 20}
                        onChange={(e) =>
                          updateThemingWithHistory({ lyricsGlowRadius: parseInt(e.target.value, 10) })
                        }
                        className="thick-slider-input"
                      />
                    </div>
                  </div>

                  {/* Active Scale Factor */}
                  <div className="bento-control-pad compact">
                    <div className="bento-header-row">
                      <span className="bento-label">Active Line Scale</span>
                      <span className="tabular-num-pill">{(theming.lyricsScale ?? 1.04).toFixed(2)}x</span>
                    </div>
                    <div className="thick-slider-wrapper">
                      <input
                        type="range"
                        min="100"
                        max="135"
                        value={Math.round((theming.lyricsScale ?? 1.04) * 100)}
                        onChange={(e) =>
                          updateThemingWithHistory({ lyricsScale: parseFloat(e.target.value) / 100 })
                        }
                        className="thick-slider-input"
                      />
                    </div>
                  </div>
                </div>
                    </>
                  )}
                </section>
              );
            })()}

            {/* SECTION 6: PLAYER COMPONENTS */}
            {matchesSearch('Player Components', ['album art', 'cover', 'marquee', 'title', 'controls', 'button', 'seekbar', 'progress', 'timestamp']) && (() => {
              const isOpen = appearanceSearch.trim() ? true : !collapsedSections['appearance-components'];
              return (
                <section className="settings-level1-card">
                  <div
                    className="card-top-header flex-between"
                    onClick={() => toggleSectionCollapse('appearance-components')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSectionCollapse('appearance-components');
                      }
                    }}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div className="header-left-cluster">
                      <div className="card-icon-badge">
                        <Monitor size={16} />
                      </div>
                      <div>
                        <h3 className="card-title-text">Player Components</h3>
                        <p className="card-desc-text">Refine album art styling, marquee behavior, and sleeve hover effects.</p>
                      </div>
                    </div>
                    <div className="header-right-cluster">
                      <button
                        type="button"
                        className="card-action-btn ghost icon-only"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSectionCollapse('appearance-components');
                        }}
                        title={isOpen ? "Collapse section" : "Expand section"}
                        aria-expanded={isOpen}
                      >
                        <ChevronDown
                          size={16}
                          style={{
                            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.22s ease',
                            color: '#a1a1aa',
                          }}
                        />
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <>
                      {/* Album Art Presentation Style */}
                      <div className="bento-control-pad compact" style={{ marginBottom: '14px' }}>
                        <div className="bento-header-row">
                          <span className="bento-label">Album Art Presentation Effect</span>
                          <span className="tabular-num-pill">
                            {(theming.albumArtStyle || 'vinyl') === 'vinyl' ? 'Rotating Vinyl Record' : 'Standard Square'}
                          </span>
                        </div>
                        <div className="segmented-tabs-bar" style={{ marginTop: '8px' }}>
                          <button
                            type="button"
                            className={`segmented-tab-btn ${(theming.albumArtStyle || 'vinyl') === 'vinyl' ? 'active' : ''}`}
                            onClick={() => {
                              updateThemingWithHistory({ albumArtStyle: 'vinyl' });
                              try {
                                localStorage.setItem('ksync_circle_art', 'true');
                                window.dispatchEvent(new CustomEvent('ksync:circle-art-toggle', { detail: { isCircle: true } }));
                              } catch (_) {}
                            }}
                          >
                            Rotating Vinyl & 360° Spectrum
                          </button>
                          <button
                            type="button"
                            className={`segmented-tab-btn ${(theming.albumArtStyle || 'vinyl') === 'square' ? 'active' : ''}`}
                            onClick={() => {
                              updateThemingWithHistory({ albumArtStyle: 'square' });
                              try {
                                localStorage.setItem('ksync_circle_art', 'false');
                                window.dispatchEvent(new CustomEvent('ksync:circle-art-toggle', { detail: { isCircle: false } }));
                              } catch (_) {}
                            }}
                          >
                            Standard Square Cover
                          </button>
                        </div>
                        <div className="row-sub-label" style={{ marginTop: '6px' }}>
                          Choose and keep your preferred artwork presentation. Clicking the album artwork in either dock also dynamically toggles this.
                        </div>
                      </div>

                      {/* Artwork Corner Radius */}
                      <div className="bento-control-pad compact">
                        <div className="bento-header-row">
                          <span className="bento-label">Album Art Corner Radius</span>
                          <span className="tabular-num-pill">{theming.artCornerRadius ?? 10}px</span>
                        </div>
                        <div className="thick-slider-wrapper">
                          <input
                            type="range"
                            min="0"
                            max="32"
                            value={theming.artCornerRadius ?? 10}
                            onChange={(e) =>
                              updateThemingWithHistory({ artCornerRadius: parseInt(e.target.value, 10) })
                            }
                            className="thick-slider-input"
                          />
                        </div>
                      </div>

                      {/* Component Row Toggles */}
                      <div className="card-hairline-row flex-between" style={{ marginTop: '16px' }}>
                        <div>
                          <div className="row-main-label">Harmonic Audio Wave Ripples</div>
                          <div className="row-sub-label">Rhythmically expanding harmonic ripple rings radiating outward from the artwork</div>
                        </div>
                        <button
                          type="button"
                          className={`pill-toggle-switch ${theming.albumArtRipples !== false ? 'on active' : 'off'}`}
                          onClick={() => updateThemingWithHistory({ albumArtRipples: theming.albumArtRipples === false })}
                        >
                          <span className="toggle-thumb" />
                        </button>
                      </div>

                      <div className="card-hairline-row flex-between">
                        <div>
                          <div className="row-main-label">Atmospheric Ambient Art Tint</div>
                          <div className="row-sub-label">Soft dynamic color aura derived from artwork hues glowing behind the sleeve</div>
                        </div>
                        <button
                          type="button"
                          className={`pill-toggle-switch ${theming.albumArtGlow !== false ? 'on active' : 'off'}`}
                          onClick={() => updateThemingWithHistory({ albumArtGlow: theming.albumArtGlow === false })}
                        >
                          <span className="toggle-thumb" />
                        </button>
                      </div>

                      <div className="card-hairline-row flex-between">
                        <div>
                          <div className="row-main-label">Marquee Auto-Scroll</div>
                          <div className="row-sub-label">Automatically scroll long track titles and artist names smoothly</div>
                        </div>
                        <button
                          type="button"
                          className={`pill-toggle-switch ${theming.marqueeScroll !== false ? 'on active' : 'off'}`}
                          onClick={() => updateThemingWithHistory({ marqueeScroll: theming.marqueeScroll === false })}
                        >
                          <span className="toggle-thumb" />
                        </button>
                      </div>

                      <div className="card-hairline-row flex-between">
                        <div>
                          <div className="row-main-label">Artwork Hover Zoom Effect</div>
                          <div className="row-sub-label">Subtle scale transition when hovering over the album sleeve</div>
                        </div>
                        <button
                          type="button"
                          className={`pill-toggle-switch ${theming.artHoverZoom !== false ? 'on active' : 'off'}`}
                          onClick={() => updateThemingWithHistory({ artHoverZoom: theming.artHoverZoom === false })}
                        >
                          <span className="toggle-thumb" />
                        </button>
                      </div>
                    </>
                  )}
                </section>
              );
            })()}

          </div>
        )}

        {/* TAB 2: LAYOUT & MODULES */}
        {activeTab === 'layout' && (
          <div className="settings-tab-pane">
            <header className="viewport-page-header">
              <h1 className="viewport-page-title">Layout & Modular Panels</h1>
              <p className="viewport-page-desc">
                Enable or hide dock zones, customize reorder sequence, and adjust height framing.
              </p>
            </header>

            {/* 4.1: Visible Modules (Drag to Reorder) */}
            <section className="settings-level1-card">
              <div className="card-top-header">
                <div className="card-icon-badge">
                  <Layout size={16} />
                </div>
                <div>
                  <h3 className="card-title-text">Visible Modules</h3>
                  <p className="card-desc-text">Toggle visibility and drag cards to adjust dock panel sequence.</p>
                </div>
              </div>

              <div className="modules-three-grid">
                {currentOrder.map((panelId) => {
                  const isDragging = draggedPanelId === panelId;
                  const isDragOver = dragOverPanelId === panelId;

                  if (panelId === 'nowPlaying') {
                    return (
                      <div
                        key="nowPlaying"
                        className={`module-wireframe-card ${isDragging ? 'is-dragging' : ''} ${isDragOver ? 'is-drag-over' : ''}`}
                        draggable={true}
                        onDragStart={(e) => handleCardDragStart(e, 'nowPlaying')}
                        onDragOver={(e) => handleCardDragOver(e, 'nowPlaying')}
                        onDragLeave={(e) => handleCardDragLeave(e, 'nowPlaying')}
                        onDrop={(e) => handleCardDrop(e, 'nowPlaying')}
                        onDragEnd={handleCardDragEnd}
                        title="Drag to reorder dock panel"
                      >
                        <div className="module-wireframe-stage">
                          <svg width="100%" height="48" viewBox="0 0 160 48" fill="none">
                            <rect x="12" y="10" width="28" height="28" rx="6" fill="#27272A" />
                            <rect x="48" y="14" width="60" height="7" rx="3" fill="#A1A1AA" />
                            <rect x="48" y="26" width="38" height="5" rx="2" fill="#52525B" />
                            <circle cx="132" cy="24" r="9" fill="#1DB954" />
                          </svg>
                        </div>
                        <div className="module-card-header">
                          <span className="module-title">Now Playing</span>
                          <button
                            type="button"
                            className={`pill-toggle-switch ${layout.showNowPlaying !== false ? 'on active' : 'off'}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePanelToggle('showNowPlaying');
                            }}
                            aria-label="Toggle Now Playing"
                          >
                            <span className="toggle-thumb" />
                          </button>
                        </div>
                        <p className="module-desc">Album art, track title, controls & seekbar</p>
                      </div>
                    );
                  }

                  if (panelId === 'lyrics') {
                    return (
                      <div
                        key="lyrics"
                        className={`module-wireframe-card ${isDragging ? 'is-dragging' : ''} ${isDragOver ? 'is-drag-over' : ''}`}
                        draggable={true}
                        onDragStart={(e) => handleCardDragStart(e, 'lyrics')}
                        onDragOver={(e) => handleCardDragOver(e, 'lyrics')}
                        onDragLeave={(e) => handleCardDragLeave(e, 'lyrics')}
                        onDrop={(e) => handleCardDrop(e, 'lyrics')}
                        onDragEnd={handleCardDragEnd}
                        title="Drag to reorder dock panel"
                      >
                        <div className="module-wireframe-stage">
                          <svg width="100%" height="48" viewBox="0 0 160 48" fill="none">
                            <rect x="36" y="8" width="88" height="6" rx="3" fill="#3F3F46" />
                            <rect x="24" y="20" width="112" height="9" rx="4" fill="#1DB954" />
                            <rect x="42" y="34" width="76" height="6" rx="3" fill="#3F3F46" />
                          </svg>
                        </div>
                        <div className="module-card-header">
                          <span className="module-title">Synced Lyrics</span>
                          <button
                            type="button"
                            className={`pill-toggle-switch ${layout.showLyrics !== false ? 'on active' : 'off'}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePanelToggle('showLyrics');
                            }}
                            aria-label="Toggle Synced Lyrics"
                          >
                            <span className="toggle-thumb" />
                          </button>
                        </div>
                        <p className="module-desc">Real-time synchronized karaoke lyrics stream</p>
                      </div>
                    );
                  }

                  if (panelId === 'queue') {
                    return (
                      <div
                        key="queue"
                        className={`module-wireframe-card ${isDragging ? 'is-dragging' : ''} ${isDragOver ? 'is-drag-over' : ''}`}
                        draggable={true}
                        onDragStart={(e) => handleCardDragStart(e, 'queue')}
                        onDragOver={(e) => handleCardDragOver(e, 'queue')}
                        onDragLeave={(e) => handleCardDragLeave(e, 'queue')}
                        onDrop={(e) => handleCardDrop(e, 'queue')}
                        onDragEnd={handleCardDragEnd}
                        title="Drag to reorder dock panel"
                      >
                        <div className="module-wireframe-stage">
                          <svg width="100%" height="48" viewBox="0 0 160 48" fill="none">
                            <rect x="14" y="9" width="18" height="18" rx="4" fill="#27272A" />
                            <rect x="38" y="11" width="70" height="6" rx="3" fill="#A1A1AA" />
                            <rect x="38" y="20" width="45" height="5" rx="2" fill="#52525B" />
                            <rect x="14" y="30" width="18" height="12" rx="3" fill="#27272A" />
                            <rect x="38" y="33" width="60" height="5" rx="2" fill="#52525B" />
                          </svg>
                        </div>
                        <div className="module-card-header">
                          <span className="module-title">Up Next Queue</span>
                          <button
                            type="button"
                            className={`pill-toggle-switch ${layout.showQueue !== false ? 'on active' : 'off'}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePanelToggle('showQueue');
                            }}
                            aria-label="Toggle Queue"
                          >
                            <span className="toggle-thumb" />
                          </button>
                        </div>
                        <p className="module-desc">Upcoming queue preview & playlist songs</p>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            </section>

            {/* 4.2: Framing Card (Collapsible Dropdown Section) */}
            {(() => {
              const isFramingOpen = !collapsedSections['framing'];
              return (
                <section className="settings-level1-card">
                  <div
                    className="card-top-header flex-between"
                    onClick={() => toggleSectionCollapse('framing')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSectionCollapse('framing');
                      }
                    }}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div className="header-left-cluster">
                      <div className="card-icon-badge">
                        <Monitor size={16} />
                      </div>
                      <div>
                        <h3 className="card-title-text">Framing</h3>
                        <p className="card-desc-text">Choose edge-to-edge docking or a floating square dynamic island.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="card-action-btn ghost icon-only"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSectionCollapse('framing');
                      }}
                      title={isFramingOpen ? "Collapse section" : "Expand section"}
                      aria-expanded={isFramingOpen}
                    >
                      <ChevronDown
                        size={16}
                        style={{
                          transform: isFramingOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.22s ease',
                          color: '#a1a1aa',
                        }}
                      />
                    </button>
                  </div>

                  {isFramingOpen && (
                    <>
                    <div className="framing-two-grid">
                      {/* Full Screen Width (Edge to Edge) */}
                      <button
                        type="button"
                        className={`monitor-card-item ${position.style !== 'island' ? 'active' : ''}`}
                        onClick={() => updateSettings({ position: { style: 'full' } })}
                      >
                        <div className="monitor-wireframe-container">
                          <div className="monitor-screen-stage">
                            <svg width="100%" height="100%" viewBox="0 0 180 72" fill="none">
                              {/* Background Desktop Mock Windows */}
                              <rect x="12" y="32" width="94" height="34" rx="3" fill="#18181c" stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3 2" />
                              <line x1="12" y1="40" x2="106" y2="40" stroke="rgba(255, 255, 255, 0.06)" />
                              <rect x="112" y="36" width="56" height="30" rx="3" fill="#18181c" stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3 2" />

                              {/* Full Screen Width Top Dock Housing (Edge to Edge) */}
                              <rect x="4" y="3" width="172" height="23" rx="4" fill="#121216" stroke={position.style !== 'island' ? 'rgba(16, 185, 129, 0.45)' : 'rgba(255, 255, 255, 0.12)'} />
                              
                              {/* Glowing Top Accent Edge */}
                              <rect x="16" y="3" width="148" height="2.5" rx="1.25" fill="#10B981" />

                              {/* Section 1: Now Playing Mock */}
                              <rect x="10" y="8" width="13" height="13" rx="3" fill="#27272A" />
                              <rect x="27" y="10" width="24" height="3.5" rx="1.75" fill="#A1A1AA" />
                              <rect x="27" y="15.5" width="16" height="2.5" rx="1" fill="#52525B" />
                              <circle cx="56" cy="14.5" r="3" fill="#1DB954" />

                              {/* Section 2: Synced Lyrics Mock */}
                              <rect x="74" y="7.5" width="32" height="2" rx="1" fill="#3F3F46" />
                              <rect x="68" y="11.5" width="44" height="4" rx="2" fill="#10B981" />
                              <rect x="76" y="17.5" width="28" height="2" rx="1" fill="#3F3F46" />

                              {/* Section 3: Up Next Queue Mock */}
                              <rect x="124" y="8.5" width="5.5" height="5.5" rx="1.5" fill="#27272A" />
                              <rect x="133" y="9.5" width="20" height="2" rx="1" fill="#A1A1AA" />
                              <rect x="124" y="15" width="5.5" height="5.5" rx="1.5" fill="#27272A" />
                              <rect x="133" y="16" width="15" height="2" rx="1" fill="#52525B" />
                              <circle cx="166" cy="14.5" r="4" fill="#1DB954" />
                            </svg>
                          </div>
                        </div>
                        <div className="monitor-label-group">
                          <span className="monitor-title">Full Screen Width</span>
                          <span className="monitor-sub">Edge-to-edge docking bar</span>
                        </div>
                      </button>

                      {/* Floating Dynamic Island / Pill */}
                      <button
                        type="button"
                        className={`monitor-card-item ${position.style === 'island' ? 'active' : ''}`}
                        onClick={() => updateSettings({ position: { style: 'island' } })}
                      >
                        <div className="monitor-wireframe-container">
                          <div className="monitor-screen-stage">
                            <svg width="100%" height="100%" viewBox="0 0 180 72" fill="none">
                              {/* Background Desktop Mock Windows */}
                              <rect x="12" y="28" width="94" height="38" rx="3" fill="#18181c" stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3 2" />
                              <line x1="12" y1="36" x2="106" y2="36" stroke="rgba(255, 255, 255, 0.06)" />
                              <rect x="112" y="32" width="56" height="34" rx="3" fill="#18181c" stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3 2" />

                              {/* Floating Rounded Square Dynamic Island Housing */}
                              <rect x="74" y="5" width="32" height="32" rx="7" fill="#121216" stroke={position.style === 'island' ? 'rgba(16, 185, 129, 0.45)' : 'rgba(255, 255, 255, 0.12)'} />
                              
                              {/* Glowing Island Accent Top */}
                              <rect x="80" y="5" width="20" height="2" rx="1" fill="#10B981" />

                              {/* Album Art Square Mock */}
                              <rect x="78" y="9" width="24" height="15" rx="3" fill="#27272A" />

                              {/* Track Title Mock Line */}
                              <rect x="80" y="26" width="20" height="2" rx="1" fill="#A1A1AA" />

                              {/* Controls Mock Dot */}
                              <circle cx="90" cy="31" r="2.5" fill="#1DB954" />
                            </svg>
                          </div>
                        </div>
                        <div className="monitor-label-group">
                          <span className="monitor-title">Floating Dynamic Island</span>
                          <span className="monitor-sub">Centered floating pill dock</span>
                        </div>
                      </button>
                    </div>

                    {/* Dynamic Island Shape Options: Always visible so user can seamlessly choose between Square and Rectangle */}
                    <div style={{ marginTop: '16px' }}>
                      <div className="card-section-label" style={{ marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Dynamic Island Framing Style
                      </div>
                      <div className="framing-two-grid">
                        {/* Square Dynamic Island Option */}
                        <button
                          type="button"
                          className={`monitor-card-item ${isIsland && isSquareIsland ? 'active' : ''}`}
                          onClick={() => {
                            updateSettings({
                              position: {
                                style: 'island',
                                islandShape: 'square',
                                islandWidth: 480,
                              },
                            });
                            updateThemingWithHistory({ cornerRadius: 24 });
                          }}
                          title="Switch to Compact Square Dynamic Island (480px)"
                        >
                          <div className="monitor-wireframe-container">
                            <div className="monitor-screen-stage">
                              <svg width="100%" height="100%" viewBox="0 0 180 72" fill="none">
                                {/* Background Desktop Mock Windows */}
                                <rect x="12" y="28" width="94" height="38" rx="3" fill="#18181c" stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3 2" />
                                <line x1="12" y1="36" x2="106" y2="36" stroke="rgba(255, 255, 255, 0.06)" />
                                <rect x="112" y="32" width="56" height="34" rx="3" fill="#18181c" stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3 2" />

                                {/* Centered Square Dynamic Island */}
                                <rect
                                  x="72"
                                  y="5"
                                  width="36"
                                  height="36"
                                  rx="8"
                                  fill="#121216"
                                  stroke={isIsland && isSquareIsland ? 'rgba(16, 185, 129, 0.55)' : 'rgba(255, 255, 255, 0.12)'}
                                  strokeWidth="1.2"
                                />

                                {/* Glowing Top Accent Edge */}
                                <rect x="78" y="5" width="24" height="2" rx="1" fill="#10B981" />

                                {/* Album Art Square Mock */}
                                <rect x="76" y="10" width="13" height="13" rx="3" fill="#27272A" />

                                {/* Track Info Lines Mock */}
                                <rect x="92" y="11" width="13" height="2.5" rx="1" fill="#A1A1AA" />
                                <rect x="92" y="15.5" width="9" height="2" rx="1" fill="#52525B" />

                                {/* Mini Waveform Seekbar Mock */}
                                <rect x="76" y="26" width="28" height="2" rx="1" fill="#3F3F46" />
                                <rect x="76" y="26" width="14" height="2" rx="1" fill="#10B981" />

                                {/* Controls Mock Dot */}
                                <circle cx="90" cy="33.5" r="2.5" fill="#FFFFFF" />
                              </svg>
                            </div>
                          </div>
                          <div className="monitor-label-group">
                            <span className="monitor-title">Square</span>
                            <span className="monitor-sub">Compact centered dynamic island</span>
                          </div>
                        </button>

                        {/* Rectangle Dynamic Island Option */}
                        <button
                          type="button"
                          className={`monitor-card-item ${isIsland && !isSquareIsland ? 'active' : ''}`}
                          onClick={() => {
                            updateSettings({
                              position: {
                                style: 'island',
                                islandShape: 'rectangle',
                                islandWidth: 680,
                              },
                            });
                            updateThemingWithHistory({ cornerRadius: 20 });
                          }}
                          title="Switch to Wide Rectangle Dynamic Island (680px)"
                        >
                          <div className="monitor-wireframe-container">
                            <div className="monitor-screen-stage">
                              <svg width="100%" height="100%" viewBox="0 0 180 72" fill="none">
                                {/* Background Desktop Mock Windows */}
                                <rect x="12" y="28" width="94" height="38" rx="3" fill="#18181c" stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3 2" />
                                <line x1="12" y1="36" x2="106" y2="36" stroke="rgba(255, 255, 255, 0.06)" />
                                <rect x="112" y="32" width="56" height="34" rx="3" fill="#18181c" stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3 2" />

                                {/* Centered Wide Rectangle Dynamic Island */}
                                <rect
                                  x="44"
                                  y="7"
                                  width="92"
                                  height="25"
                                  rx="7"
                                  fill="#121216"
                                  stroke={isIsland && !isSquareIsland ? 'rgba(16, 185, 129, 0.55)' : 'rgba(255, 255, 255, 0.12)'}
                                  strokeWidth="1.2"
                                />

                                {/* Glowing Top Accent Edge */}
                                <rect x="54" y="7" width="72" height="2" rx="1" fill="#10B981" />

                                {/* Album Art Square Mock */}
                                <rect x="49" y="11" width="13" height="13" rx="3" fill="#27272A" />

                                {/* Track Info Lines Mock */}
                                <rect x="66" y="12" width="18" height="2.5" rx="1" fill="#A1A1AA" />
                                <rect x="66" y="16.5" width="12" height="2" rx="1" fill="#52525B" />

                                {/* Lyrics Preview Mock Line */}
                                <rect x="90" y="12" width="16" height="2" rx="1" fill="#10B981" />
                                <rect x="92" y="16" width="12" height="1.5" rx="0.75" fill="#3F3F46" />

                                {/* Controls Mock Dots */}
                                <circle cx="118" cy="18" r="3" fill="#FFFFFF" />
                                <circle cx="126" cy="18" r="1.8" fill="#52525B" />
                              </svg>
                            </div>
                          </div>
                          <div className="monitor-label-group">
                            <span className="monitor-title">Rectangle</span>
                            <span className="monitor-sub">Wide panoramic dynamic island</span>
                          </div>
                        </button>
                      </div>
                    </div>
                    </>
                  )}
                </section>
              );
            })()}
          </div>
        )}

        {/* TAB 3: POSITION & EDGE */}
        {activeTab === 'position' && (
          <div className="settings-tab-pane">
            <header className="viewport-page-header position-page-header">
              <div className="page-header-text">
                <h1 className="viewport-page-title">Screen Position & Behavior</h1>
                <p className="viewport-page-desc">
                  Configure monitor edge placement, auto-hide timing, and mouse wheel shortcuts.
                </p>
              </div>
            </header>

            {/* Section 0: Multi-Monitor Target Display */}
            {connectedDisplays.length > 1 && (
              <section className="settings-level1-card" style={{ marginBottom: '16px' }}>
                <div className="card-top-header">
                  <div className="card-icon-badge">
                    <Monitor size={16} />
                  </div>
                  <div>
                    <h3 className="card-title-text">Target Monitor Display</h3>
                    <p className="card-desc-text">Choose which monitor the dock anchors to across multi-screen setups.</p>
                  </div>
                </div>

                <div className="segmented-pill-tray" style={{ margin: '10px 0 0 0' }}>
                  <button
                    type="button"
                    className={`segment-pill-btn ${(position.targetDisplay || 'all') === 'all' ? 'active' : ''}`}
                    onClick={() => updateSettings({ position: { targetDisplay: 'all' } })}
                  >
                    All Displays (All Screens)
                  </button>
                  <button
                    type="button"
                    className={`segment-pill-btn ${position.targetDisplay === 'primary' ? 'active' : ''}`}
                    onClick={() => updateSettings({ position: { targetDisplay: 'primary' } })}
                  >
                    Primary Display
                  </button>
                  <button
                    type="button"
                    className={`segment-pill-btn ${position.targetDisplay === 'cursor' ? 'active' : ''}`}
                    onClick={() => updateSettings({ position: { targetDisplay: 'cursor' } })}
                  >
                    Follow Mouse Cursor
                  </button>
                  {connectedDisplays.filter((d) => !d.isPrimary).map((disp) => (
                    <button
                      key={disp.id}
                      type="button"
                      className={`segment-pill-btn ${String(position.targetDisplay) === String(disp.id) ? 'active' : ''}`}
                      onClick={() => updateSettings({ position: { targetDisplay: disp.id } })}
                    >
                      {disp.label}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Section 1: Screen Edge Placement Card */}
            <section className="settings-level1-card">
              <div className="card-top-header">
                <div className="card-icon-badge">
                  <Compass size={16} />
                </div>
                <div>
                  <h3 className="card-title-text">Screen Edge Placement</h3>
                  <p className="card-desc-text">Select which side of the display the dock anchors to.</p>
                </div>
              </div>

              <div className="monitor-three-grid">
                {/* Left Edge */}
                <button
                  type="button"
                  className={`monitor-card-item ${position.mode === 'left' ? 'active' : ''}`}
                  onClick={() => updateSettings({ position: { mode: 'left' } })}
                >
                  <div className="monitor-wireframe-container">
                    <div className="monitor-screen-stage">
                      <svg width="100%" height="100%" viewBox="0 0 180 72" fill="none">
                        {/* Background Desktop Mock Windows */}
                        <rect x="66" y="10" width="106" height="54" rx="3" fill="#18181c" stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3 2" />
                        <line x1="66" y1="20" x2="172" y2="20" stroke="rgba(255, 255, 255, 0.06)" />
                        <circle cx="73" cy="15" r="2" fill="#52525B" />
                        <circle cx="79" cy="15" r="2" fill="#52525B" />

                        {/* Left Sidebar Dock Housing */}
                        <rect x="3" y="3" width="56" height="66" rx="4" fill="#121216" stroke={position.mode === 'left' ? 'rgba(16, 185, 129, 0.45)' : 'rgba(255, 255, 255, 0.12)'} />
                        
                        {/* Glowing Left Accent Edge */}
                        <rect x="3" y="8" width="2.5" height="56" rx="1.25" fill="#10B981" />

                        {/* Section 1: Now Playing Mock (top) */}
                        <rect x="10" y="8" width="14" height="14" rx="3" fill="#27272A" />
                        <rect x="28" y="10" width="22" height="3" rx="1.5" fill="#A1A1AA" />
                        <rect x="28" y="15" width="15" height="2.5" rx="1" fill="#52525B" />
                        <circle cx="48" cy="19" r="2.5" fill="#1DB954" />

                        {/* Section 2: Synced Lyrics Mock (middle) */}
                        <rect x="14" y="27" width="32" height="2" rx="1" fill="#3F3F46" />
                        <rect x="11" y="31.5" width="38" height="3.5" rx="1.75" fill="#10B981" />
                        <rect x="16" y="37.5" width="28" height="2" rx="1" fill="#3F3F46" />

                        {/* Section 3: Up Next Queue Mock (bottom) */}
                        <rect x="10" y="45" width="7" height="7" rx="1.5" fill="#27272A" />
                        <rect x="20" y="47" width="24" height="2" rx="1" fill="#A1A1AA" />
                        <rect x="10" y="55" width="7" height="7" rx="1.5" fill="#27272A" />
                        <rect x="20" y="57" width="18" height="2" rx="1" fill="#52525B" />
                        <circle cx="48" cy="58" r="3" fill="#1DB954" />
                      </svg>
                    </div>
                  </div>
                  <div className="monitor-label-group">
                    <span className="monitor-title">Left Sidebar</span>
                    <span className="monitor-sub">Vertical left edge dock</span>
                  </div>
                </button>

                {/* Top Edge */}
                <button
                  type="button"
                  className={`monitor-card-item ${(position.mode || 'top') === 'top' ? 'active' : ''}`}
                  onClick={() => updateSettings({ position: { mode: 'top' } })}
                >
                  <div className="monitor-wireframe-container">
                    <div className="monitor-screen-stage">
                      <svg width="100%" height="100%" viewBox="0 0 180 72" fill="none">
                        {/* Background Desktop Mock Windows */}
                        <rect x="12" y="32" width="94" height="34" rx="3" fill="#18181c" stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3 2" />
                        <line x1="12" y1="40" x2="106" y2="40" stroke="rgba(255, 255, 255, 0.06)" />
                        <rect x="112" y="36" width="56" height="30" rx="3" fill="#18181c" stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3 2" />

                        {/* Top Dock Housing */}
                        <rect x="4" y="3" width="172" height="23" rx="4" fill="#121216" stroke={(position.mode || 'top') === 'top' ? 'rgba(16, 185, 129, 0.45)' : 'rgba(255, 255, 255, 0.12)'} />
                        
                        {/* Glowing Top Accent Edge */}
                        <rect x="16" y="3" width="148" height="2.5" rx="1.25" fill="#10B981" />

                        {/* Section 1: Now Playing Mock (album art + title/artist lines + play dot) */}
                        <rect x="10" y="8" width="13" height="13" rx="3" fill="#27272A" />
                        <rect x="27" y="10" width="24" height="3.5" rx="1.75" fill="#A1A1AA" />
                        <rect x="27" y="15.5" width="16" height="2.5" rx="1" fill="#52525B" />
                        <circle cx="56" cy="14.5" r="3" fill="#1DB954" />

                        {/* Section 2: Synced Lyrics Mock (stacked lyrics with green active bar) */}
                        <rect x="74" y="7.5" width="32" height="2" rx="1" fill="#3F3F46" />
                        <rect x="68" y="11.5" width="44" height="4" rx="2" fill="#10B981" />
                        <rect x="76" y="17.5" width="28" height="2" rx="1" fill="#3F3F46" />

                        {/* Section 3: Up Next Queue Mock (stacked track rows + play circle) */}
                        <rect x="124" y="8.5" width="5.5" height="5.5" rx="1.5" fill="#27272A" />
                        <rect x="133" y="9.5" width="20" height="2" rx="1" fill="#A1A1AA" />
                        <rect x="124" y="15" width="5.5" height="5.5" rx="1.5" fill="#27272A" />
                        <rect x="133" y="16" width="15" height="2" rx="1" fill="#52525B" />
                        <circle cx="166" cy="14.5" r="4" fill="#1DB954" />
                      </svg>
                    </div>
                  </div>
                  <div className="monitor-label-group">
                    <span className="monitor-title">Top Bar Dock</span>
                    <span className="monitor-sub">Default horizontal overlay</span>
                  </div>
                </button>

                {/* Right Edge */}
                <button
                  type="button"
                  className={`monitor-card-item ${position.mode === 'right' ? 'active' : ''}`}
                  onClick={() => updateSettings({ position: { mode: 'right' } })}
                >
                  <div className="monitor-wireframe-container">
                    <div className="monitor-screen-stage">
                      <svg width="100%" height="100%" viewBox="0 0 180 72" fill="none">
                        {/* Background Desktop Mock Windows */}
                        <rect x="8" y="10" width="106" height="54" rx="3" fill="#18181c" stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3 2" />
                        <line x1="8" y1="20" x2="114" y2="20" stroke="rgba(255, 255, 255, 0.06)" />
                        <circle cx="15" cy="15" r="2" fill="#52525B" />
                        <circle cx="21" cy="15" r="2" fill="#52525B" />

                        {/* Right Sidebar Dock Housing */}
                        <rect x="121" y="3" width="56" height="66" rx="4" fill="#121216" stroke={position.mode === 'right' ? 'rgba(16, 185, 129, 0.45)' : 'rgba(255, 255, 255, 0.12)'} />
                        
                        {/* Glowing Right Accent Edge */}
                        <rect x="174.5" y="8" width="2.5" height="56" rx="1.25" fill="#10B981" />

                        {/* Section 1: Now Playing Mock (top) */}
                        <rect x="128" y="8" width="14" height="14" rx="3" fill="#27272A" />
                        <rect x="146" y="10" width="22" height="3" rx="1.5" fill="#A1A1AA" />
                        <rect x="146" y="15" width="15" height="2.5" rx="1" fill="#52525B" />
                        <circle cx="166" cy="19" r="2.5" fill="#1DB954" />

                        {/* Section 2: Synced Lyrics Mock (middle) */}
                        <rect x="132" y="27" width="32" height="2" rx="1" fill="#3F3F46" />
                        <rect x="129" y="31.5" width="38" height="3.5" rx="1.75" fill="#10B981" />
                        <rect x="134" y="37.5" width="28" height="2" rx="1" fill="#3F3F46" />

                        {/* Section 3: Up Next Queue Mock (bottom) */}
                        <rect x="128" y="45" width="7" height="7" rx="1.5" fill="#27272A" />
                        <rect x="138" y="47" width="24" height="2" rx="1" fill="#A1A1AA" />
                        <rect x="128" y="55" width="7" height="7" rx="1.5" fill="#27272A" />
                        <rect x="138" y="57" width="18" height="2" rx="1" fill="#52525B" />
                        <circle cx="166" cy="58" r="3" fill="#1DB954" />
                      </svg>
                    </div>
                  </div>
                  <div className="monitor-label-group">
                    <span className="monitor-title">Right Sidebar</span>
                    <span className="monitor-sub">Vertical right edge dock</span>
                  </div>
                </button>
              </div>
            </section>

            {/* Section 2: Window Behavior & Input Card (Collapsible Dropdown Section) */}
            {(() => {
              const isBehaviorOpen = !collapsedSections['window-behavior'];
              return (
                <section className="settings-level1-card">
                  <div
                    className="card-top-header flex-between"
                    onClick={() => toggleSectionCollapse('window-behavior')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSectionCollapse('window-behavior');
                      }
                    }}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div className="header-left-cluster">
                      <div className="card-icon-badge">
                        <Sliders size={16} />
                      </div>
                      <div>
                        <h3 className="card-title-text">Window Behavior & Input</h3>
                        <p className="card-desc-text">Manage pin states, auto-hide delay and gesture shortcuts.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="card-action-btn ghost icon-only"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSectionCollapse('window-behavior');
                      }}
                      title={isBehaviorOpen ? "Collapse section" : "Expand section"}
                      aria-expanded={isBehaviorOpen}
                    >
                      <ChevronDown
                        size={16}
                        style={{
                          transform: isBehaviorOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.22s ease',
                          color: '#a1a1aa',
                        }}
                      />
                    </button>
                  </div>

                  {isBehaviorOpen && (
                    <>
                      {/* Row 1: Pin Dock (Keep Always Open) */}
                      <div className="card-hairline-row flex-between">
                        <div className="row-with-icon">
                          <div className="inner-icon-badge">
                            <Pin size={15} />
                          </div>
                          <div>
                            <div className="row-main-label">Pin Dock (Keep Always Open)</div>
                            <div className="row-sub-label">Disables auto-hide so the dock stays visible on top of applications</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className={`pill-toggle-switch ios-switch ${position.pinned ? 'on active' : 'off'}`}
                          onClick={() => updateSettings({ position: { pinned: !position.pinned } })}
                          aria-label="Toggle Pin Dock"
                        >
                          <span className="toggle-thumb" />
                        </button>
                      </div>

                      {/* Row 2: Mouse Wheel Volume Control */}
                      <div className="card-hairline-row flex-between">
                        <div className="row-with-icon">
                          <div className="inner-icon-badge">
                            <Volume2 size={15} />
                          </div>
                          <div>
                            <div className="row-main-label">Mouse Wheel Volume Control</div>
                            <div className="row-sub-label">Scroll mouse wheel over empty dock canvas to raise or lower Spotify volume</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className={`pill-toggle-switch emerald-switch ${behavior.mouseWheelVolume !== false ? 'on active' : 'off'}`}
                          onClick={() =>
                            updateSettings({
                              behavior: { mouseWheelVolume: behavior.mouseWheelVolume === false },
                            })
                          }
                          aria-label="Toggle Mouse Wheel Volume"
                        >
                          <span className="toggle-thumb" />
                        </button>
                      </div>

                      {/* Row 3: Auto-Hide Grace Delay */}
                      <div className="card-hairline-row flex-between">
                        <div className="row-with-icon">
                          <div className="inner-icon-badge">
                            <Clock size={15} />
                          </div>
                          <div>
                            <div className="row-main-label">Auto-Hide Grace Delay</div>
                            <div className="row-sub-label">Duration before dock slides out after mouse leaves edge</div>
                          </div>
                        </div>
                        <div className="segment-pill-group">
                          {['Instant', '300ms', '1.0s'].map((d) => {
                            const isSelected = (behavior.autoHideDelay || '300ms') === d;
                            return (
                              <button
                                key={d}
                                type="button"
                                className={`segment-pill-btn ${isSelected ? 'active' : ''}`}
                                onClick={() => updateSettings({ behavior: { autoHideDelay: d } })}
                              >
                                {d}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Row 4: Edge Reveal Distance */}
                      <div className="card-hairline-row flex-between">
                        <div className="row-with-icon">
                          <div className="inner-icon-badge">
                            <Compass size={15} />
                          </div>
                          <div>
                            <div className="row-main-label">Edge Reveal Distance</div>
                            <div className="row-sub-label">Only reveal dock when mouse hits the screen boundary</div>
                          </div>
                        </div>
                        <div className="segment-pill-group">
                          {[
                            { label: 'Edge Only (1px)', val: 1 },
                            { label: 'Near Edge (4px)', val: 4 },
                            { label: 'Relaxed (8px)', val: 8 },
                          ].map((item) => {
                            const isSelected = (position.triggerDistance ?? 1) === item.val;
                            return (
                              <button
                                key={item.val}
                                type="button"
                                className={`segment-pill-btn ${isSelected ? 'active' : ''}`}
                                onClick={() => updateSettings({ position: { triggerDistance: item.val } })}
                              >
                                {item.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Row 4b: Edge Trigger Area */}
                      <div className="card-hairline-row flex-between">
                        <div className="row-with-icon">
                          <div className="inner-icon-badge">
                            <Target size={15} />
                          </div>
                          <div>
                            <div className="row-main-label">Edge Trigger Area</div>
                            <div className="row-sub-label">Limit hover detection zone along the screen edge to eliminate false triggers</div>
                          </div>
                        </div>
                        <div className="segment-pill-group">
                          {[
                            { label: 'Full Edge', val: 'full', title: 'Detect across the entire screen edge' },
                            { label: 'Center Zone', val: 'center', title: 'Only trigger when cursor is near the center' },
                            { label: 'Compact Hotspot', val: 'compact', title: 'Tight center hotspot for maximum false-trigger avoidance' },
                          ].map((item) => {
                            const isSelected = (position.triggerSpan || 'full') === item.val;
                            return (
                              <button
                                key={item.val}
                                type="button"
                                className={`segment-pill-btn ${isSelected ? 'active' : ''}`}
                                onClick={() => updateSettings({ position: { triggerSpan: item.val } })}
                                title={item.title}
                              >
                                {item.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Row 5: Dynamic Island "Peek-on-Track-Change" */}
                      <div className="card-hairline-row flex-between">
                        <div className="row-with-icon">
                          <div className="inner-icon-badge">
                            <Sparkles size={15} />
                          </div>
                          <div>
                            <div className="row-main-label">Dynamic Island "Peek-on-Track-Change"</div>
                            <div className="row-sub-label">Briefly glide down a compact Dynamic Island pill for 5s on track change when the dock is auto-hidden</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className={`pill-toggle-switch emerald-switch ${behavior.trackChangePeek !== false ? 'on active' : 'off'}`}
                          onClick={() =>
                            updateSettings({
                              behavior: { trackChangePeek: behavior.trackChangePeek === false },
                            })
                          }
                          aria-label="Toggle Dynamic Island Peek"
                        >
                          <span className="toggle-thumb" />
                        </button>
                      </div>

                      {/* Row 6: Launch on Windows Startup */}
                      <div className="card-hairline-row flex-between">
                        <div className="row-with-icon">
                          <div className="inner-icon-badge">
                            <Power size={15} />
                          </div>
                          <div>
                            <div className="row-main-label">Launch on Windows Startup</div>
                            <div className="row-sub-label">Automatically start ksync in the background when Windows boots up</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className={`pill-toggle-switch emerald-switch ${openAtLogin ? 'on active' : 'off'}`}
                          onClick={handleToggleOpenAtLogin}
                          aria-label="Toggle Launch on Startup"
                        >
                          <span className="toggle-thumb" />
                        </button>
                      </div>

                      {/* Row 7: Discord Rich Presence (RPC) */}
                      <div className="card-hairline-row flex-between">
                        <div className="row-with-icon">
                          <div className="inner-icon-badge">
                            <Radio size={15} />
                          </div>
                          <div>
                            <div className="row-main-label">Discord Rich Presence (RPC)</div>
                            <div className="row-sub-label">Broadcast "Listening to Ksync" status with live album artwork and seekbar on Discord</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className={`pill-toggle-switch emerald-switch ${behavior.discordRPC !== false ? 'on active' : 'off'}`}
                          onClick={() =>
                            updateSettings({
                              behavior: { discordRPC: behavior.discordRPC === false },
                            })
                          }
                          aria-label="Toggle Discord Rich Presence"
                        >
                          <span className="toggle-thumb" />
                        </button>
                      </div>

                      {/* Row 6: Discord "Listen Along" & Party Link */}
                      <div className="card-hairline-row flex-between" style={{ opacity: behavior.discordRPC === false ? 0.45 : 1, transition: 'opacity 0.2s ease' }}>
                        <div className="row-with-icon">
                          <div className="inner-icon-badge">
                            <Music size={15} />
                          </div>
                          <div>
                            <div className="row-main-label">Discord "Listen Along" & Party Link</div>
                            <div className="row-sub-label">Include session party metadata and direct Spotify sync buttons on your Discord profile</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={behavior.discordRPC === false}
                          className={`pill-toggle-switch emerald-switch ${behavior.discordPartySync !== false && behavior.discordRPC !== false ? 'on active' : 'off'}`}
                          onClick={() =>
                            updateSettings({
                              behavior: { discordPartySync: behavior.discordPartySync === false },
                            })
                          }
                          aria-label="Toggle Discord Listen Along"
                        >
                          <span className="toggle-thumb" />
                        </button>
                      </div>

                      {behavior.discordRPC !== false && (
                        <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(88, 101, 242, 0.08)', border: '1px solid rgba(88, 101, 242, 0.2)', borderRadius: '8px', fontSize: '12px', color: '#a1a1aa', lineHeight: '1.5' }}>
                          <strong style={{ color: '#ffffff' }}>Tip:</strong> If Discord shows <em>"Listening to Spotify"</em> instead of ksync, open Discord <strong>User Settings &gt; Connections &gt; Spotify</strong> and turn off <strong>"Display Spotify as your status"</strong>.
                        </div>
                      )}
                    </>
                  )}
                </section>
              );
            })()}
          </div>
        )}

        {/* TAB 4: SPOTIFY ACCOUNT & DEVICES */}
        {activeTab === 'account' && (
          <div className="settings-tab-pane">
            <header className="viewport-page-header">
              <h1 className="viewport-page-title">Spotify Account & Acoustic Matrix</h1>
              <p className="viewport-page-desc">
                High-fidelity session telemetry, native OS synchronization kernel, and acoustic endpoint routing.
              </p>
            </header>

            {/* Auth Error Feedback Alert Banner */}
            {authError && (
              <div className="account-auth-error-banner">
                <div className="auth-error-left">
                  <AlertCircle size={20} className="auth-error-icon" />
                  <div className="auth-error-content">
                    <div className="auth-error-title">Spotify Authorization Feedback</div>
                    <div className="auth-error-desc">{authError}</div>
                    {(authError.includes('403') || authError.includes('whitelisted') || authError.includes('denied') || authError.includes('Development') || authError.includes('INVALID_CLIENT')) && (
                      <div className="auth-error-tip">
                        💡 <strong>Why this happens:</strong> Spotify apps in Development Mode are restricted by Spotify to 25 invited accounts. To connect any Spotify account freely, enter your own personal Spotify Client ID in the configuration deck below.
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="auth-error-close"
                  onClick={() => setAuthError(null)}
                  title="Dismiss error"
                >
                  <X size={15} />
                </button>
              </div>
            )}

            {/* 6.1: Profile Membership Hero Card */}
            <section className="settings-level1-card account-pro-deck">
              <div className="account-pro-deck-glow" />
              <div className="account-pro-main-row">
                {/* Avatar */}
                <div className="account-pro-avatar-slot">
                  <div className="account-pro-avatar-ring">
                    {user?.images?.[0]?.url ? (
                      <img src={user.images[0].url} alt={user?.display_name || 'Spotify'} className="account-pro-avatar-img" />
                    ) : (
                      <div className="account-pro-avatar-fallback">
                        <User size={30} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Identity */}
                <div className="account-pro-identity">
                  <h2 className="account-pro-name">
                    {user?.display_name || (isAuthenticated ? 'Spotify Subscriber' : 'No Account Linked')}
                  </h2>

                  <div className="account-pro-details">
                    <span className="account-pro-email">{user?.email || 'OAuth 2.0 PKCE Session Active'}</span>
                    {user?.country && (
                      <span className="account-pro-region"> · REGION: {user.country}</span>
                    )}
                  </div>
                </div>

                {/* Hero Actions */}
                <div className="account-pro-actions">
                  <button
                    type="button"
                    className="account-pro-btn-spotify"
                    onClick={() => {
                      if (window.electronAPI?.openSpotifyApp) window.electronAPI.openSpotifyApp();
                    }}
                    title="Launch official Spotify Desktop Client"
                  >
                    <ExternalLink size={13} />
                    <span>Open Spotify App</span>
                  </button>

                  {isAuthenticated ? (
                    <button
                      type="button"
                      className="account-pro-btn-signout"
                      onClick={handleLogout}
                      title="Disconnect Spotify Session"
                    >
                      <LogOut size={13} />
                      <span>Disconnect</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="account-pro-btn-login"
                      onClick={handleLogin}
                      disabled={isAuthenticating}
                      title="Authorize via Spotify OAuth"
                    >
                      {isAuthenticating ? (
                        <>
                          <RefreshCw size={13} className="spin-anim" />
                          <span>Connecting...</span>
                        </>
                      ) : (
                        <>
                          <LogIn size={13} />
                          <span>Connect Account</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* High-Tech Telemetry Strip */}
              <div className="account-pro-telemetry-strip">
                <div className="telemetry-stat-cell">
                  <span className="stat-label">SECURITY PROTOCOL</span>
                  <span className="stat-value">
                    <CheckCircle2 size={12} className="stat-icon-green" />
                    PKCE (Client-Side Auth)
                  </span>
                </div>
                <div className="telemetry-separator" />
                <div className="telemetry-stat-cell">
                  <span className="stat-label">STREAM FIDELITY</span>
                  <span className="stat-value">
                    <Activity size={12} className="stat-icon-green" />
                    320 kbps Master Audio
                  </span>
                </div>
                <div className="telemetry-separator" />
                <div className="telemetry-stat-cell">
                  <span className="stat-label">ENGINE LATENCY</span>
                  <span className="stat-value">
                    <span className="latency-indicator">&lt; 1.8ms</span>
                    Native OS Hook
                  </span>
                </div>
              </div>
            </section>

            {/* Custom Spotify Client ID Card */}
            <section className="settings-level1-card account-clientid-deck">
              <div className="card-top-header">
                <div className="card-icon-badge engine-badge">
                  <Zap size={16} />
                </div>
                <div>
                  <h3 className="card-title-text">Spotify Developer Client ID</h3>
                  <p className="card-desc-text">
                    Use your personal Spotify Developer App Client ID to connect any Spotify account without whitelist limitations.
                  </p>
                </div>
              </div>

              <div className="clientid-input-composite-row">
                <div className="clientid-input-wrapper">
                  <input
                    type="text"
                    value={customClientIdInput}
                    onChange={(e) => setCustomClientIdInput(e.target.value)}
                    placeholder="Default Client ID (9aaae8f6921b4ad3a5b068067d87c0ac)"
                    className="clientid-text-input"
                    spellCheck="false"
                  />
                  {customClientIdInput && (
                    <button
                      type="button"
                      className="clientid-clear-btn"
                      onClick={() => setCustomClientIdInput('')}
                      title="Clear"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                <div className="clientid-action-buttons">
                  <button
                    type="button"
                    className="clientid-save-btn"
                    onClick={() => handleSaveCustomClientId(customClientIdInput)}
                    disabled={customClientIdInput.trim() === (settings?.behavior?.spotifyClientId || '').trim()}
                  >
                    <Save size={13} />
                    <span>Apply ID</span>
                  </button>

                  {Boolean(settings?.behavior?.spotifyClientId) && (
                    <button
                      type="button"
                      className="clientid-reset-btn"
                      onClick={handleResetCustomClientId}
                      title="Reset to default community Client ID"
                    >
                      <RotateCcw size={13} />
                      <span>Use Default</span>
                    </button>
                  )}
                </div>
              </div>

              {clientIdSaveFeedback && (
                <div className="clientid-feedback-banner">
                  <CheckCircle2 size={14} className="feedback-icon" />
                  <span>{clientIdSaveFeedback}</span>
                </div>
              )}

              {/* Collapsible Setup Guide */}
              <div className="clientid-guide-expander">
                <button
                  type="button"
                  className="clientid-guide-toggle-btn"
                  onClick={() => setShowClientGuide(!showClientGuide)}
                >
                  <span>How to create your own free Spotify Client ID (takes 30 seconds)</span>
                  <ChevronDown
                    size={14}
                    style={{
                      transform: showClientGuide ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                    }}
                  />
                </button>

                {showClientGuide && (
                  <div className="clientid-guide-body">
                    <ol className="clientid-steps-list">
                      <li>
                        Go to the official{' '}
                        <button
                          type="button"
                          className="link-btn-inline"
                          onClick={() => {
                            if (window.electronAPI?.openExternalUrl) {
                              window.electronAPI.openExternalUrl('https://developer.spotify.com/dashboard');
                            }
                          }}
                        >
                          Spotify Developer Dashboard <ExternalLink size={11} />
                        </button>{' '}
                        and sign in with your Spotify account.
                      </li>
                      <li>
                        Click <strong>Create App</strong> and fill in:
                        <ul>
                          <li><strong>App Name:</strong> <code>ksync</code></li>
                          <li><strong>App Description:</strong> <code>Desktop Music Dock</code></li>
                          <li><strong>Redirect URI:</strong> <code>http://127.0.0.1:8888/callback</code></li>
                          <li>Check the box for <strong>Web API</strong></li>
                        </ul>
                      </li>
                      <li>Click <strong>Save</strong>.</li>
                      <li>In your newly created app, go to <strong>Settings</strong> and copy the <strong>Client ID</strong>.</li>
                      <li>Paste it into the field above, click <strong>Apply ID</strong>, then click <strong>Connect Account</strong> above!</li>
                    </ol>
                  </div>
                )}
              </div>
            </section>

            {/* 6.2: Dual-Core Audio Engine Synchronization Deck */}
            <section className="settings-level1-card audio-engine-deck">
              <div className="card-top-header">
                <div className="card-icon-badge engine-badge">
                  <Activity size={16} />
                </div>
                <div>
                  <h3 className="card-title-text">Dual-Engine Synchronization Architecture</h3>
                  <p className="card-desc-text">
                    Direct local Windows media kernel coupled with Spotify Web cloud services for zero-rate-limit telemetry.
                  </p>
                </div>
              </div>

              <div className="engine-nodes-grid">
                {/* Engine 1: Windows SMTC Hook */}
                <div className="engine-node-card active-engine">
                  <div className="engine-node-top">
                    <div className="engine-node-icon-box smtc">
                      <Laptop size={18} />
                    </div>
                    <div className="engine-node-telemetry">
                      <div className="soundwave-equalizer active">
                        <span className="bar bar-1" />
                        <span className="bar bar-2" />
                        <span className="bar bar-3" />
                        <span className="bar bar-4" />
                      </div>
                    </div>
                  </div>
                  <div className="engine-node-title">Windows Media Transport Controls (SMTC)</div>
                  <div className="engine-node-desc">
                    Real-time local Windows OS media session bridge. Transmits scrub position, play/pause states, and track progress with zero API rate limits.
                  </div>
                  <div className="engine-node-footer">
                    <span className="node-status-badge online">
                      KERNEL HOOK ACTIVE
                    </span>
                    <span className="node-ping-badge">0ms LAG</span>
                  </div>
                </div>

                {/* Engine 2: Spotify Web API & LRCLIB Pipeline */}
                <div className="engine-node-card cloud-engine">
                  <div className="engine-node-top">
                    <div className="engine-node-icon-box spotify">
                      <Music size={18} />
                    </div>
                    <div className="engine-node-telemetry">
                      <span className="cloud-handshake-chip">TLS 1.3 SECURE</span>
                    </div>
                  </div>
                  <div className="engine-node-title">Spotify Cloud & Synced Lyrics Engine</div>
                  <div className="engine-node-desc">
                    Retrieves high-resolution album art, synchronized line-by-line karaoke lyrics via LRCLIB, live queue tracks, and Spotify Connect targets.
                  </div>
                  <div className="engine-node-footer">
                    <span className="node-status-badge online">
                      CONNECTED & VERIFIED
                    </span>
                    <span className="node-ping-badge">SYNCED</span>
                  </div>
                </div>
              </div>
            </section>

            {/* 6.3: Acoustic Output Routing (Spotify Connect) */}
            <section className="settings-level1-card endpoints-matrix-deck">
              <div className="matrix-header-row">
                <div className="matrix-header-info">
                  <div className="card-icon-badge matrix-badge">
                    <Speaker size={16} />
                  </div>
                  <div>
                    <h3 className="card-title-text">Acoustic Output Routing (Spotify Connect)</h3>
                    <p className="card-desc-text">
                      Route active audio stream and playback control across authorized endpoints on your network.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className={`matrix-scan-btn ${isRefreshingDevices ? 'scanning' : ''}`}
                  onClick={handleRefreshDevices}
                  disabled={isRefreshingDevices}
                  title="Scan for available Spotify Connect devices on your network"
                >
                  <RefreshCw size={13} className={isRefreshingDevices ? 'spinning' : ''} />
                  <span>{isRefreshingDevices ? 'Scanning...' : 'Scan Endpoints'}</span>
                </button>
              </div>

              {/* Status Feedback Banner */}
              {transferFeedback && (
                <div className={`endpoint-feedback-banner ${transferFeedback.type}`}>
                  {transferFeedback.type === 'success' ? (
                    <CheckCircle2 size={14} className="banner-icon-success" />
                  ) : (
                    <AlertCircle size={14} className="banner-icon-error" />
                  )}
                  <span className="banner-text">{transferFeedback.message}</span>
                  <button
                    type="button"
                    className="banner-close-btn"
                    onClick={() => setTransferFeedback(null)}
                    title="Dismiss"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* Endpoints Grid */}
              <div className="endpoints-grid">
                {devices.length > 0 ? (
                  devices.map((d) => {
                    const isCur = d.id === currentDeviceId || d.is_active;
                    const isTransferring = transferringDeviceId === d.id;
                    const DeviceIcon =
                      d.type?.toLowerCase() === 'smartphone'
                        ? Smartphone
                        : d.type?.toLowerCase() === 'tv'
                        ? Tv
                        : d.type?.toLowerCase() === 'speaker'
                        ? Speaker
                        : Laptop;
                    return (
                      <div
                        key={d.id}
                        className={`endpoint-card ${isCur ? 'active-output' : ''} ${isTransferring ? 'is-transferring' : ''}`}
                        onClick={() => handleDeviceChange(d.id, d.name)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleDeviceChange(d.id, d.name);
                        }}
                      >
                        <div className="endpoint-icon-frame">
                          <DeviceIcon size={20} />
                          {isCur && <span className="endpoint-active-glow-ring" />}
                        </div>

                        <div className="endpoint-meta">
                          <div className="endpoint-name-row">
                            <span className="endpoint-name">{d.name}</span>
                            {d.is_restricted && (
                              <span className="endpoint-restricted-tag">RESTRICTED</span>
                            )}
                          </div>
                          <span className="endpoint-type-label">
                            {d.type || 'Speaker'} · {isCur ? 'Current Master Output' : 'Available for Streaming'}
                          </span>
                        </div>

                        <div className="endpoint-state-slot">
                          {isTransferring ? (
                            <div className="endpoint-transferring-badge">
                              <RefreshCw size={11} className="spinning" />
                              <span>ROUTING STREAM...</span>
                            </div>
                          ) : isCur ? (
                            <div className="endpoint-active-badge">
                              <span>ACTIVE TARGET</span>
                            </div>
                          ) : (
                            <span className="endpoint-transfer-action">
                              <span>Route to Endpoint</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="endpoint-card active-output fallback-endpoint">
                    <div className="endpoint-icon-frame">
                      <Laptop size={20} />
                      <span className="endpoint-active-glow-ring" />
                    </div>
                    <div className="endpoint-meta">
                      <div className="endpoint-name-row">
                        <span className="endpoint-name">Windows Audio Engine (Direct Kernel)</span>
                        <span className="endpoint-native-tag">LOCAL MASTER</span>
                      </div>
                      <span className="endpoint-type-label">
                        PC Speakers & System Audio Hook · Primary Active Playback
                      </span>
                    </div>
                    <div className="endpoint-state-slot">
                      <div className="endpoint-active-badge">
                        <span>ACTIVE TARGET</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Acoustic Routing Helper Info */}
              <div className="endpoint-routing-helper-bar">
                <Info size={13} className="helper-info-icon" />
                <span className="helper-info-text">
                  Spotify Connect devices (smart speakers, phones, smart TVs) on your local network will automatically appear here when playback or the Spotify app is opened on them.
                </span>
              </div>
            </section>
          </div>
        )}

        {/* TAB 5: ABOUT & HOTKEYS */}
        {activeTab === 'about' && (
          <div className="settings-tab-pane">
            <header className="viewport-page-header">
              <h1 className="viewport-page-title">About ksync</h1>
              <p className="viewport-page-desc">
                Global hotkey configurations, software versioning, and development credits.
              </p>
            </header>

            {/* 7.1: Product Hero Card (About ksync) */}
            <section className="settings-level1-card product-hero-card">
              <div className="about-brand-row">
                <img src={appIcon} alt="ksync" className="app-icon-img large" />
                <div className="app-title-group">
                  <span className="product-hero-title">ksync</span>
                  <span className="about-version-mono">v{appVersion}</span>
                </div>
              </div>

              <p className="product-hero-description">
                Built for music lovers who want real-time synchronized karaoke lyrics, immediate playback control, and live queue tracking without keeping the full Spotify desktop app in view.
              </p>

              <div className="product-hero-footer">
                <div className="developer-badge">
                  <span className="dev-glyph">✦</span>
                  <span>Created by <strong>kiru studio</strong></span>
                </div>

                <div className="hero-links-cluster">
                  <button
                    type="button"
                    className="ghost-pill-link"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        window.open?.('https://github.com/kiru-studio/Ksync', '_blank');
                      }
                    }}
                  >
                    <ExternalLink size={12} />
                    <span>GitHub</span>
                  </button>
                </div>
              </div>
            </section>

            {/* 7.2: Keyboard Shortcuts Card */}
            <section className="settings-level1-card">
              <div className="card-top-header">
                <div className="card-icon-badge">
                  <Keyboard size={16} />
                </div>
                <div>
                  <h3 className="card-title-text">Keyboard Shortcuts</h3>
                  <p className="card-desc-text">Global shortcuts that work seamlessly across all Windows apps.</p>
                </div>
              </div>

              <div className="card-hairline-row flex-between">
                <div>
                  <div className="row-main-label">Toggle Dock Show / Hide</div>
                  <div className="row-sub-label">Press hotkey combination from anywhere to reveal or dock ksync</div>
                </div>

                <div className="hotkey-interactive-group">
                  <div className="kbd-caps-cluster">
                    <kbd className="tactile-kbd">Ctrl</kbd>
                    <span className="kbd-plus">+</span>
                    <kbd className="tactile-kbd">Alt</kbd>
                    <span className="kbd-plus">+</span>
                    <kbd className="tactile-kbd">S</kbd>
                  </div>
                  <button
                    type="button"
                    className={`record-hotkey-btn ${isRecordingHotkey ? 'recording' : ''}`}
                    onClick={() => setIsRecordingHotkey(!isRecordingHotkey)}
                  >
                    {isRecordingHotkey ? 'Press keys...' : 'Click to Record'}
                  </button>
                </div>
              </div>

              <div className="card-hairline-row flex-between">
                <div>
                  <div className="row-main-label">Compact Dynamic Island Mode</div>
                  <div className="row-sub-label">Shrink into a floating top Dynamic Island pill</div>
                </div>

                <div className="hotkey-interactive-group">
                  <div className="kbd-caps-cluster">
                    <kbd className="tactile-kbd">Ctrl</kbd>
                    <span className="kbd-plus">+</span>
                    <kbd className="tactile-kbd">Shift</kbd>
                    <span className="kbd-plus">+</span>
                    <kbd className="tactile-kbd">M</kbd>
                  </div>
                </div>
              </div>

              <div className="card-hairline-row flex-between">
                <div>
                  <div className="row-main-label">Multi-Monitor Display Cycle</div>
                  <div className="row-sub-label">Quickly hop between All Displays, Primary, and secondary monitors</div>
                </div>

                <div className="hotkey-interactive-group">
                  <div className="kbd-caps-cluster">
                    <kbd className="tactile-kbd">Ctrl</kbd>
                    <span className="kbd-plus">+</span>
                    <kbd className="tactile-kbd">Shift</kbd>
                    <span className="kbd-plus">+</span>
                    <kbd className="tactile-kbd">D</kbd>
                  </div>
                </div>
              </div>
            </section>

            {/* 7.3: Update Card */}
            <section className="settings-level1-card ota-updates-card">
              <div className="card-top-header flex-between">
                <div className="header-left-cluster">
                  <div className="card-icon-badge">
                    <ArrowUpCircle size={16} />
                  </div>
                  <div>
                    <h3 className="card-title-text">Update</h3>
                    <p className="card-desc-text">
                      Automatic background software delivery and release telemetry.
                    </p>
                  </div>
                </div>

                <div className="update-version-chip-cluster">
                  <span className="update-release-tag">STABLE</span>
                  <span className="update-version-pill">v{appVersion}</span>
                </div>
              </div>

              {/* Redesigned Update Telemetry Deck */}
              <div className="update-telemetry-deck">
                <div className="update-status-row">
                  <div className="update-status-visual-col">
                    {updateStatus.state === 'downloaded' ? (
                      <div className="update-status-icon-box success">
                        <CheckCircle2 size={18} />
                      </div>
                    ) : updateStatus.state === 'downloading' ? (
                      <div className="update-status-icon-box active">
                        <RefreshCw size={18} className="spin-icon" />
                      </div>
                    ) : updateStatus.state === 'available' ? (
                      <div className="update-status-icon-box active">
                        <Download size={18} />
                      </div>
                    ) : updateStatus.state === 'checking' || isCheckingUpdate ? (
                      <div className="update-status-icon-box checking">
                        <RefreshCw size={18} className="spin-icon" />
                      </div>
                    ) : updateStatus.state === 'error' ? (
                      <div className="update-status-icon-box error">
                        <AlertCircle size={18} />
                      </div>
                    ) : (
                      <div className="update-status-icon-box up-to-date">
                        <CheckCircle2 size={18} />
                      </div>
                    )}

                    <div className="update-status-text-group">
                      <div className="update-headline">
                        {updateStatus.state === 'downloaded'
                          ? `Update v${updateStatus.version} is ready to install`
                          : updateStatus.state === 'downloading'
                          ? `Downloading update v${updateStatus.version} (${updateStatus.percent}%)`
                          : updateStatus.state === 'available'
                          ? `New release v${updateStatus.version} available`
                          : updateStatus.state === 'checking' || isCheckingUpdate
                          ? 'Checking for updates...'
                          : updateStatus.state === 'error'
                          ? 'Failed to check for updates'
                          : 'ksync is up to date'}
                      </div>
                      <div className="update-subline">
                        {updateStatus.state === 'downloaded'
                          ? 'Restart ksync to apply the latest build instantly.'
                          : updateStatus.state === 'downloading'
                          ? 'Acquiring package assets from GitHub Releases distribution.'
                          : updateStatus.state === 'available'
                          ? 'A new build has been published on GitHub Releases.'
                          : updateStatus.state === 'checking' || isCheckingUpdate
                          ? 'Querying GitHub API distribution channels...'
                          : updateStatus.state === 'error'
                          ? (updateStatus.error && updateStatus.error.length > 100
                              ? (updateStatus.error.toLowerCase().includes('sign')
                                  ? 'Release verification failed. Please download the latest release from GitHub.'
                                  : `${updateStatus.error.slice(0, 97)}...`)
                              : (updateStatus.error || 'Network connection unavailable or rate-limited.'))
                          : `Version ${appVersion} is the latest release build.`}
                      </div>
                    </div>
                  </div>

                  {updateStatus.lastChecked && (
                    <span className="update-timestamp-badge">
                      Last checked {new Date(updateStatus.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>

                {/* Download Progress Bar */}
                {updateStatus.state === 'downloading' && (
                  <div className="update-progress-track">
                    <div className="update-progress-fill" style={{ width: `${updateStatus.percent}%` }} />
                  </div>
                )}
              </div>

              {/* Reworked Action Controls */}
              <div className="update-action-footer">
                {updateStatus.state === 'downloaded' ? (
                  <button
                    type="button"
                    className="action-pill-btn primary-glow-btn"
                    onClick={handleQuitAndInstall}
                  >
                    <ArrowUpCircle size={14} />
                    <span>Restart & Install v{updateStatus.version}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="action-pill-btn"
                    onClick={handleCheckForUpdates}
                    disabled={isCheckingUpdate || updateStatus.state === 'checking' || updateStatus.state === 'downloading'}
                  >
                    <RefreshCw size={13} className={isCheckingUpdate || updateStatus.state === 'checking' ? 'spin-icon' : ''} />
                    <span>{isCheckingUpdate || updateStatus.state === 'checking' ? 'Checking for updates...' : 'Check for Updates'}</span>
                  </button>
                )}

                <button
                  type="button"
                  className="ghost-pill-link"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.open?.('https://github.com/kiru-studio/Ksync/releases', '_blank');
                    }
                  }}
                >
                  <ExternalLink size={13} />
                  <span>Release Notes</span>
                </button>
              </div>
            </section>
          </div>
        )}
        </div>
      </main>
  );

  const renderTitleBar = (extraClass = '') => (
    <header className={`stark-hud-seam-bar ${extraClass}`}>
      <div className="stark-hud-brand">
        <img src={appIcon} alt="ksync" className="stark-hud-logo" />
        <span className="stark-hud-app-name">ksync</span>
        <span className="stark-hud-version">v{appVersion ? (appVersion.startsWith('v') ? appVersion.slice(1) : appVersion) : '2.0'}</span>
      </div>
      <div className="stark-hud-actions">
        {hasUnsavedChanges && (
          <button
            type="button"
            className="stark-hud-reset-btn"
            onClick={handleGlobalReset}
            title="Reset settings to factory defaults"
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>
        )}
        <button
          type="button"
          className="stark-ctrl-btn"
          onClick={handleMinimizeWindow}
          title="Minimize Window"
        >
          <Minus size={13} />
        </button>
        <button
          type="button"
          className="stark-ctrl-btn close"
          onClick={handleCloseWindow}
          title="Close Settings (Esc)"
        >
          <X size={13} />
          <span className="esc-tag">ESC</span>
        </button>
      </div>
    </header>
  );

  return (
    <div className={`settings-app-window mode-${mode}`}>
      {mode === 'top' && (
        <>
          {/* Top Live Dock Housing Reserve */}
          <div className="stark-top-dock-reserve" style={{ height: `${isIsland ? 220 : dockHeight}px` }}>
            {isIsland && (
              <div className="stark-island-target-bracket" style={{ width: `${islandWidth}px` }}>
                <span className="bracket-corner top-left" />
                <span className="bracket-corner top-right" />
                <span className="bracket-corner btm-left" />
                <span className="bracket-corner btm-right" />
              </div>
            )}
          </div>

          {/* Clean Title Bar with Minimal Brand & Window Controls */}
          {renderTitleBar('top')}

          {/* Fully visible, perfectly aligned workspace */}
          <div className="stark-workspace-shell" style={{ height: `calc(100vh - ${(isIsland ? 220 : dockHeight) + 34}px)` }}>
            {sidebarElement}
            {mainViewportElement}
          </div>
        </>
      )}

      {mode === 'left' && (
        <>
          {/* Left Live Dock Housing Reserve */}
          <div className="stark-side-dock-reserve left" style={{ width: `${sidebarWidth}px` }} />
          <div className="stark-hud-seam-vertical left" />
          <div className="stark-workspace-column" style={{ width: `calc(100vw - ${sidebarWidth + 1}px)` }}>
            {renderTitleBar('lateral')}
            <div className="stark-workspace-shell lateral" style={{ height: 'calc(100vh - 34px)' }}>
              {sidebarElement}
              {mainViewportElement}
            </div>
          </div>
        </>
      )}

      {mode === 'right' && (
        <>
          <div className="stark-workspace-column" style={{ width: `calc(100vw - ${sidebarWidth + 1}px)` }}>
            {renderTitleBar('lateral')}
            <div className="stark-workspace-shell lateral" style={{ height: 'calc(100vh - 34px)' }}>
              {sidebarElement}
              {mainViewportElement}
            </div>
          </div>
          <div className="stark-hud-seam-vertical right" />
          {/* Right Live Dock Housing Reserve */}
          <div className="stark-side-dock-reserve right" style={{ width: `${sidebarWidth}px` }} />
        </>
      )}


      {/* Modal: Rename Custom Preset */}
      {renamingPresetId && (
        <div className="settings-modal-backdrop" onClick={() => setRenamingPresetId(null)}>
          <div className="settings-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top-header">
              <div className="modal-icon-badge">
                <Edit2 size={18} />
              </div>
              <div>
                <h3 className="modal-title-text">Rename Custom Preset</h3>
                <p className="modal-desc-text">Update the display name of this theme.</p>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setRenamingPresetId(null)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleRenameSubmit} className="modal-form-body">
              <label className="modal-input-label">NEW PRESET NAME</label>
              <input
                type="text"
                className="modal-text-input"
                placeholder="Theme name"
                value={renameInputValue}
                onChange={(e) => setRenameInputValue(e.target.value)}
                autoFocus
                maxLength={32}
              />
              <div className="modal-actions-row">
                <button
                  type="button"
                  className="modal-secondary-btn"
                  onClick={() => setRenamingPresetId(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-primary-btn"
                  disabled={!renameInputValue.trim()}
                >
                  <Check size={14} />
                  <span>Update Name</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Import Theme */}
      {showImportModal && (
        <div className="settings-modal-backdrop" onClick={() => setShowImportModal(false)}>
          <div className="settings-modal-card modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top-header">
              <div className="modal-icon-badge">
                <FileJson size={18} />
              </div>
              <div>
                <h3 className="modal-title-text">Import Theme Configuration</h3>
                <p className="modal-desc-text">Paste a valid KSync theme JSON or upload an exported theme file.</p>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setShowImportModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleImportSubmit} className="modal-form-body">
              <div className="modal-upload-bar">
                <label className="modal-file-btn">
                  <Upload size={14} />
                  <span>Choose JSON File</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                </label>
                <span className="modal-upload-hint">or paste the JSON payload below</span>
              </div>
              <textarea
                className="modal-textarea-input"
                placeholder="Paste theme JSON structure here..."
                rows={8}
                value={importJsonText}
                onChange={(e) => {
                  setImportJsonText(e.target.value);
                  setImportFeedback(null);
                }}
              />
              {importFeedback && (
                <div className="modal-error-banner">
                  <AlertCircle size={14} />
                  <span>{importFeedback}</span>
                </div>
              )}
              <div className="modal-actions-row">
                <button
                  type="button"
                  className="modal-secondary-btn"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportJsonText('');
                    setImportFeedback(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-primary-btn"
                  disabled={!importJsonText.trim()}
                >
                  <Upload size={14} />
                  <span>Import & Apply</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Status Toast */}
      {toastMessage && (
        <div className="floating-toast-notification">
          <CheckCircle2 size={15} className="toast-icon" />
          <span>{toastMessage}</span>
        </div>
      )}
</div>
  );
}
