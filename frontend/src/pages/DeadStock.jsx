import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  DollarSign, 
  Percent, 
  Trash2, 
  Tag, 
  ArrowRight,
  TrendingDown,
  CheckCircle,
  X
} from 'lucide-react';
import api from '../api/client';
import StockBadge from '../components/StockBadge';
import StatCard from '../components/StatCard';
import { useAuth } from '../context/AuthContext';

export default function DeadStock() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [deadStockData, setDeadStockData] = useState(null);
  const [filter, setFilter] = useState('ALL'); // 'ALL', 'LIQUIDATE', 'DISCOUNT'

  // Action Modal State
  const [actionItem, setActionItem] = useState(null);
  const [actionType, setActionType] = useState('APPLY_DISCOUNT'); // or 'LIQUIDATE'
  const [discountPct, setDiscountPct] = useState(25);
  const [liquidationUnits, setLiquidationUnits] = useState(0);
  const [actionReason, setActionReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);

  useEffect(() => {
    fetchDeadStock();
  }, []);

  const fetchDeadStock = async () => {
    setLoading(true);
    try {
      const res = await api.get('/dead-stock');
      if (res.data.success) {
        setDeadStockData(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAction = (item, type) => {
    setActionItem(item);
    setActionType(type);
    setDiscountPct(25);
    setLiquidationUnits(item.current_stock);
    setActionReason(type === 'LIQUIDATE' ? 'Asset write-down for 5+ trailing zero sales' : 'Clearance markdown to stimulate turnover');
    setActionFeedback(null);
  };

  const handleExecuteAction = async (e) => {
    e.preventDefault();
    setSubmittingAction(true);
    setActionFeedback(null);
    try {
      const res = await api.post('/dead-stock/action', {
        product_id: actionItem.product_id,
        action_type: actionType,
        discount_percent: discountPct,
        liquidation_units: liquidationUnits,
        reason: actionReason
      });

      if (res.data.success) {
        setActionFeedback({ type: 'success', message: res.data.message });
        setTimeout(() => {
          setActionItem(null);
          fetchDeadStock();
        }, 1200);
      }
    } catch (err) {
      setActionFeedback({ type: 'error', message: err.response?.data?.error?.message || 'Action failed.' });
    } finally {
      setSubmittingAction(false);
    }
  };

  const summary = deadStockData?.summary || {};
  const items = (deadStockData?.data || []).filter(item => {
    if (filter === 'LIQUIDATE') return item.dead_stock_status === 'LIQUIDATE';
    if (filter === 'DISCOUNT') return item.dead_stock_status === 'DISCOUNT';
    return true;
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-content-primary tracking-tight">Dead Stock & Inventory Stagnation Diagnostic</h2>
          <p className="text-xs text-content-secondary mt-0.5">
            Automated detection of non-moving inventory using trailing zero-demand windows and demand velocity decline heuristics.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center bg-surface-card border border-surface-border rounded-lg p-0.5 text-xs font-semibold">
          {[
            { id: 'ALL', label: 'All Stagnant' },
            { id: 'LIQUIDATE', label: 'Liquidate (≥5 Wks)' },
            { id: 'DISCOUNT', label: 'Discount (>55% Drop)' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded transition ${
                filter === f.id
                  ? 'bg-emerald-primary text-white shadow-xs'
                  : 'text-content-secondary hover:text-content-primary'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Tied-Up Dormant Capital"
          value={`$${parseFloat(summary.total_tied_up_capital || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Non-performing warehouse assets"
          icon={DollarSign}
          variant="rose"
        />
        <StatCard
          title="Total Stagnant SKUs"
          value={summary.total_stagnant_items || 0}
          subtitle="Requiring commercial intervention"
          icon={AlertTriangle}
          variant="amber"
        />
        <StatCard
          title="Severe Liquidation Queue"
          value={summary.liquidate_count || 0}
          subtitle="≥ 5 consecutive trailing zero weeks"
          icon={Trash2}
          variant="rose"
        />
        <StatCard
          title="Clearance Discount Queue"
          value={summary.discount_count || 0}
          subtitle="≥ 2 zero weeks OR > 55% sales drop"
          icon={Percent}
          variant="default"
        />
      </div>

      {/* Dead Stock Business Rules Note Banner */}
      <div className="p-4 rounded-xl bg-surface-card border border-surface-border flex items-start gap-3 text-xs text-content-secondary">
        <div className="w-6 h-6 rounded-md bg-emerald-sage text-emerald-forest flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
          §
        </div>
        <div>
          <span className="font-bold text-content-primary">Section 8 Business Logic Criteria:</span>
          <span className="block mt-0.5">
            • <strong className="text-rose-700">Liquidate:</strong> 5 or more trailing zero-sale weeks (≥ 35 days without sales) — recommend immediate write-down or salvage.<br/>
            • <strong className="text-amber-700">Discount:</strong> 2 or more trailing zero-sale weeks OR sales drop greater than 55% compared to preceding 4-week window — recommend clearance markdown (15%–30%).
          </span>
        </div>
      </div>

      {/* Stagnant Inventory Table */}
      <div className="rounded-xl border border-surface-border bg-surface-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-surface-bg/70 border-b border-surface-border text-content-secondary uppercase text-[10px] tracking-wider font-semibold">
                <th className="py-3 px-4">SKU / Product</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center">Current Stock</th>
                <th className="py-3 px-4">Holding Valuation</th>
                <th className="py-3 px-4 text-center">Trailing Zero Weeks</th>
                <th className="py-3 px-4 text-center">Velocity Drop</th>
                <th className="py-3 px-4">Diagnosis Status</th>
                <th className="py-3 px-4 text-right">Recommended Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-content-secondary">
                    <div className="inline-block w-6 h-6 border-2 border-emerald-primary border-t-transparent rounded-full animate-spin mb-2" />
                    <p>Executing dead stock diagnostic algorithm across warehouse SKUs...</p>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-content-secondary">
                    <CheckCircle className="w-8 h-8 text-emerald-primary mx-auto mb-2" />
                    <p className="font-semibold text-content-primary">No dead stock identified.</p>
                    <p className="text-[11px] text-content-secondary mt-0.5">All monitored products have sustained ongoing sales velocity.</p>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.product_id} className="hover:bg-surface-bg/50">
                    <td className="py-3.5 px-4">
                      <p className="font-mono font-bold text-content-primary">{item.sku}</p>
                      <p className="text-content-secondary truncate max-w-xs">{item.name}</p>
                    </td>
                    <td className="py-3.5 px-4 text-content-secondary">{item.category_name}</td>
                    <td className="py-3.5 px-4 text-center font-bold text-content-primary">{item.current_stock}</td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-rose-700">
                      ${parseFloat(item.holding_value).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold">
                      <span className={item.trailing_zero_weeks >= 5 ? 'text-rose-600' : 'text-amber-700'}>
                        {item.trailing_zero_weeks} weeks
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono">
                      {item.sales_drop_pct > 0 ? (
                        <span className="text-rose-600 font-bold">-{item.sales_drop_pct}%</span>
                      ) : (
                        <span className="text-content-secondary">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <StockBadge status={item.dead_stock_status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {item.dead_stock_status === 'DISCOUNT' && (
                          <button
                            onClick={() => handleOpenAction(item, 'APPLY_DISCOUNT')}
                            className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 font-bold rounded transition text-xs flex items-center gap-1"
                          >
                            <Tag className="w-3 h-3" />
                            <span>Discount</span>
                          </button>
                        )}
                        {item.dead_stock_status === 'LIQUIDATE' && (
                          <button
                            onClick={() => handleOpenAction(item, 'LIQUIDATE')}
                            className="px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 font-bold rounded transition text-xs flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Liquidate</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Execution Modal */}
      {actionItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-surface-card border border-surface-border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <div>
                <h3 className="text-base font-bold text-content-primary">
                  {actionType === 'APPLY_DISCOUNT' ? 'Apply Clearance Markdown' : 'Liquidate Stagnant Asset'}
                </h3>
                <p className="text-xs text-content-secondary">{actionItem.name} ({actionItem.sku})</p>
              </div>
              <button onClick={() => setActionItem(null)} className="text-content-secondary hover:text-content-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteAction} className="space-y-4 text-xs">
              <div className="p-3 bg-surface-bg rounded-lg space-y-1">
                <div className="flex justify-between">
                  <span className="text-content-secondary">Current Stock:</span>
                  <span className="font-bold text-content-primary">{actionItem.current_stock} units</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-content-secondary">Unit Price:</span>
                  <span className="font-bold text-content-primary">${parseFloat(actionItem.price).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-content-secondary">Capital Tied Up:</span>
                  <span className="font-bold text-rose-700">${parseFloat(actionItem.holding_value).toFixed(2)}</span>
                </div>
              </div>

              {actionType === 'APPLY_DISCOUNT' ? (
                <div>
                  <label className="block text-content-secondary font-semibold mb-1">
                    Clearance Discount Percentage (%)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={75}
                    value={discountPct}
                    onChange={(e) => setDiscountPct(e.target.value)}
                    className="w-full px-3 py-2 border border-surface-border rounded-lg text-sm font-mono focus:outline-none focus:border-emerald-primary"
                    required
                  />
                  <p className="text-[11px] text-content-secondary mt-1">
                    New selling price will be: ${(actionItem.price * (1 - discountPct / 100)).toFixed(2)}
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-content-secondary font-semibold mb-1">
                    Units to Liquidate / Write Down
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={actionItem.current_stock}
                    value={liquidationUnits}
                    onChange={(e) => setLiquidationUnits(e.target.value)}
                    className="w-full px-3 py-2 border border-surface-border rounded-lg text-sm font-mono focus:outline-none focus:border-emerald-primary"
                    required
                  />
                  <p className="text-[11px] text-content-secondary mt-1">
                    Will deduct units from inventory and record an audit write-off in stock_movements ledger.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-content-secondary font-semibold mb-1">
                  Compliance Audit Justification
                </label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-surface-border rounded-lg text-xs focus:outline-none focus:border-emerald-primary"
                />
              </div>

              {actionFeedback && (
                <div className={`p-2.5 rounded-lg text-xs font-semibold ${
                  actionFeedback.type === 'success' ? 'bg-emerald-sage text-emerald-forest' : 'bg-rose-50 text-rose-700'
                }`}>
                  {actionFeedback.message}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActionItem(null)}
                  className="px-4 py-2 border border-surface-border rounded-lg text-content-secondary font-semibold hover:bg-surface-bg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className={`px-4 py-2 text-white font-bold rounded-lg transition disabled:opacity-50 ${
                    actionType === 'APPLY_DISCOUNT' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {submittingAction ? 'Processing...' : actionType === 'APPLY_DISCOUNT' ? 'Apply Markdown' : 'Commit Liquidation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
