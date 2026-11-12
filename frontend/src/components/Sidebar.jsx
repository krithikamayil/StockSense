import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  TrendingUp, 
  ShoppingCart, 
  AlertTriangle, 
  Truck, 
  Bot, 
  LogOut,
  Sparkles,
  Layers
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Inventory', path: '/inventory', icon: Package },
  { name: 'Forecasting', path: '/forecasting', icon: TrendingUp },
  { name: 'Reordering', path: '/reordering', icon: ShoppingCart },
  { name: 'Dead Stock', path: '/dead-stock', icon: AlertTriangle },
  { name: 'Suppliers', path: '/suppliers', icon: Truck },
  { name: 'AI Assistant', path: '/assistant', icon: Bot, highlight: true },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-64 bg-surface-card border-r border-surface-border flex flex-col h-screen fixed left-0 top-0 select-none z-30">
      {/* Brand Header */}
      <div className="h-16 px-6 border-b border-surface-border flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-primary flex items-center justify-center text-white shadow-sm">
          <Layers className="w-5 h-5" />
        </div>
        <div>
          <span className="font-bold text-lg tracking-tight text-content-primary">StockSense</span>
          <span className="block text-[10px] tracking-wider font-semibold text-emerald-primary uppercase -mt-1">
            AI Inventory Intelligence
          </span>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold text-content-muted uppercase tracking-wider">
          Operations
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-sage text-emerald-forest font-semibold'
                    : 'text-content-secondary hover:text-content-primary hover:bg-surface-bg'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.name}</span>
              {item.highlight && (
                <span className="ml-auto flex items-center gap-1 text-[10px] bg-emerald-primary text-white px-1.5 py-0.5 rounded-full font-bold">
                  <Sparkles className="w-2.5 h-2.5" /> AI
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User & Role Footer */}
      <div className="p-3 border-t border-surface-border bg-surface-bg/50">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-surface-card border border-surface-border">
          <div className="w-8 h-8 rounded-full bg-emerald-sage text-emerald-forest flex items-center justify-center font-bold text-xs">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-content-primary truncate">{user?.name || 'User'}</p>
            <span className="inline-block px-1.5 py-0.2 bg-emerald-sage/70 text-emerald-forest text-[10px] font-bold rounded">
              {user?.role || 'Staff'}
            </span>
          </div>
          <button
            onClick={handleLogout}
            title="Log Out"
            className="p-1.5 text-content-secondary hover:text-rose-600 hover:bg-rose-50 rounded transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
