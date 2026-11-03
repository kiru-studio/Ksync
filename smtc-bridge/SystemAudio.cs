using System;
using System.Runtime.InteropServices;
using System.Text.Json;

namespace smtc_bridge
{
    [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IAudioEndpointVolume
    {
        int RegisterControlChangeNotify(IAudioEndpointVolumeCallback pNotify);
        int UnregisterControlChangeNotify(IAudioEndpointVolumeCallback pNotify);
        int GetChannelCount(out uint pnChannelCount);
        int SetMasterVolumeLevel(float fLevelDB, IntPtr pguidEventContext);
        int SetMasterVolumeLevelScalar(float fLevel, IntPtr pguidEventContext);
        int GetMasterVolumeLevel(out float pfLevelDB);
        int GetMasterVolumeLevelScalar(out float pfLevel);
        int SetChannelVolumeLevel(uint nChannel, float fLevelDB, IntPtr pguidEventContext);
        int SetChannelVolumeLevelScalar(uint nChannel, float fLevel, IntPtr pguidEventContext);
        int GetChannelVolumeLevel(uint nChannel, out float pfLevelDB);
        int GetChannelVolumeLevelScalar(uint nChannel, out float pfLevel);
        int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, IntPtr pguidEventContext);
        int GetMute([MarshalAs(UnmanagedType.Bool)] out bool pbMute);
        int GetVolumeStepInfo(out uint pnStep, out uint pnStepCount);
        int VolumeStepUp(IntPtr pguidEventContext);
        int VolumeStepDown(IntPtr pguidEventContext);
        int QueryHardwareSupport(out uint pdwHardwareSupportMask);
        int GetVolumeRange(out float pflVolumeMindB, out float pflVolumeMaxdB, out float pflVolumeIncrementdB);
    }

    [Guid("657804FA-D6AD-4496-8560-E5D522730D73"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IAudioEndpointVolumeCallback
    {
        int OnNotify(IntPtr pNotify);
    }

    [StructLayout(LayoutKind.Sequential)]
    internal struct AUDIO_VOLUME_NOTIFICATION_DATA
    {
        public Guid guidEventContext;
        [MarshalAs(UnmanagedType.Bool)]
        public bool bMuted;
        public float fMasterVolume;
        public uint nChannels;
    }

    [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IMMDevice
    {
        int Activate(ref Guid id, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object interfacePointer);
    }

    [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IMMDeviceEnumerator
    {
        int EnumAudioEndpoints(int dataFlow, int stateMask, out IntPtr devices);
        int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
    }

    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    internal class MMDeviceEnumeratorComObject
    {
    }

    [Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IAudioSessionManager2
    {
        int GetAudioSessionControl(IntPtr AudioSessionGuid, uint StreamFlags, out IntPtr SessionControl);
        int GetSimpleAudioVolume(IntPtr AudioSessionGuid, uint StreamFlags, out IntPtr AudioVolume);
        int GetSessionEnumerator(out IAudioSessionEnumerator SessionEnum);
        int RegisterSessionNotification(IntPtr NewSession);
        int UnregisterSessionNotification(IntPtr NewSession);
        int RegisterDuckNotification(string sessionID, IntPtr duckNotification);
        int UnregisterDuckNotification(IntPtr duckNotification);
    }

    [Guid("E2F5EE11-07C5-4DC4-B584-26347A22F324"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IAudioSessionEnumerator
    {
        int GetCount(out int SessionCount);
        int GetSession(int SessionIndex, out IAudioSessionControl Session);
    }

    [Guid("F4B1A599-7266-4319-A8CA-E70ACB11E8CD"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IAudioSessionControl
    {
        int GetState(out int pRetVal);
        int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
        int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string Value, IntPtr EventContext);
        int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
        int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string Value, IntPtr EventContext);
        int GetGroupingParam(out Guid pRetVal);
        int SetGroupingParam(ref Guid Override, IntPtr EventContext);
        int RegisterAudioSessionNotification(IntPtr NewNotifications);
        int UnregisterAudioSessionNotification(IntPtr NewNotifications);
    }

    [Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C37"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IAudioSessionControl2 : IAudioSessionControl
    {
        new int GetState(out int pRetVal);
        new int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
        new int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string Value, IntPtr EventContext);
        new int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
        new int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string Value, IntPtr EventContext);
        new int GetGroupingParam(out Guid pRetVal);
        new int SetGroupingParam(ref Guid Override, IntPtr EventContext);
        new int RegisterAudioSessionNotification(IntPtr NewNotifications);
        new int UnregisterAudioSessionNotification(IntPtr NewNotifications);

        int GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
        int GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
        int GetProcessId(out uint pRetVal);
        int IsSystemSoundsSession();
        int SetDuckingPreference([MarshalAs(UnmanagedType.Bool)] bool optOut);
    }

    [Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface ISimpleAudioVolume
    {
        int SetMasterVolume(float fLevel, IntPtr EventContext);
        int GetMasterVolume(out float pfLevel);
        int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, IntPtr EventContext);
        int GetMute([MarshalAs(UnmanagedType.Bool)] out bool pbMute);
    }

    internal class AudioEndpointVolumeCallback : IAudioEndpointVolumeCallback
    {
        private readonly Action<int, bool> _onVolumeChanged;

        public AudioEndpointVolumeCallback(Action<int, bool> onVolumeChanged)
        {
            _onVolumeChanged = onVolumeChanged;
        }

        public int OnNotify(IntPtr pNotify)
        {
            try
            {
                if (pNotify != IntPtr.Zero)
                {
                    var data = Marshal.PtrToStructure<AUDIO_VOLUME_NOTIFICATION_DATA>(pNotify);
                    int vol = (int)Math.Round(data.fMasterVolume * 100f);
                    _onVolumeChanged?.Invoke(vol, data.bMuted);
                }
            }
            catch { }
            return 0; // S_OK
        }
    }

    public static class SystemAudio
    {
        private static IAudioEndpointVolume? _endpointVolume;
        private static AudioEndpointVolumeCallback? _callback;
        private static readonly object _syncRoot = new object();
        private static int _lastReportedVolume = -1;
        private static bool _lastReportedMute = false;

        public static void Initialize()
        {
            lock (_syncRoot)
            {
                try
                {
                    EnsureEndpoint();
                    BroadcastCurrentVolume();
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"[SystemAudio] Init error: {ex.Message}");
                }
            }
        }

        private static void EnsureEndpoint()
        {
            if (_endpointVolume != null) return;

            var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
            if (enumerator == null) return;

            // 0 = eRender, 1 = eMultimedia
            int hr = enumerator.GetDefaultAudioEndpoint(0, 1, out IMMDevice dev);
            if (hr != 0 || dev == null) return;

            var iid = typeof(IAudioEndpointVolume).GUID;
            hr = dev.Activate(ref iid, 23 /* CLSCTX_ALL */, IntPtr.Zero, out object iface);
            if (hr != 0 || iface == null) return;

            _endpointVolume = (IAudioEndpointVolume)iface;

            _callback = new AudioEndpointVolumeCallback(OnVolumeNotification);
            _endpointVolume.RegisterControlChangeNotify(_callback);
        }

        private static void OnVolumeNotification(int volume, bool isMuted)
        {
            if (volume == _lastReportedVolume && isMuted == _lastReportedMute) return;
            _lastReportedVolume = volume;
            _lastReportedMute = isMuted;

            Console.WriteLine(JsonSerializer.Serialize(new
            {
                type = "systemVolume",
                volume = volume,
                isMuted = isMuted
            }));
            Console.Out.Flush();
        }

        public static void BroadcastCurrentVolume()
        {
            lock (_syncRoot)
            {
                try
                {
                    EnsureEndpoint();
                    if (_endpointVolume == null) return;

                    _endpointVolume.GetMasterVolumeLevelScalar(out float vol);
                    _endpointVolume.GetMute(out bool isMuted);
                    int volume = (int)Math.Round(vol * 100f);
                    _lastReportedVolume = volume;
                    _lastReportedMute = isMuted;

                    Console.WriteLine(JsonSerializer.Serialize(new
                    {
                        type = "systemVolume",
                        volume = volume,
                        isMuted = isMuted
                    }));
                    Console.Out.Flush();

                    int spotifyVol = GetProcessVolume("Spotify");
                    if (spotifyVol >= 0)
                    {
                        Console.WriteLine(JsonSerializer.Serialize(new
                        {
                            type = "spotifyVolume",
                            volume = spotifyVol
                        }));
                        Console.Out.Flush();
                    }
                }
                catch { }
            }
        }

        public static void SetVolume(int volume)
        {
            lock (_syncRoot)
            {
                try
                {
                    EnsureEndpoint();
                    if (_endpointVolume == null) return;

                    float scalar = Math.Clamp(volume / 100f, 0f, 1f);
                    _endpointVolume.SetMasterVolumeLevelScalar(scalar, IntPtr.Zero);
                    
                    // Unmute if setting volume above 0 while muted
                    _endpointVolume.GetMute(out bool isMuted);
                    if (isMuted && volume > 0)
                    {
                        _endpointVolume.SetMute(false, IntPtr.Zero);
                    }
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"[SystemAudio] SetVolume error: {ex.Message}");
                }
            }
        }

        public static void SetMute(bool isMuted)
        {
            lock (_syncRoot)
            {
                try
                {
                    EnsureEndpoint();
                    if (_endpointVolume == null) return;

                    _endpointVolume.SetMute(isMuted, IntPtr.Zero);
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"[SystemAudio] SetMute error: {ex.Message}");
                }
            }
        }

        /// <summary>
        /// Control the audio session volume of a specific desktop application (e.g. "Spotify") via WASAPI.
        /// Works on all Windows devices for both Spotify Free and Premium users without requiring Web API tokens.
        /// </summary>
        public static bool SetProcessVolume(string processName, int volume)
        {
            lock (_syncRoot)
            {
                try
                {
                    var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
                    if (enumerator == null) return false;

                    int hr = enumerator.GetDefaultAudioEndpoint(0, 1, out IMMDevice dev);
                    if (hr != 0 || dev == null) return false;

                    var iid = typeof(IAudioSessionManager2).GUID;
                    hr = dev.Activate(ref iid, 23 /* CLSCTX_ALL */, IntPtr.Zero, out object iface);
                    if (hr != 0 || iface == null) return false;

                    var mgr = (IAudioSessionManager2)iface;
                    hr = mgr.GetSessionEnumerator(out IAudioSessionEnumerator sessionEnum);
                    if (hr != 0 || sessionEnum == null) return false;

                    sessionEnum.GetCount(out int count);
                    float targetScalar = Math.Clamp(volume / 100f, 0f, 1f);
                    bool found = false;

                    for (int i = 0; i < count; i++)
                    {
                        sessionEnum.GetSession(i, out IAudioSessionControl ctrl);
                        if (ctrl is IAudioSessionControl2 ctrl2)
                        {
                            ctrl2.GetProcessId(out uint pid);
                            if (pid > 0)
                            {
                                try
                                {
                                    var proc = System.Diagnostics.Process.GetProcessById((int)pid);
                                    if (proc.ProcessName.Contains(processName, StringComparison.OrdinalIgnoreCase))
                                    {
                                        if (ctrl is ISimpleAudioVolume simpleVol)
                                        {
                                            simpleVol.SetMasterVolume(targetScalar, IntPtr.Zero);
                                            if (volume > 0)
                                            {
                                                simpleVol.SetMute(false, IntPtr.Zero);
                                            }
                                            found = true;
                                        }
                                    }
                                }
                                catch { }
                            }
                        }
                    }
                    return found;
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"[SystemAudio] SetProcessVolume error: {ex.Message}");
                    return false;
                }
            }
        }

        public static int GetProcessVolume(string processName)
        {
            lock (_syncRoot)
            {
                try
                {
                    var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
                    if (enumerator == null) return -1;

                    int hr = enumerator.GetDefaultAudioEndpoint(0, 1, out IMMDevice dev);
                    if (hr != 0 || dev == null) return -1;

                    var iid = typeof(IAudioSessionManager2).GUID;
                    hr = dev.Activate(ref iid, 23 /* CLSCTX_ALL */, IntPtr.Zero, out object iface);
                    if (hr != 0 || iface == null) return -1;

                    var mgr = (IAudioSessionManager2)iface;
                    hr = mgr.GetSessionEnumerator(out IAudioSessionEnumerator sessionEnum);
                    if (hr != 0 || sessionEnum == null) return -1;

                    sessionEnum.GetCount(out int count);
                    for (int i = 0; i < count; i++)
                    {
                        sessionEnum.GetSession(i, out IAudioSessionControl ctrl);
                        if (ctrl is IAudioSessionControl2 ctrl2)
                        {
                            ctrl2.GetProcessId(out uint pid);
                            if (pid > 0)
                            {
                                try
                                {
                                    var proc = System.Diagnostics.Process.GetProcessById((int)pid);
                                    if (proc.ProcessName.Contains(processName, StringComparison.OrdinalIgnoreCase))
                                    {
                                        if (ctrl is ISimpleAudioVolume simpleVol)
                                        {
                                            simpleVol.GetMasterVolume(out float level);
                                            return (int)Math.Round(level * 100f);
                                        }
                                    }
                                }
                                catch { }
                            }
                        }
                    }
                    return -1;
                }
                catch
                {
                    return -1;
                }
            }
        }
    }
}
