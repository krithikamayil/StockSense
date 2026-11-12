import React, { useState, useEffect } from 'react';
import { Bell, ShieldCheck, Check, Sparkles } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ title = 'Dashboard' }) {
  const { user, login } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      if (res.data.success) {
        setNotifications(res.data.data);
        setUnreadCount(res.data.unread_count);
      }
    } catch (err) {
      // ignore in offline mode
    }
  };

  const markAllRead = async () => {
    try {
      await api.put('/notifications/mark-all-read');
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuickRoleSwitch = async (roleEmail) => {
    setSwitchingRole(true);
    try {
      await login(roleEmail, 'Password123!');
      setShowNotifications(false);
      window.location.reload();
    } catch (err) {
      console.error(err);
    } finally {
      setSwitchingRole(false);
    }
  };

  return (
    <header className="h-16 bg-surface-card border-b border-surface-border px-8 flex items-center justify-between sticky top-0 z-20">
      <div>
        <h1 className="text-xl font-bold text-content-primary tracking-tight">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* System Dataset State Badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-emerald-sage/60 text-emerald-forest rounded-full text-xs font-medium border border-emerald-primary/10">
          <span className="w-2 h-2 rounded-full bg-emerald-primary animate-pulse" />
          <span>Olist Dataset (Delivered Orders • As-of Aug 2018)</span>
        </div>

        {/* Quick Role Switcher Pill */}
        <div className="flex items-center bg-surface-bg border border-surface-border rounded-lg p-0.5 text-xs font-medium">
          <span className="px-2 py-1 text-content-secondary flex items-center gap-1 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-primary" /> Role:
          </span>
          {[
            { role: 'Admin', email: 'admin@stocksense.io' },
            { role: 'Manager', email: 'manager@stocksense.io' },
            { role: 'Staff', email: 'staff@stocksense.io' },
          ].map((item) => (
            <button
              key={item.role}
              onClick={() => handleQuickRoleSwitch(item.email)}
              disabled={switchingRole || user?.role === item.role}
              className={`px-2.5 py-1 rounded transition text-xs ${
                user?.role === item.role
                  ? 'bg-emerald-primary text-white font-bold shadow-xs'
                  : 'text-content-secondary hover:text-content-primary hover:bg-surface-card'
              }`}
            >
              {item.role}
            </button>
          ))}
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg text-content-secondary hover:text-content-primary hover:bg-surface-bg transition relative"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-surface-card border border-surface-border rounded-xl shadow-lg p-4 z-50">
              <div className="flex items-center justify-between pb-3 border-b border-surface-border mb-2">
                <span className="text-xs font-bold text-content-primary uppercase tracking-wider">Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-emerald-primary hover:underline font-medium">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {notifications.length === 0 ? (
                  <p className="text-xs text-content-secondary text-center py-4">No notifications.</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-2.5 rounded-lg text-xs border ${
                        n.is_read ? 'bg-surface-bg border-surface-border text-content-secondary' : 'bg-emerald-sage/40 border-emerald-primary/20 text-content-primary font-medium'
                      }`}
                    >
                      <p className="font-bold text-emerald-forest">{n.title}</p>
                      <p className="mt-0.5 text-content-secondary leading-snug">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
