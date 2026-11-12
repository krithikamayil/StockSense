import React from 'react';

export default function StockBadge({ status }) {
  const styles = {
    HEALTHY: 'bg-emerald-sage text-emerald-forest border-emerald-primary/20',
    LOW_STOCK: 'bg-amber-100 text-amber-800 border-amber-300',
    OUT_OF_STOCK: 'bg-rose-100 text-rose-800 border-rose-300',
    LIQUIDATE: 'bg-rose-100 text-rose-800 border-rose-300',
    DISCOUNT: 'bg-amber-100 text-amber-800 border-amber-300',
    RECEIVED: 'bg-emerald-sage text-emerald-forest border-emerald-primary/20',
    ORDERED: 'bg-blue-100 text-blue-800 border-blue-300',
    APPROVED: 'bg-purple-100 text-purple-800 border-purple-300',
    PENDING_APPROVAL: 'bg-amber-100 text-amber-800 border-amber-300',
    DRAFT: 'bg-slate-100 text-slate-700 border-slate-300',
    CANCELLED: 'bg-gray-100 text-gray-500 border-gray-300',
  };

  const labels = {
    HEALTHY: 'Healthy',
    LOW_STOCK: 'Low Stock (≤ ROP)',
    OUT_OF_STOCK: 'Stockout',
    LIQUIDATE: 'Liquidate (≥ 5 wks)',
    DISCOUNT: 'Discount (> 55% drop)',
    RECEIVED: 'Received',
    ORDERED: 'Ordered',
    APPROVED: 'Approved',
    PENDING_APPROVAL: 'Pending Approval',
    DRAFT: 'Draft',
    CANCELLED: 'Cancelled',
  };

  const currentStyle = styles[status] || 'bg-slate-100 text-slate-700 border-slate-200';
  const label = labels[status] || status;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${currentStyle}`}>
      {label}
    </span>
  );
}
