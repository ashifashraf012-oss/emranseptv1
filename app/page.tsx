'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function PrejoinPage() {
  const router = useRouter();

  const [camOn, setCamOn] = useState<boolean>(false);
  const [micOn, setMicOn] = useState<boolean>(false);
  const [joinerName, setJoinerName] = useState<string>('');
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [companionActive, setCompanionActive] = useState<boolean>(false);
  const [micLevel, setMicLevel] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const levelFrameRef = useRef<number>(0);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const MEETING_CODE = 'tap-bnhq-jhw';
  const NAME_KEY = 'meet-prejoin:name';

  const showToast = (message: string) => {
    setToastMsg(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 2600);
  };

  const describeError = (error: any, device: string) => {
    switch (error?.name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return `${device} blocked. Allow it from the icon in the address bar.`;
      case 'NotFoundError':
      case 'OverconstrainedError':
        return `No ${device.toLowerCase()} found on this device.`;
      case 'NotReadableError':
        return `${device} is already in use by another app.`;
      default:
        return `${device} unavailable: ${error?.name ?? 'unknown error'}`;
    }
  };

  // Level Meter for Microphone
  const stopLevelMeter = () => {
    if (levelFrameRef.current) cancelAnimationFrame(levelFrameRef.current);
    levelFrameRef.current = 0;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setMicLevel(0);
  };

  const startLevelMeter = (stream: MediaStream) => {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const audioCtx = new Ctx();
      audioCtxRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      audioCtx.createMediaStreamSource(stream).connect(analyser);

      const resume = () => audioCtx?.resume().catch(() => {});
      resume();

      const samples = new Uint8Array(analyser.fftSize);
      let smoothed = 0;

      const tick = () => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (let i = 0; i < samples.length; i++) {
          const s = samples[i];
          const v = (s - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / samples.length);
        smoothed += (Math.min(1, rms * 6) - smoothed) * 0.25;
        setMicLevel(parseFloat(smoothed.toFixed(3)));
        levelFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
      console.error('Audio level error:', err);
    }
  };

  // Request BOTH Camera and Microphone on load
  const requestBothMediaPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });

      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();

      if (videoTracks.length > 0) {
        const vStream = new MediaStream(videoTracks);
        camStreamRef.current = vStream;
        if (videoRef.current) {
          videoRef.current.srcObject = vStream;
          videoRef.current.play().catch(() => {});
        }
        setCamOn(true);
      }

      if (audioTracks.length > 0) {
        const aStream = new MediaStream(audioTracks);
        micStreamRef.current = aStream;
        startLevelMeter(aStream);
        setMicOn(true);
      }
    } catch (err: any) {
      console.error('Media permission request error:', err);
      // Fallback: try camera alone or mic alone if combined fails
      tryCameraOnly();
      tryMicOnly();
    }
  };

  const tryCameraOnly = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      camStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCamOn(true);
    } catch (e) {}
  };

  const tryMicOnly = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      micStreamRef.current = stream;
      startLevelMeter(stream);
      setMicOn(true);
    } catch (e) {}
  };

  // Manual Toggles
  const toggleCamera = async () => {
    if (!camOn) {
      await tryCameraOnly();
    } else {
      if (camStreamRef.current) {
        camStreamRef.current.getTracks().forEach((t) => t.stop());
        camStreamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      setCamOn(false);
    }
  };

  const toggleMic = async () => {
    if (!micOn) {
      await tryMicOnly();
    } else {
      stopLevelMeter();
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }
      setMicOn(false);
    }
  };

  const releaseAll = () => {
    if (camStreamRef.current) {
      camStreamRef.current.getTracks().forEach((t) => t.stop());
      camStreamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamOn(false);

    stopLevelMeter();
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    setMicOn(false);
  };

  const handleAskToJoin = () => {
    releaseAll();
    router.push('/gogle');
  };

  const handleCopyLink = async () => {
    const link = `https://meet.google.com/${MEETING_CODE}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast('Joining info copied');
    } catch {
      showToast('Joining info copied');
    }
  };

  useEffect(() => {
    const cleanName = (val: any) => String(val ?? '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
    try {
      const stored = localStorage.getItem(NAME_KEY);
      if (stored) setJoinerName(cleanName(stored));
    } catch {}

    // AUTOMATICALLY REQUEST BOTH CAMERA AND MICROPHONE PERMISSIONS ON LOAD
    if (typeof window !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
      requestBothMediaPermissions();
    }

    return () => {
      releaseAll();
    };
  }, []);

  const getInitial = (name: string) => {
    const match = name.match(/[\p{L}\p{N}]/u);
    return match ? match[0].toLocaleUpperCase() : '';
  };

  return (
    <div className="prejoin-container">
      <style jsx global>{`
        :root {
          --bg: #202124;
          --card: #000;
          --sheet: #3a3c3f;
          --chip: #3c4043;
          --purple: #9232be;
          --blue: #1a6ef5;
          --badge: #3c4a5c;
          --badge-ink: #d3e3fd;
          --err-container: #f9dedc;
          --err-ink: #601410;
          --text: #e8eaed;
          --text-dim: #bdc1c6;
          --phone: 420px;
          --font: "Google Sans", "Google Sans Text", "Product Sans", Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        }

        * { box-sizing: border-box; }

        .prejoin-container {
          height: 100vh;
          width: 100vw;
          margin: 0;
          background: #0d0e10;
          color: var(--text);
          font-family: var(--font);
          -webkit-font-smoothing: antialiased;
          display: grid;
          place-items: center;
          overflow: hidden;
        }

        .phone {
          position: relative;
          width: min(100vw, var(--phone));
          height: 100dvh;
          max-height: 100dvh;
          background: var(--bg);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        @media (min-width: 460px) and (min-height: 700px) {
          .phone {
            height: min(92dvh, 880px);
            border-radius: 28px;
            box-shadow: 0 24px 70px rgb(0 0 0 / 0.6);
          }
        }

        .topbar {
          flex: 0 0 auto;
          display: grid;
          grid-template-columns: 48px 1fr 48px;
          align-items: center;
          gap: 4px;
          padding: 14px 10px 10px;
          padding-top: max(14px, env(safe-area-inset-top));
        }

        .topbar-spacer {
          width: 48px;
          height: 48px;
        }

        .icon-btn {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 50%;
          background: transparent;
          color: var(--text);
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          transition: background-color .15s ease;
        }
        .icon-btn:hover { background: rgb(255 255 255 / 0.08); }
        .icon-btn:active { background: rgb(255 255 255 / 0.14); }
        .icon-btn svg { width: 26px; height: 26px; fill: currentColor; }

        .meeting {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          min-width: 0;
          border: 0;
          background: transparent;
          padding: 6px 8px;
          border-radius: 999px;
          color: inherit;
          font: inherit;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }
        .meeting:hover { background: rgb(255 255 255 / 0.06); }

        .badge {
          flex: 0 0 auto;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: var(--badge);
          color: var(--badge-ink);
          display: grid;
          place-items: center;
        }
        .badge svg { width: 20px; height: 20px; fill: currentColor; }

        .code {
          margin: 0;
          font-size: clamp(19px, 6.2vw, 26px);
          font-weight: 400;
          letter-spacing: .1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        main {
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: clamp(14px, 3.4vh, 26px);
          padding: 4px 0 12px;
        }

        .preview {
          position: relative;
          width: 62%;
          max-width: 264px;
          min-height: 0;
          aspect-ratio: 9 / 16.2;
          max-height: 100%;
          background: var(--card);
          border-radius: 28px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          padding-bottom: 5.3%;
          gap: 5.3%;
        }

        .preview video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: scaleX(-1);
          opacity: 0;
          transition: opacity .25s ease;
        }
        .preview.camera-on video { opacity: 1; }

        .avatar {
          position: absolute;
          top: 37%;
          left: 50%;
          translate: -50% -50%;
          width: 77%;
          aspect-ratio: 1;
          min-height: 0;
          overflow: hidden;
          border-radius: 50%;
          background: var(--purple);
          color: #fff;
          display: grid;
          place-items: center;
          container-type: inline-size;
          transition: opacity .2s ease, scale .2s ease;
        }
        .avatar span {
          font-size: 102cqw;
          line-height: 1;
          font-weight: 400;
          translate: 0 1%;
        }
        .avatar svg {
          width: 62%;
          height: 62%;
          fill: #fff;
        }
        .preview.camera-on .avatar { opacity: 0; scale: .9; }

        .controls {
          position: relative;
          display: flex;
          align-items: center;
          gap: 8%;
          z-index: 1;
        }

        .ctl {
          flex: 0 0 auto;
          width: clamp(44px, 11.8vw, 52px);
          height: clamp(44px, 11.8vw, 52px);
          border: 0;
          border-radius: 50%;
          background: var(--chip);
          color: #fff;
          display: grid;
          place-items: center;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          transition: background-color .18s ease, border-radius .18s ease, color .18s ease;
        }
        .ctl svg { width: 55%; height: 55%; fill: currentColor; }
        .ctl:hover { filter: brightness(1.12); }
        .ctl:active { scale: .94; }

        .ctl.off {
          background: var(--err-container);
          color: var(--err-ink);
          border-radius: 28%;
        }

        .identity {
          position: relative;
          z-index: 1;
          width: 86%;
          height: clamp(26px, 6.9vw, 31px);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .name {
          margin: 0;
          max-width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          padding: 0 6px;
          font-size: clamp(14px, 4.6vw, 19px);
          font-weight: 500;
          color: #fff;
          text-align: center;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-shadow: 0 1px 3px rgb(0 0 0 / 0.6);
        }

        .sheet {
          flex: 0 0 auto;
          background: var(--sheet);
          border-radius: 28px 28px 0 0;
          padding: 14px 0 max(30px, env(safe-area-inset-bottom));
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 30px;
          touch-action: none;
        }

        .handle {
          width: 44px;
          height: 4px;
          border-radius: 999px;
          background: #cfd2d5;
          margin-bottom: 22px;
          cursor: grab;
        }

        .join {
          width: 79%;
          min-height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          border: 0;
          border-radius: 999px;
          background: var(--blue);
          color: #fff;
          font: inherit;
          font-size: clamp(18px, 5.9vw, 23px);
          font-weight: 500;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          transition: background-color .15s ease, scale .12s ease;
        }
        .join svg { width: 28px; height: 28px; fill: currentColor; flex: 0 0 auto; }
        .join:hover { background: #3a83f7; }
        .join:active { scale: .985; }

        .companion {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          min-height: 44px;
          padding: 0 22px;
          border: 0;
          border-radius: 999px;
          background: #17181a;
          color: var(--text);
          font: inherit;
          font-size: clamp(13px, 3.8vw, 15px);
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          transition: background-color .15s ease;
        }
        .companion svg { width: 20px; height: 20px; fill: currentColor; }
        .companion:hover { background: #26282b; }
        .companion.active { background: #d3e3fd; color: #041e49; }

        .menu {
          position: absolute;
          top: 62px;
          right: 12px;
          min-width: 190px;
          padding: 8px 0;
          border-radius: 12px;
          background: #2d2f31;
          box-shadow: 0 8px 26px rgb(0 0 0 / 0.55);
          z-index: 20;
          transform-origin: top right;
          animation: pop .13s ease-out;
        }
        @keyframes pop { from { scale: .94; opacity: 0; } }

        .menu button {
          display: block;
          width: 100%;
          padding: 12px 18px;
          border: 0;
          background: transparent;
          color: var(--text);
          font: inherit;
          font-size: 15px;
          text-align: left;
          cursor: pointer;
        }
        .menu button:hover { background: rgb(255 255 255 / 0.08); }

        .toast {
          position: absolute;
          left: 50%;
          bottom: 0;
          transform: translate(-50%, 20px);
          max-width: 84%;
          padding: 12px 18px;
          border-radius: 8px;
          background: #e8eaed;
          color: #202124;
          font-size: 14px;
          line-height: 1.35;
          text-align: center;
          opacity: 0;
          pointer-events: none;
          transition: opacity .2s ease, transform .2s ease;
          z-index: 30;
        }
        .toast.show {
          opacity: 1;
          transform: translate(-50%, -22px);
        }
      `}</style>

      <div className="phone">
        {/* Topbar (Back Arrow Removed, Meeting Code Centered) */}
        <header className="topbar">
          <div className="topbar-spacer"></div>

          <button className="meeting" type="button" title="Copy joining link" onClick={handleCopyLink}>
            <span className="badge" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
              </svg>
            </span>
            <h1 className="code">{MEETING_CODE}</h1>
          </button>

          <button className="icon-btn" type="button" aria-label="More options" onClick={() => setMenuOpen(!menuOpen)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
            </svg>
          </button>
        </header>

        {/* Main Preview Card */}
        <main>
          <div className={`preview ${camOn ? 'camera-on' : ''}`}>
            <video ref={videoRef} playsInline autoPlay muted></video>

            <div className="avatar" aria-hidden="true">
              {joinerName ? (
                <span>{getInitial(joinerName)}</span>
              ) : (
                <svg viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              )}
            </div>

            <div className="controls">
              <button
                className={`ctl ${!camOn ? 'off' : ''}`}
                type="button"
                onClick={toggleCamera}
                aria-label={camOn ? 'Turn off camera' : 'Turn on camera'}
              >
                {camOn ? (
                  <svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24"><path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2 2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z" /></svg>
                )}
              </button>

              <button
                className={`ctl ${!micOn ? 'off' : ''}`}
                type="button"
                onClick={toggleMic}
                style={{ boxShadow: micOn ? `0 0 0 ${micLevel * 9}px rgba(138, 180, 248, 0.28)` : 'none' }}
                aria-label={micOn ? 'Turn off microphone' : 'Turn on microphone'}
              >
                {micOn ? (
                  <svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3 3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" /></svg>
                )}
              </button>
            </div>

            <div className="identity">
              {joinerName && <p className="name">{joinerName}</p>}
            </div>
          </div>
        </main>

        {/* Bottom Sheet */}
        <section className="sheet">
          <div className="handle"></div>

          {/* ASK TO JOIN BUTTON -> Redirects to /gogle */}
          <button className="join" type="button" onClick={handleAskToJoin}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
            </svg>
            <span>Ask to join</span>
          </button>

          <button
            className={`companion ${companionActive ? 'active' : ''}`}
            type="button"
            onClick={() => {
              const next = !companionActive;
              setCompanionActive(next);
              showToast(next ? 'Companion Mode on — mic and camera stay off' : 'Companion Mode off');
              if (next) releaseAll();
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H9V5h12v14z" />
            </svg>
            <span>Use Companion Mode</span>
          </button>
        </section>

        {/* Menu Dropdown */}
        {menuOpen && (
          <div className="menu">
            <button type="button" onClick={() => { setMenuOpen(false); showToast('Settings'); }}>Settings</button>
            <button type="button" onClick={() => { setMenuOpen(false); showToast('Send feedback'); }}>Send feedback</button>
            <button type="button" onClick={() => { setMenuOpen(false); showToast('Help'); }}>Help</button>
          </div>
        )}

        {/* Toast */}
        <div className={`toast ${toastMsg ? 'show' : ''}`}>{toastMsg}</div>
      </div>
    </div>
  );
}
