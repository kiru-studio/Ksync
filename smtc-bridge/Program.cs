using System;
using System.Text.Json;
using System.Threading.Tasks;
using WindowsMediaController;
using static WindowsMediaController.MediaManager;
using Windows.Media.Control;
using System.IO;

namespace smtc_bridge
{
    class Program
    {
        private static MediaManager? _mediaManager;
        private static MediaSession? _spotifySession;
        private static bool _canSeek = false;
        private static readonly object _lock = new object();
        
        static async Task Main(string[] args)
        {
            Console.OutputEncoding = System.Text.Encoding.UTF8;

            // Initialize Windows CoreAudio system volume monitoring & control
            SystemAudio.Initialize();
            
            _mediaManager = new MediaManager();
            _mediaManager.OnAnySessionOpened += MediaManager_OnAnySessionOpened;
            _mediaManager.OnAnySessionClosed += MediaManager_OnAnySessionClosed;

            _mediaManager.Start();

            // Check existing
            foreach (var session in _mediaManager.CurrentMediaSessions.Values)
            {
                if (session.Id.Contains("spotify", StringComparison.OrdinalIgnoreCase))
                {
                    AttachSession(session);
                    break;
                }
            }

            if (_spotifySession == null)
            {
                Console.WriteLine("{\"type\":\"noSession\"}");
                Console.Out.Flush();
            }

            // Start listening on stdin
            _ = Task.Run(ReadStdin);

            // Keep alive
            await Task.Delay(-1);
        }

        private static void MediaManager_OnAnySessionOpened(MediaSession session)
        {
            lock (_lock)
            {
                if (_spotifySession == null && session.Id.Contains("spotify", StringComparison.OrdinalIgnoreCase))
                {
                    AttachSession(session);
                }
            }
        }

        private static void MediaManager_OnAnySessionClosed(MediaSession session)
        {
            lock (_lock)
            {
                if (_spotifySession != null && session.Id == _spotifySession.Id)
                {
                    DetachSession(session);
                    Console.WriteLine("{\"type\":\"noSession\"}");
                    Console.Out.Flush();
                }
            }
        }

        private static void AttachSession(MediaSession session)
        {
            _spotifySession = session;
            _spotifySession.OnPlaybackStateChanged += Session_OnPlaybackStateChanged;
            _spotifySession.OnMediaPropertyChanged += Session_OnMediaPropertyChanged;
            _spotifySession.OnTimelinePropertyChanged += Session_OnTimelinePropertyChanged;
            
            // Force an initial update
            UpdateState();
        }

        private static void DetachSession(MediaSession session)
        {
            if (_spotifySession != null)
            {
                _spotifySession.OnPlaybackStateChanged -= Session_OnPlaybackStateChanged;
                _spotifySession.OnMediaPropertyChanged -= Session_OnMediaPropertyChanged;
                _spotifySession.OnTimelinePropertyChanged -= Session_OnTimelinePropertyChanged;
            }
            _spotifySession = null;
        }

        private static void Session_OnMediaPropertyChanged(MediaSession session, GlobalSystemMediaTransportControlsSessionMediaProperties mediaProperties)
        {
            _lastArtBase64 = null; // Invalidate thumbnail cache on media change
            UpdateState();
        }

        private static void Session_OnPlaybackStateChanged(MediaSession session, GlobalSystemMediaTransportControlsSessionPlaybackInfo playbackInfo)
        {
            UpdateState();
        }

        private static void Session_OnTimelinePropertyChanged(MediaSession session, GlobalSystemMediaTransportControlsSessionTimelineProperties timelineProperties)
        {
            UpdateState();
        }

        private static string? _lastArtBase64 = null;

        private static void UpdateState()
        {
            if (_spotifySession == null) return;
            try
            {
                var mediaPropertiesTask = _spotifySession.ControlSession.TryGetMediaPropertiesAsync();
                var mediaProperties = mediaPropertiesTask.GetAwaiter().GetResult();
                var playbackInfo = _spotifySession.ControlSession.GetPlaybackInfo();
                var timelineProperties = _spotifySession.ControlSession.GetTimelineProperties();
                
                string? artBase64 = _lastArtBase64;
                if (artBase64 == null)
                {
                    try {
                        if (mediaProperties.Thumbnail != null)
                        {
                            var stream = mediaProperties.Thumbnail.OpenReadAsync().GetAwaiter().GetResult();
                            using var memStream = new MemoryStream();
                            using (var buffer = stream.AsStreamForRead())
                            {
                                buffer.CopyTo(memStream);
                            }
                            var bytes = memStream.ToArray();
                            if (bytes.Length > 0)
                            {
                                artBase64 = "data:image/jpeg;base64," + Convert.ToBase64String(bytes);
                                _lastArtBase64 = artBase64;
                            }
                        }
                    } catch { }
                }

                _canSeek = playbackInfo.Controls.IsPlaybackPositionEnabled;
                bool isPlaying = playbackInfo.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing;

                // Calculate perfectly accurate position by adding time elapsed since LastUpdatedTime
                var basePos = timelineProperties.Position.TotalMilliseconds;
                if (isPlaying) {
                    var diff = (DateTimeOffset.UtcNow - timelineProperties.LastUpdatedTime).TotalMilliseconds;
                    basePos += Math.Max(0, diff);
                }

                var state = new
                {
                    type = "nowPlaying",
                    title = mediaProperties.Title,
                    artist = mediaProperties.Artist,
                    album = mediaProperties.AlbumTitle,
                    artBase64 = artBase64,
                    isPlaying = isPlaying,
                    positionMs = basePos,
                    durationMs = timelineProperties.EndTime.TotalMilliseconds,
                    canSeek = _canSeek
                };

                Console.WriteLine(JsonSerializer.Serialize(state));
                Console.Out.Flush();
            }
            catch { }
        }

        private static async Task ReadStdin()
        {
            using var reader = new System.IO.StreamReader(Console.OpenStandardInput());
            string? line;
            while ((line = await reader.ReadLineAsync()) != null)
            {
                if (string.IsNullOrWhiteSpace(line)) continue;

                try
                {
                    using JsonDocument doc = JsonDocument.Parse(line);
                    var cmd = doc.RootElement.GetProperty("cmd").GetString();

                    // System audio commands are independent of active Spotify session
                    if (cmd == "getSystemVolume")
                    {
                        SystemAudio.BroadcastCurrentVolume();
                        continue;
                    }
                    if (cmd == "setSystemVolume")
                    {
                        if (doc.RootElement.TryGetProperty("volume", out var volProp))
                        {
                            SystemAudio.SetVolume(volProp.GetInt32());
                        }
                        continue;
                    }
                    if (cmd == "setSystemMute")
                    {
                        if (doc.RootElement.TryGetProperty("isMuted", out var muteProp))
                        {
                            SystemAudio.SetMute(muteProp.GetBoolean());
                        }
                        continue;
                    }
                    if (cmd == "getSpotifyVolume")
                    {
                        int vol = SystemAudio.GetProcessVolume("Spotify");
                        Console.WriteLine(JsonSerializer.Serialize(new { type = "spotifyVolume", volume = vol }));
                        Console.Out.Flush();
                        continue;
                    }
                    if (cmd == "setSpotifyVolume")
                    {
                        if (doc.RootElement.TryGetProperty("volume", out var volProp))
                        {
                            bool ok = SystemAudio.SetProcessVolume("Spotify", volProp.GetInt32());
                            Console.WriteLine(JsonSerializer.Serialize(new { type = "spotifyVolumeResult", success = ok, volume = volProp.GetInt32() }));
                            Console.Out.Flush();
                        }
                        continue;
                    }

                    var session = _spotifySession;
                    if (session == null) continue;

                    switch (cmd)
                    {
                        case "playPause":
                            await session.ControlSession.TryTogglePlayPauseAsync();
                            break;
                        case "play":
                            await session.ControlSession.TryPlayAsync();
                            break;
                        case "pause":
                            await session.ControlSession.TryPauseAsync();
                            break;
                        case "next":
                            await session.ControlSession.TrySkipNextAsync();
                            break;
                        case "previous":
                            await session.ControlSession.TrySkipPreviousAsync();
                            break;
                        case "seek":
                            if (_canSeek)
                            {
                                var posMs = doc.RootElement.GetProperty("positionMs").GetDouble();
                                await session.ControlSession.TryChangePlaybackPositionAsync((long)(posMs * 10000));
                            }
                            break;
                    }
                }
                catch { }
            }
        }
    }
}
