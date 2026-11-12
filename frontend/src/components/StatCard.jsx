import React from 'react';

export default function StatCard({ title, value, subtitle, icon: Icon, trend, variant = 'default' }) {
  const variantStyles = {
    default: 'border-surface-border bg-surface-card',
    emerald: 'border-emerald-primary/30 bg-emerald-sage/30',
    amber: 'border-amber-200 bg-amber-50/50',
    rose: 'border-rose-200 bg-rose-50/50',
  };

  const iconStyles = {
    default: 'bg-emerald-sage text-emerald-forest',
    emerald: 'bg-emerald-primary text-white',
    amber: 'bg-amber-100 text-amber-800',
    rose: 'bg-rose-100 text-rose-800',
  };

  return (
    <div className={`p-5 rounded-xl border ${variantStyles[variant]} shadow-sm transition hover:shadow`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider">{title}</span>
        {Icon && (
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconStyles[variant]}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      <div className="mt-3">
        <span className="text-2xl font-bold text-content-primary tracking-tight">{value}</span>
      </div>
      {subtitle && (
        <div className="mt-2 text-xs text-content-secondary flex items-center gap-1.5">
          {trend && (
            <span className={`font-semibold ${trend > 0 ? 'text-emerald-primary' : 'text-rose-600'}`}>
              {trend > 0 ? `+${trend}%` : `${trend}%`}
            </span>
          )}
          <span>{subtitle}</span>
        </div>
      )}
    </div>
  );
}
