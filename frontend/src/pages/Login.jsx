import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, ShieldCheck, Lock, Mail, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('admin@stocksense.io');
  const [password, setPassword] = useState('Password123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async (demoEmail) => {
    setEmail(demoEmail);
    setPassword('Password123!');
    setLoading(true);
    setError('');

    try {
      await login(demoEmail, 'Password123!');
      navigate('/dashboard');
    } catch (err) {
      setError('Failed to authenticate demo account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-bg flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-emerald-primary text-white flex items-center justify-center mx-auto shadow-md">
            <Layers className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-content-primary">StockSense</h1>
          <p className="text-xs text-content-secondary max-w-xs mx-auto">
            AI-Powered Inventory Management & Demand Forecasting Platform
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-surface-card border border-surface-border rounded-2xl p-7 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-surface-border">
            <span className="text-xs font-bold uppercase tracking-wider text-content-primary">System Sign In</span>
            <span className="text-[10px] font-bold text-emerald-primary bg-emerald-sage px-2 py-0.5 rounded">
              PostgreSQL & AI Verified
            </span>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-content-secondary font-semibold mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-content-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@stocksense.io"
                  className="w-full pl-9 pr-3 py-2.5 border border-surface-border rounded-lg text-xs font-medium text-content-primary focus:outline-none focus:border-emerald-primary"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-content-secondary font-semibold mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-content-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 border border-surface-border rounded-lg text-xs font-medium text-content-primary focus:outline-none focus:border-emerald-primary"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-emerald-primary hover:bg-emerald-hover text-white text-xs font-bold rounded-lg transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to StockSense'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Quick Demo Switcher */}
          <div className="pt-3 border-t border-surface-border space-y-2">
            <span className="text-[10px] font-bold text-content-secondary uppercase tracking-wider block text-center">
              One-Click Evaluator Sign-In
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('admin@stocksense.io')}
                className="p-2 border border-surface-border hover:border-emerald-primary rounded-lg text-left bg-surface-bg/60 hover:bg-emerald-sage/40 transition"
              >
                <p className="font-bold text-content-primary">Admin</p>
                <p className="text-[10px] text-content-secondary">admin@stocksense.io</p>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('manager@stocksense.io')}
                className="p-2 border border-surface-border hover:border-emerald-primary rounded-lg text-left bg-surface-bg/60 hover:bg-emerald-sage/40 transition"
              >
                <p className="font-bold text-content-primary">Manager</p>
                <p className="text-[10px] text-content-secondary">manager@stocksense.io</p>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('staff@stocksense.io')}
                className="p-2 border border-surface-border hover:border-emerald-primary rounded-lg text-left bg-surface-bg/60 hover:bg-emerald-sage/40 transition"
              >
                <p className="font-bold text-content-primary">Staff</p>
                <p className="text-[10px] text-content-secondary">staff@stocksense.io</p>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('supplier@stocksense.io')}
                className="p-2 border border-surface-border hover:border-emerald-primary rounded-lg text-left bg-surface-bg/60 hover:bg-emerald-sage/40 transition"
              >
                <p className="font-bold text-content-primary">Supplier</p>
                <p className="text-[10px] text-content-secondary">supplier@stocksense.io</p>
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-[11px] text-center text-content-muted">
          StockSense Architecture: React + Node.js + Python FastAPI + PostgreSQL 17
        </p>
      </div>
    </div>
  );
}
