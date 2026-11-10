'use client'

import {
  SoundwaveLinearIcon as AudioLinesIcon,
  PauseBoldIcon as PauseIcon,
  PlayBoldIcon as PlayIcon,
  RewindBackBoldIcon as PreviousIcon,
  RewindForwardBoldIcon as NextIcon,
  AirbudsBoldIcon as AirbudsIcon,
} from '@solar-icons/react'
import * as React from 'react'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'
import { ListMusic, Shuffle, Repeat, Repeat1, Volume2, VolumeX } from 'lucide-react'
import MarqueeText from '../MarqueeText'
import CircularAudioVisualizer from '../CircularAudioVisualizer'

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center border-none outline-none select-none transition-all cursor-pointer disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: '!bg-white !text-black hover:scale-105 active:scale-95 shadow-[0_4px_16px_rgba(255,255,255,0.25)]',
        ghost: '!bg-transparent text-white/70 hover:!bg-white/10 hover:text-white active:scale-95',
        outline: 'border border-white/20 !bg-transparent text-white hover:!bg-white/10',
        secondary: '!bg-white/10 text-white hover:!bg-white/20',
      },
      size: {
        default: 'h-9 px-3 text-sm rounded-lg',
        icon: 'size-10 rounded-full',
        'icon-lg': 'size-12 rounded-full',
        'icon-sm': 'size-8 rounded-full',
        'icon-xs': 'size-7 rounded-md',
      },
    },
    defaultVariants: {
      variant: 'ghost',
      size: 'icon',
    },
  },
)

const WAVE_BARS = [
  30, 42, 60, 80, 50, 38, 70, 95, 82, 58, 44, 76, 92, 100, 72, 48, 64, 88, 96,
  78, 54, 40, 62, 82, 92, 74, 52, 66, 84, 98, 68, 46, 58, 48, 36, 26,
]

function Button({
  className,
  variant = 'ghost',
  size = 'icon',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export interface LyricItem {
  startTime?: number
  time?: number
  text?: string
  words?: string
  isIntro?: boolean
}

export interface QueueTrack {
  id?: string
  name?: string
  title?: string
  artist?: string
  durationMs?: number
  uri?: string
}

interface AudioPlayerProps extends Omit<React.ComponentProps<'section'>, 'onChange'> {
  currentTime: number
  artworkUrl?: string
  duration: number
  isPlaying?: boolean
  volume?: number
  systemVolume?: number
  systemMuted?: boolean
  islandShape?: 'square' | 'rectangle'
  shuffleState?: boolean
  repeatState?: 'off' | 'context' | 'track' | boolean
  lyrics?: LyricItem[]
  currentLyricIndex?: number
  queue?: QueueTrack[]
  onChange?: (time: number) => void
  onToggle?: () => void
  onPrevious?: () => void
  onNext?: () => void
  onShuffle?: () => void
  onRepeat?: () => void
  onVolumeChange?: (vol: number) => void
  onSystemVolumeChange?: (vol: number) => void
  onSystemMuteToggle?: (muted: boolean) => void
  onPlayTrack?: (uri: string, index: number, track: any) => void
  onOutput?: () => void
  subtitle?: string
  title: string
}

function formatTime(seconds: number) {
  if (isNaN(seconds) || seconds < 0) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.floor(seconds % 60)
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

function AudioPlayer({
  className,
  artworkUrl,
  currentTime,
  duration,
  isPlaying = false,
  volume = 50,
  systemVolume = 50,
  systemMuted = false,
  islandShape = 'square',
  shuffleState = false,
  repeatState = 'off',
  lyrics = [],
  currentLyricIndex = -1,
  queue = [],
  onChange,
  onToggle,
  onPrevious,
  onNext,
  onShuffle,
  onRepeat,
  onVolumeChange,
  onSystemVolumeChange,
  onSystemMuteToggle,
  onPlayTrack,
  onOutput,
  subtitle,
  title,
  ...props
}: AudioPlayerProps) {
  // -------------------------------------------------------------
  // 1. Spotify In-App Volume Control State & Handlers
  // -------------------------------------------------------------
  const [localSpotifyVolume, setLocalSpotifyVolume] = useState(() => {
    if (typeof volume === 'number' && volume > 0) return volume
    try {
      const saved = localStorage.getItem('ksync_last_volume')
      if (saved !== null && !isNaN(Number(saved)) && Number(saved) > 0) return Number(saved)
    } catch (_) {}
    return 50
  })
  const [prevSpotifyVolume, setPrevSpotifyVolume] = useState(localSpotifyVolume || 50)
  const [isSpotifyHovered, setIsSpotifyHovered] = useState(false)
  const [isSpotifyDragging, setIsSpotifyDragging] = useState(false)
  const [isSpotifyInteracting, setIsSpotifyInteracting] = useState(false)
  const spotifyTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const spotifyInteractionTimerRef = useRef<NodeJS.Timeout | null>(null)
  const spotifyThrottleRef = useRef<NodeJS.Timeout | null>(null)
  const latestSpotifyVolRef = useRef(localSpotifyVolume)
  const spotifyTrackRef = useRef<HTMLDivElement>(null)

  const lastSpotifyInteractionRef = useRef(0)

  // Sync external volume prop
  useEffect(() => {
    if (!isSpotifyDragging && Date.now() - lastSpotifyInteractionRef.current >= 800 && typeof volume === 'number') {
      setLocalSpotifyVolume(volume)
      latestSpotifyVolRef.current = volume
    }
  }, [volume, isSpotifyDragging])

  const triggerSpotifyInteraction = useCallback(() => {
    lastSpotifyInteractionRef.current = Date.now()
    setIsSpotifyInteracting(true)
    if (spotifyInteractionTimerRef.current) clearTimeout(spotifyInteractionTimerRef.current)
    spotifyInteractionTimerRef.current = setTimeout(() => {
      setIsSpotifyInteracting(false)
    }, 800)
  }, [])

  const dispatchSpotifyVolume = useCallback((val: number, immediate = true) => {
    const clamped = Math.max(0, Math.min(100, Math.round(val)))
    lastSpotifyInteractionRef.current = Date.now()
    setLocalSpotifyVolume(clamped)
    latestSpotifyVolRef.current = clamped
    try {
      localStorage.setItem('ksync_last_volume', String(clamped))
    } catch (_) {}

    if (spotifyThrottleRef.current) {
      clearTimeout(spotifyThrottleRef.current)
      spotifyThrottleRef.current = null
    }

    if (immediate) {
      onVolumeChange?.(clamped)
      return
    }

    spotifyThrottleRef.current = setTimeout(() => {
      spotifyThrottleRef.current = null
      onVolumeChange?.(latestSpotifyVolRef.current)
    }, 40)
  }, [onVolumeChange])

  const toggleSpotifyMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (localSpotifyVolume > 0) {
      setPrevSpotifyVolume(localSpotifyVolume)
      dispatchSpotifyVolume(0, true)
    } else {
      const restore = prevSpotifyVolume > 0 ? prevSpotifyVolume : 50
      dispatchSpotifyVolume(restore, true)
    }
  }, [localSpotifyVolume, prevSpotifyVolume, dispatchSpotifyVolume])

  const handleSpotifyWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const delta = e.deltaY < 0 ? 5 : -5
    dispatchSpotifyVolume(localSpotifyVolume + delta, true)
  }, [localSpotifyVolume, dispatchSpotifyVolume])

  const handleSpotifyEnter = useCallback(() => {
    if (spotifyTimeoutRef.current) clearTimeout(spotifyTimeoutRef.current)
    setIsSpotifyHovered(true)
  }, [])

  const handleSpotifyLeave = useCallback(() => {
    if (spotifyTimeoutRef.current) clearTimeout(spotifyTimeoutRef.current)
    if (spotifyInteractionTimerRef.current) clearTimeout(spotifyInteractionTimerRef.current)
    setIsSpotifyHovered(false)
    if (!isSpotifyDragging) {
      setIsSpotifyInteracting(false)
    }
  }, [isSpotifyDragging])

  const handleSpotifyPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    e.preventDefault()
    setIsSpotifyDragging(true)
    triggerSpotifyInteraction()

    const calcVol = (clientX: number) => {
      if (!spotifyTrackRef.current) return localSpotifyVolume
      const rect = spotifyTrackRef.current.getBoundingClientRect()
      const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width))
      return Math.round((clickX / rect.width) * 100)
    }

    const startVol = calcVol(e.clientX)
    dispatchSpotifyVolume(startVol, true)

    const onPointerMove = (me: PointerEvent) => {
      dispatchSpotifyVolume(calcVol(me.clientX), true)
    }

    const onPointerUp = () => {
      setIsSpotifyDragging(false)
      setIsSpotifyInteracting(false)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }, [localSpotifyVolume, dispatchSpotifyVolume, triggerSpotifyInteraction])

  const isSpotifyActive = isSpotifyHovered || isSpotifyDragging || isSpotifyInteracting

  // -------------------------------------------------------------
  // 2. Windows Master System Volume Control State & Handlers
  // -------------------------------------------------------------
  const [localSysVolume, setLocalSysVolume] = useState(() => {
    if (typeof systemVolume === 'number' && systemVolume > 0) return systemVolume
    try {
      const saved = localStorage.getItem('ksync_last_system_volume')
      if (saved !== null && !isNaN(Number(saved)) && Number(saved) > 0) return Number(saved)
    } catch (_) {}
    return 50
  })
  const [isSysMutedState, setIsSysMutedState] = useState(!!systemMuted)
  const [prevSysVolume, setPrevSysVolume] = useState(localSysVolume || 50)
  const [isSysHovered, setIsSysHovered] = useState(false)
  const [isSysDragging, setIsSysDragging] = useState(false)
  const [isSysInteracting, setIsSysInteracting] = useState(false)
  const sysTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const sysInteractionTimerRef = useRef<NodeJS.Timeout | null>(null)
  const sysThrottleRef = useRef<NodeJS.Timeout | null>(null)
  const latestSysVolRef = useRef(localSysVolume)
  const lastSysInteractionRef = useRef(0)
  const sysTrackRef = useRef<HTMLDivElement>(null)

  // Sync external systemVolume & systemMuted props
  useEffect(() => {
    if (!isSysDragging && Date.now() - lastSysInteractionRef.current >= 800 && typeof systemVolume === 'number') {
      setLocalSysVolume(systemVolume)
      latestSysVolRef.current = systemVolume
    }
  }, [systemVolume, isSysDragging])

  useEffect(() => {
    setIsSysMutedState(!!systemMuted)
  }, [systemMuted])

  const triggerSysInteraction = useCallback(() => {
    lastSysInteractionRef.current = Date.now()
    setIsSysInteracting(true)
    if (sysInteractionTimerRef.current) clearTimeout(sysInteractionTimerRef.current)
    sysInteractionTimerRef.current = setTimeout(() => {
      setIsSysInteracting(false)
    }, 800)
  }, [])

  const dispatchSysVolume = useCallback((val: number, immediate = true) => {
    const clamped = Math.max(0, Math.min(100, Math.round(val)))
    lastSysInteractionRef.current = Date.now()
    setLocalSysVolume(clamped)
    latestSysVolRef.current = clamped
    try {
      localStorage.setItem('ksync_last_system_volume', String(clamped))
    } catch (_) {}

    if (isSysMutedState && clamped > 0) {
      setIsSysMutedState(false)
      onSystemMuteToggle?.(false)
    }

    if (sysThrottleRef.current) {
      clearTimeout(sysThrottleRef.current)
      sysThrottleRef.current = null
    }

    if (immediate) {
      onSystemVolumeChange?.(clamped)
      return
    }

    sysThrottleRef.current = setTimeout(() => {
      sysThrottleRef.current = null
      onSystemVolumeChange?.(latestSysVolRef.current)
    }, 40)
  }, [isSysMutedState, onSystemMuteToggle, onSystemVolumeChange])

  const toggleSysMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (isSysMutedState || localSysVolume === 0) {
      setIsSysMutedState(false)
      onSystemMuteToggle?.(false)
      const restore = prevSysVolume > 0 ? prevSysVolume : 50
      dispatchSysVolume(restore, true)
    } else {
      setIsSysMutedState(true)
      onSystemMuteToggle?.(true)
      setPrevSysVolume(localSysVolume)
    }
  }, [isSysMutedState, localSysVolume, prevSysVolume, onSystemMuteToggle, dispatchSysVolume])

  const handleSysWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const delta = e.deltaY < 0 ? 5 : -5
    dispatchSysVolume(localSysVolume + delta, true)
  }, [localSysVolume, dispatchSysVolume])

  const handleSysEnter = useCallback(() => {
    if (sysTimeoutRef.current) clearTimeout(sysTimeoutRef.current)
    setIsSysHovered(true)
  }, [])

  const handleSysLeave = useCallback(() => {
    if (sysTimeoutRef.current) clearTimeout(sysTimeoutRef.current)
    if (sysInteractionTimerRef.current) clearTimeout(sysInteractionTimerRef.current)
    setIsSysHovered(false)
    if (!isSysDragging) {
      setIsSysInteracting(false)
    }
  }, [isSysDragging])

  const handleSysPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    e.preventDefault()
    setIsSysDragging(true)
    triggerSysInteraction()

    const calcVol = (clientX: number) => {
      if (!sysTrackRef.current) return localSysVolume
      const rect = sysTrackRef.current.getBoundingClientRect()
      const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width))
      return Math.round((clickX / rect.width) * 100)
    }

    const startVol = calcVol(e.clientX)
    dispatchSysVolume(startVol, true)

    const onPointerMove = (me: PointerEvent) => {
      dispatchSysVolume(calcVol(me.clientX), true)
    }

    const onPointerUp = () => {
      setIsSysDragging(false)
      setIsSysInteracting(false)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }, [localSysVolume, dispatchSysVolume, triggerSysInteraction])

  const isEffectiveSysMuted = isSysMutedState || localSysVolume === 0
  const isSysActive = isSysHovered || isSysDragging || isSysInteracting
  // Waveform seekbar state
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const [hoverPercent, setHoverPercent] = useState(0)
  const [isHoveringSeek, setIsHoveringSeek] = useState(false)
  const [showRemaining, setShowRemaining] = useState(true)

  // Queue hover state
  const [isQueueHovered, setIsQueueHovered] = useState(false)
  const queueTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleQueueEnter = () => {
    if (queueTimeoutRef.current) clearTimeout(queueTimeoutRef.current)
    setIsQueueHovered(true)
  }

  const handleQueueLeave = () => {
    queueTimeoutRef.current = setTimeout(() => {
      setIsQueueHovered(false)
    }, 220)
  }

  // Rotating vinyl artwork toggle state (synced with localStorage)
  const [isCircleArt, setIsCircleArt] = useState(() => {
    try {
      return localStorage.getItem('ksync_circle_art') === 'true'
    } catch (_) {
      return false
    }
  })

  const toggleCircleArt = () => {
    setIsCircleArt((prev) => {
      const next = !prev
      try {
        localStorage.setItem('ksync_circle_art', String(next))
      } catch (_) {}
      return next
    })
  }

  const isRepeatActive = repeatState === 'track' || repeatState === 'context' || repeatState === true

  // Current active, previous, and next lyric lines synchronized in real-time
  const hasLyrics = Array.isArray(lyrics) && lyrics.length > 0
  const activeLyricIdx = useMemo(() => {
    if (!lyrics || lyrics.length === 0) return -1
    if (typeof currentLyricIndex === 'number' && currentLyricIndex >= 0 && currentLyricIndex < lyrics.length) {
      return currentLyricIndex
    }
    let found = -1
    for (let i = 0; i < lyrics.length; i++) {
      const lineTime = typeof lyrics[i].startTime === 'number'
        ? lyrics[i].startTime!
        : typeof lyrics[i].time === 'number'
        ? (lyrics[i].time! > 1000 ? lyrics[i].time! / 1000 : lyrics[i].time!)
        : 0
      if (currentTime >= lineTime) {
        found = i
      } else {
        break
      }
    }
    return found >= 0 ? found : 0
  }, [lyrics, currentLyricIndex, currentTime])

  const currentLine = activeLyricIdx >= 0 && lyrics ? lyrics[activeLyricIdx] : null
  const prevLine = activeLyricIdx > 0 && lyrics ? lyrics[activeLyricIdx - 1] : null
  const nextLine = activeLyricIdx >= 0 && lyrics && activeLyricIdx < lyrics.length - 1 ? lyrics[activeLyricIdx + 1] : null

  const handleLyricClick = (line: LyricItem | null) => {
    if (!line || !onChange) return
    const t = line.startTime ?? line.time
    if (typeof t === 'number') {
      const seekSec = t > 1000 ? t / 1000 : t
      onChange(seekSec)
    }
  }

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0
  const seekTrackRef = useRef<HTMLDivElement>(null)
  const [isSeekDragging, setIsSeekDragging] = useState(false)

  const handleSeekPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!duration || !onChange) return
    e.stopPropagation()
    e.preventDefault()
    setIsSeekDragging(true)

    const calcSeek = (clientX: number) => {
      if (!seekTrackRef.current) return currentTime
      const rect = seekTrackRef.current.getBoundingClientRect()
      const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width))
      const pct = (clickX / rect.width) * 100
      setHoverPercent(pct)
      setHoverTime((pct / 100) * duration)
      return (clickX / rect.width) * duration
    }

    onChange(calcSeek(e.clientX))

    const onPointerMove = (me: PointerEvent) => {
      onChange(calcSeek(me.clientX))
    }
    const onPointerUp = () => {
      setIsSeekDragging(false)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  const handleSeekMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const pct = (x / rect.width) * 100
    setHoverPercent(pct)
    setHoverTime((pct / 100) * duration)
  }

  return (
    <section
      data-slot="audio-player"
      className={cn(
        'relative bg-[rgba(14,16,22,0.92)] backdrop-blur-2xl border border-white/12 p-3 text-white shadow-[0_20px_50px_rgba(0,0,0,0.6)] w-full h-full max-h-[220px] flex flex-col justify-between select-none box-border overflow-hidden transition-[border-radius] duration-200',
        islandShape === 'rectangle' ? 'rounded-[20px]' : 'rounded-[24px]',
        className,
      )}
      {...props}
    >
      {/* Dynamic Ambient Glow matching extracted album accent */}
      <div
        className={cn(
          "absolute -inset-2 bg-[var(--accent,#1db954)] opacity-15 blur-2xl pointer-events-none -z-10 transition-all duration-500",
          islandShape === 'rectangle' ? 'rounded-[26px]' : 'rounded-[30px]'
        )}
        aria-hidden="true"
      />

      {/* Top Section: Album Art + Track Meta + Divider + Centered Synced Lyrics + 3-Bar Equalizer */}
      <div className="flex items-center gap-2.5 h-[72px] w-full min-w-0">
        {/* Left: Authentic Ksync Album Artwork with Vinyl Toggle */}
        <div
          className={cn(
            "art-wrapper shrink-0 cursor-pointer relative",
            isCircleArt && "circle-rotating-art",
            isPlaying ? "is-playing" : "is-paused"
          )}
          onClick={toggleCircleArt}
          role="button"
          tabIndex={0}
          title={isCircleArt ? "Click to switch to standard album art" : "Click to switch to rotating circular vinyl art"}
          style={{
            width: '64px',
            height: '64px',
            minWidth: '64px',
            maxWidth: '64px',
            borderRadius: isCircleArt ? '50%' : '14px',
          }}
        >
          {/* Dynamic Circular Audio Spectrum Visualizer (on rotating circular vinyl) */}
          {isCircleArt && (
            <CircularAudioVisualizer
              isPlaying={isPlaying}
              progress={currentTime}
              bpm={120}
              discRadius={32}
              size={130}
            />
          )}

          {/* Propagating Harmonic Wave Ripples */}
          {isCircleArt ? (
            <div className={cn("compact-circle-waves", isPlaying ? "is-playing" : "is-paused")} aria-hidden="true">
              <div className="compact-wave-ripple ripple-1" />
              <div className="compact-wave-ripple ripple-2" />
            </div>
          ) : (
            <div className={cn("compact-square-waves", isPlaying ? "is-playing" : "is-paused")} aria-hidden="true">
              <div className="compact-square-ripple ripple-1" />
              <div className="compact-square-ripple ripple-2" />
            </div>
          )}

          <div className="art-ambient-tint" />
          <div className="art-disc-inner">
            {artworkUrl ? (
              <img
                src={artworkUrl}
                alt="Album Art"
                className="art-img art-img-current"
                onError={(e) => {
                  // @ts-ignore
                  e.target.src = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&auto=format&fit=crop&q=80';
                }}
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-white/10">
                <AudioLinesIcon aria-hidden="true" className="size-7 text-white/40" />
              </div>
            )}
          </div>

          {isCircleArt && (
            <div className="art-vinyl-spindle">
              <div className="art-vinyl-spindle-dot" />
            </div>
          )}
        </div>

        {/* Track Title and Artist Meta (Hover to reveal Queue) */}
        <div
          className={cn(
            "shrink-0 flex flex-col justify-center cursor-pointer group/meta overflow-hidden",
            hasLyrics
              ? (islandShape === 'rectangle' ? "w-[155px] sm:w-[175px]" : "w-[120px] sm:w-[135px]")
              : "flex-1 min-w-0 pr-3"
          )}
          onMouseEnter={handleQueueEnter}
          onMouseLeave={handleQueueLeave}
          title="Hover to view upcoming queue"
        >
          <div className="w-full overflow-hidden">
            <MarqueeText
              text={title || 'No Track Playing'}
              className="font-bold text-white text-[13.5px] leading-snug tracking-[-0.01em] group-hover/meta:text-[var(--accent,#1db954)] transition-colors"
              speed={28}
            />
          </div>
          <p className="m-0 p-0 mt-0.5 truncate text-[11px] text-white/60 font-medium">
            {subtitle || 'Spotify / SMTC'}
          </p>
        </div>

        {/* Subtle Vertical Hairline Divider - Only when lyrics exist */}
        {hasLyrics && (
          <div className="h-9 w-px bg-white/10 shrink-0 mx-1.5 self-center" aria-hidden="true" />
        )}

        {/* Center: Real-time Synchronized Karaoke Lyrics Stage (Centralized inside section) */}
        {hasLyrics && (
          <div className="flex-1 min-w-0 h-full flex flex-col justify-center items-center gap-0.5 px-2 overflow-hidden text-center select-none relative group/lyrics">
            {currentLine ? (
              <>
                {/* Previous Line */}
                <p
                  onClick={() => handleLyricClick(prevLine)}
                  title={prevLine ? `Jump to: ${prevLine.text || prevLine.words}` : undefined}
                  className={cn(
                    "m-0 p-0 text-[10.5px] w-full text-center truncate leading-tight block transition-colors duration-200",
                    prevLine
                      ? "text-white/40 hover:text-white/80 cursor-pointer"
                      : "opacity-0 pointer-events-none select-none"
                  )}
                  style={{ height: '14px', lineHeight: '14px' }}
                >
                  {prevLine?.text || prevLine?.words || ' '}
                </p>

                {/* Current Active Line (Crisp White with Radiant Accent Glow) */}
                <p
                  onClick={() => handleLyricClick(currentLine)}
                  title="Click to replay phrase"
                  className="m-0 p-0 text-[13.5px] w-full text-center font-bold text-white drop-shadow-[0_0_8px_var(--accent,#38bdf8)] leading-snug line-clamp-2 transition-all duration-200 hover:scale-[1.01] cursor-pointer block"
                  style={{ minHeight: '18px' }}
                >
                  {currentLine.text || currentLine.words || (isPlaying ? '...' : '')}
                </p>

                {/* Next Line */}
                <p
                  onClick={() => handleLyricClick(nextLine)}
                  title={nextLine ? `Jump to: ${nextLine.text || nextLine.words}` : undefined}
                  className={cn(
                    "m-0 p-0 text-[10.5px] w-full text-center truncate leading-tight block transition-colors duration-200",
                    nextLine
                      ? "text-white/40 hover:text-white/80 cursor-pointer"
                      : "opacity-0 pointer-events-none select-none"
                  )}
                  style={{ height: '14px', lineHeight: '14px' }}
                >
                  {nextLine?.text || nextLine?.words || ' '}
                </p>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-white/35 text-[11px] italic tracking-wide">
                <span>{isPlaying ? '♪ Instrumental / No lyrics ♪' : 'Paused'}</span>
              </div>
            )}
          </div>
        )}

        {/* Far Right: Animated 3-Bar Audio Pulse Equalizer */}
        <div
          className="flex items-end justify-center gap-[3px] h-5 shrink-0 px-1 select-none pointer-events-none"
          title={isPlaying ? "Playing audio" : "Paused"}
          aria-hidden="true"
        >
          <span
            className={cn(
              "w-[3px] rounded-full bg-[var(--accent,#1db954)] transition-all duration-300",
              !isPlaying && "opacity-40"
            )}
            style={{
              height: isPlaying ? '10px' : '5px',
              animation: isPlaying ? 'islandBarBounce1 0.85s ease-in-out infinite alternate' : 'none',
            }}
          />
          <span
            className={cn(
              "w-[3px] rounded-full bg-[var(--accent,#1db954)] transition-all duration-300",
              !isPlaying && "opacity-40"
            )}
            style={{
              height: isPlaying ? '18px' : '9px',
              animation: isPlaying ? 'islandBarBounce2 0.75s ease-in-out infinite alternate 0.15s' : 'none',
            }}
          />
          <span
            className={cn(
              "w-[3px] rounded-full bg-[var(--accent,#1db954)] transition-all duration-300",
              !isPlaying && "opacity-40"
            )}
            style={{
              height: isPlaying ? '13px' : '6px',
              animation: isPlaying ? 'islandBarBounce3 0.95s ease-in-out infinite alternate 0.08s' : 'none',
            }}
          />
        </div>
      </div>

      {/* Dynamic Audio Wave Progress Bar */}
      <div className="flex items-center gap-2.5 w-full px-1 select-none">
        <span className="shrink-0 text-[11px] font-mono tabular-nums text-white/50 w-8 text-left select-none">
          {formatTime(currentTime)}
        </span>

        <div
          ref={seekTrackRef}
          className={cn(
            "seekbar-track wave-seekbar-track relative flex-1 h-[14px] bg-transparent cursor-pointer select-none flex items-center group/seek",
            (isHoveringSeek || isSeekDragging) && "hovered"
          )}
          onPointerDown={handleSeekPointerDown}
          onMouseEnter={() => setIsHoveringSeek(true)}
          onMouseLeave={() => setIsHoveringSeek(false)}
          onMouseMove={handleSeekMouseMove}
        >
          {(isHoveringSeek || isSeekDragging) && hoverTime !== null && (
            <div
              className="seekbar-hover-tooltip absolute -top-7 -translate-x-1/2 bg-[rgba(10,12,18,0.95)] text-white font-mono text-[10.5px] px-2 py-0.5 rounded-md border border-white/20 pointer-events-none z-30 shadow-xl"
              style={{ left: `${hoverPercent}%` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}

          {/* Dynamic Animated Wave Bars */}
          <div className={`wave-bars-container ${isPlaying ? 'is-playing' : 'is-paused'}`}>
            {WAVE_BARS.map((baseHeight, idx) => {
              const barPct = (idx / (WAVE_BARS.length - 1)) * 100;
              const isPlayed = barPct <= progressPercent;
              const isHovered = (isHoveringSeek || isSeekDragging) && barPct <= hoverPercent;

              return (
                <span
                  key={idx}
                  className={`wave-bar ${isPlayed ? 'played' : 'unplayed'} ${isHovered ? 'hover-fill' : ''}`}
                  style={{
                    '--bar-base-h': `${baseHeight}%`,
                    '--bar-delay': `${(idx % 8) * -0.12}s`,
                  } as React.CSSProperties}
                />
              );
            })}
          </div>

          {/* Flat Solid Progress Bar on Pause */}
          <div className={cn("flat-progress-container", !isPlaying && "active")}>
            <div
              className="flat-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Draggable Circular White Thumb Knob on Hover */}
          <div
            className={cn(
              "seekbar-thumb wave-thumb absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-2.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9),0_0_10px_var(--accent,#1db954)] transition-opacity duration-150 pointer-events-none z-10",
              (isHoveringSeek || isSeekDragging) ? "opacity-100 scale-110" : "opacity-0"
            )}
            style={{ left: `${progressPercent}%` }}
          />
        </div>

        <button
          type="button"
          className="shrink-0 text-[11px] font-mono tabular-nums text-white/50 hover:text-white transition-colors cursor-pointer border-none bg-transparent p-0 w-9 text-right select-none"
          onClick={() => setShowRemaining((prev) => !prev)}
          title={showRemaining ? "Switch to total duration" : "Switch to remaining time"}
        >
          {showRemaining ? `−${formatTime(Math.max(0, duration - currentTime))}` : formatTime(duration)}
        </button>
      </div>

      {/* Control Actions Row (Symmetric & Centered) */}
      <div className="relative flex items-center justify-between px-1">
        {/* Left cluster: Upcoming Queue Hover Trigger & Shuffle */}
        <div className="flex items-center gap-1">
          <Button
            aria-label="Upcoming Queue"
            onMouseEnter={handleQueueEnter}
            onMouseLeave={handleQueueLeave}
            className={cn(
              "size-8 transition-colors",
              isQueueHovered ? "!bg-white/20 text-white" : "text-white/50 hover:text-white hover:!bg-white/10"
            )}
            size="icon-sm"
            variant="ghost"
            title="Upcoming Queue (Hover to view)"
          >
            <ListMusic className="size-4" />
          </Button>

          {onShuffle && (
            <Button
              aria-label="Shuffle playback"
              onClick={onShuffle}
              className={cn(
                'size-8 transition-colors relative',
                shuffleState
                  ? 'text-[var(--accent,#1db954)] hover:text-[var(--accent,#1db954)] hover:!bg-white/10'
                  : 'text-white/40 hover:text-white hover:!bg-white/10'
              )}
              size="icon-sm"
              variant="ghost"
              title={shuffleState ? 'Shuffle on' : 'Shuffle off'}
            >
              <Shuffle className="size-4" />
              {shuffleState && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 size-1 rounded-full bg-[var(--accent,#1db954)]" />
              )}
            </Button>
          )}
        </div>

        {/* Center cluster: Previous, Play/Pause, Next (Locked Dead-Center) */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
          {/* Previous Track */}
          <Button
            aria-label={onPrevious ? 'Previous track' : 'Rewind 10 seconds'}
            disabled={!onPrevious && !onChange}
            onClick={() => (onPrevious ? onPrevious() : onChange?.(Math.max(0, currentTime - 10)))}
            className="size-10 text-white/80 hover:text-white hover:!bg-white/10 active:scale-90"
            size="icon"
            variant="ghost"
          >
            <PreviousIcon className="size-6" />
          </Button>

          {/* Play / Pause Primary Button */}
          <Button
            aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
            disabled={!onToggle}
            onClick={onToggle}
            className="size-12 rounded-full !bg-white !text-black hover:scale-105 active:scale-95 shadow-[0_4px_16px_rgba(255,255,255,0.28)] flex items-center justify-center cursor-pointer border-none"
            size="icon-lg"
            variant="default"
          >
            {isPlaying ? (
              <PauseIcon className="size-6 text-black fill-current" />
            ) : (
              <PlayIcon className="size-6 text-black fill-current ml-0.5" />
            )}
          </Button>

          {/* Next Track */}
          <Button
            aria-label={onNext ? 'Next track' : 'Forward 10 seconds'}
            disabled={!onNext && !onChange}
            onClick={() => (onNext ? onNext() : onChange?.(Math.min(duration || 180, currentTime + 10)))}
            className="size-10 text-white/80 hover:text-white hover:!bg-white/10 active:scale-90"
            size="icon"
            variant="ghost"
          >
            <NextIcon className="size-6" />
          </Button>
        </div>

        {/* Right cluster: Repeat, Spotify Volume, System Volume & Settings */}
        <div className="flex items-center gap-1">
          {onRepeat && (
            <Button
              aria-label="Repeat playback"
              onClick={onRepeat}
              className={cn(
                'size-8 transition-colors relative',
                isRepeatActive
                  ? 'text-[var(--accent,#1db954)] hover:text-[var(--accent,#1db954)] hover:!bg-white/10'
                  : 'text-white/40 hover:text-white hover:!bg-white/10'
              )}
              size="icon-sm"
              variant="ghost"
              title={repeatState === 'track' ? 'Repeat track' : isRepeatActive ? 'Repeat context' : 'Repeat off'}
            >
              {repeatState === 'track' ? <Repeat1 className="size-4" /> : <Repeat className="size-4" />}
              {isRepeatActive && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 size-1 rounded-full bg-[var(--accent,#1db954)]" />
              )}
            </Button>
          )}

          {/* 1. Spotify In-App Volume Control */}
          <div
            className="relative flex items-center"
            onMouseEnter={handleSpotifyEnter}
            onMouseLeave={handleSpotifyLeave}
          >
            <Button
              aria-label={localSpotifyVolume === 0 ? 'Unmute Spotify' : 'Mute Spotify'}
              onClick={toggleSpotifyMute}
              onWheel={(e) => {
                triggerSpotifyInteraction()
                handleSpotifyWheel(e)
              }}
              className={cn(
                "size-8 transition-colors relative",
                localSpotifyVolume === 0
                  ? "text-white/40 hover:text-white/80 hover:!bg-white/10"
                  : isSpotifyActive
                  ? "text-[var(--accent,#1db954)] hover:!bg-white/10"
                  : "text-white/50 hover:text-white hover:!bg-white/10"
              )}
              size="icon-sm"
              variant="ghost"
              title={localSpotifyVolume === 0 ? "Unmute Spotify" : `Spotify Volume: ${localSpotifyVolume}% (Scroll to adjust, click to mute)`}
            >
              {localSpotifyVolume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </Button>

            {/* Floating Glass Spotify Volume Flyout */}
            <div
              className={cn(
                "absolute bottom-full mb-2.5 right-0 z-50 rounded-xl bg-[rgba(14,16,24,0.96)] backdrop-blur-2xl border border-white/15 px-3 py-2 shadow-[0_12px_36px_rgba(0,0,0,0.85)] flex flex-col gap-1.5 transition-all duration-150 select-none w-36 pointer-events-auto",
                isSpotifyActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1.5 pointer-events-none"
              )}
              onWheel={(e) => {
                triggerSpotifyInteraction()
                handleSpotifyWheel(e)
              }}
            >
              <div className="flex items-center justify-between text-[11px] font-medium leading-none">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={toggleSpotifyMute}
                    className="text-white/60 hover:text-[var(--accent,#1db954)] transition-colors cursor-pointer border-none bg-transparent p-0 flex items-center"
                    title={localSpotifyVolume === 0 ? "Unmute Spotify" : "Mute Spotify"}
                  >
                    {localSpotifyVolume === 0 ? (
                      <VolumeX className="size-3.5 text-white/40" />
                    ) : (
                      <Volume2 className="size-3.5 text-[var(--accent,#1db954)]" />
                    )}
                  </button>
                  <span className="text-[var(--accent,#1db954)] font-semibold text-[10.5px]">Spotify</span>
                </div>
                <span className="font-mono text-[10.5px] text-white/80 tabular-nums">{localSpotifyVolume}%</span>
              </div>

              <div
                ref={spotifyTrackRef}
                className="w-full h-2 bg-white/15 rounded-full relative cursor-pointer flex items-center group/track"
                onPointerDown={handleSpotifyPointerDown}
              >
                <div
                  className="h-full bg-[var(--accent,#1db954)] rounded-full group-hover/track:brightness-110 transition-[width] duration-75"
                  style={{ width: `${localSpotifyVolume}%` }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-3 rounded-full bg-white shadow-md pointer-events-none transition-transform group-hover/track:scale-125"
                  style={{ left: `${localSpotifyVolume}%` }}
                />
              </div>
            </div>
          </div>

          {onOutput && (
            <Button
              aria-label="Audio output"
              onClick={onOutput}
              className="size-8 text-white/50 hover:text-white hover:!bg-white/10"
              size="icon-sm"
              variant="ghost"
              title="Ksync Settings"
            >
              <AirbudsIcon className="size-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Floating Glass Upcoming Queue Overlay (Revealed on hover over track title or queue button) */}
      <div
        className={cn(
          "absolute inset-2.5 rounded-[18px] bg-[rgba(10,12,18,0.97)] backdrop-blur-2xl border border-white/15 p-3 flex flex-col justify-between shadow-[0_20px_50px_rgba(0,0,0,0.85)] z-40 transition-all duration-200 ease-out",
          isQueueHovered
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-2 pointer-events-none"
        )}
        onMouseEnter={handleQueueEnter}
        onMouseLeave={handleQueueLeave}
      >
        {/* Queue Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-1.5 shrink-0">
          <div className="flex items-center gap-2">
            <ListMusic className="size-4 text-[var(--accent,#1db954)]" />
            <span className="text-xs font-bold text-white tracking-tight">Up Next in Queue</span>
            {queue.length > 0 && (
              <span className="text-[10px] text-white/50 font-mono bg-white/10 px-1.5 py-0.5 rounded-full">
                {queue.length}
              </span>
            )}
          </div>
          <span className="text-[10px] text-white/40 italic">Click song to play</span>
        </div>

        {/* Scrollable list of upcoming tracks */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scroll">
          {queue.length > 0 ? (
            queue.map((qTrack, i) => (
              <div
                key={qTrack.id || i}
                onClick={() => onPlayTrack && onPlayTrack(qTrack.uri || `spotify:track:${qTrack.id}`, i + 1, qTrack)}
                className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-white/10 cursor-pointer text-xs transition-colors group/item"
              >
                <span className="text-white/40 text-[10px] w-4 font-mono text-center group-hover/item:text-[var(--accent,#1db954)]">
                  {i + 1}
                </span>
                <div className="truncate flex-1">
                  <span className="text-white truncate block font-medium group-hover/item:text-[var(--accent,#1db954)] transition-colors">
                    {qTrack.title || qTrack.name}
                  </span>
                  <span className="text-white/50 text-[10.5px] truncate block">
                    {qTrack.artist || 'Spotify'}
                  </span>
                </div>
                {qTrack.durationMs && (
                  <span className="text-white/40 text-[10.5px] font-mono shrink-0">
                    {Math.floor(qTrack.durationMs / 60000)}:{Math.floor((qTrack.durationMs % 60000) / 1000).toString().padStart(2, '0')}
                  </span>
                )}
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-white/40 text-xs py-4">
              <ListMusic className="size-5 mb-1 opacity-50" />
              <span>No upcoming tracks in queue</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export { AudioPlayer }
export type { AudioPlayerProps }
export default AudioPlayer
