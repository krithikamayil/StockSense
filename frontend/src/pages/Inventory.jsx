import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Plus, 
  SlidersHorizontal, 
  ArrowUpDown, 
  PackageCheck,
  AlertCircle,
  ExternalLink,
  X
} from 'lucide-react';
import api from '../api/client';
import StockBadge from '../components/StockBadge';
import { useAuth } from '../context/AuthContext';

export default function Inventory() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  
  // Adjustment Modal State
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustType, setAdjustType] = useState('ADJUSTMENT');
  const [adjustError, setAdjustError] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  useEffect(() => {
    fetchInventory();
  }, [statusFilter]);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory', {
        params: { status: statusFilter, search: search.trim() || undefined }
      });
      if (res.data.success) {
        setItems(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchInventory();
  };

  const handleOpenAdjust = (product) => {
    setSelectedProduct(product);
    setAdjustQty('');
    setAdjustReason('');
    setAdjustType('ADJUSTMENT');
    setAdjustError('');
    setShowAdjustModal(true);
  };

  const handlePerformAdjustment = async (e) => {
    e.preventDefault();
    const qty = parseInt(adjustQty, 10);
    if (isNaN(qty) || qty === 0) {
      setAdjustError('Please specify a non-zero quantity change (+ to add, - to subtract).');
      return;
    }

    setAdjusting(true);
    setAdjustError('');
    try {
      const res = await api.post('/inventory/adjust', {
        product_id: selectedProduct.product_id,
        quantity_change: qty,
        reason: adjustReason || 'Manual physical audit adjustment',
        movement_type: adjustType
      });
      if (res.data.success) {
        setShowAdjustModal(false);
        fetchInventory(); // refresh list
      }
    } catch (err) {
      setAdjustError(err.response?.data?.error?.message || 'Failed to adjust stock.');
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-content-primary tracking-tight">Inventory Catalog</h2>
          <p className="text-xs text-content-secondary mt-0.5">
            Real-time stock levels, dynamic safety stock, and reorder metrics across all active SKUs.
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-content-secondary" />
            <input
              type="text"
              placeholder="Search SKU or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-1.5 text-xs bg-surface-card border border-surface-border rounded-lg focus:outline-none focus:border-emerald-primary w-52 md:w-64"
            />
          </form>

          {/* Status Tabs */}
          <div className="flex items-center bg-surface-card border border-surface-border rounded-lg p-0.5 text-xs font-semibold">
            {['ALL', 'HEALTHY', 'LOW_STOCK', 'OUT_OF_STOCK'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded transition text-xs ${
                  statusFilter === st
                    ? 'bg-emerald-primary text-white shadow-xs'
                    : 'text-content-secondary hover:text-content-primary'
                }`}
              >
                {st === 'ALL' ? 'All' : st === 'HEALTHY' ? 'Healthy' : st === 'LOW_STOCK' ? 'Low Stock' : 'Stockout'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Inventory Table */}
      <div className="rounded-xl border border-surface-border bg-surface-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-surface-bg/70 border-b border-surface-border text-content-secondary uppercase text-[10px] tracking-wider font-semibold">
                <th className="py-3 px-4">SKU / ID</th>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center">Current Stock</th>
                <th className="py-3 px-4 text-center">Safety Stock (SS)</th>
                <th className="py-3 px-4 text-center">Reorder Point (ROP)</th>
                <th className="py-3 px-4 text-center">EOQ</th>
                <th className="py-3 px-4">Holding Valuation</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-content-secondary">
                    <div className="inline-block w-6 h-6 border-2 border-emerald-primary border-t-transparent rounded-full animate-spin mb-2" />
                    <p>Loading inventory records...</p>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-content-secondary">
                    No products found matching selected filter.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.product_id} className="hover:bg-surface-bg/50 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-content-primary">
                      <button
                        onClick={() => navigate(`/products/${item.product_id}`)}
                        className="text-emerald-primary hover:underline flex items-center gap-1"
                      >
                        {item.sku}
                        <ExternalLink className="w-3 h-3 text-content-muted" />
                      </button>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-content-primary max-w-xs truncate" title={item.product_name}>
                      {item.product_name}
                    </td>
                    <td className="py-3.5 px-4 text-content-secondary">
                      {item.category_name || 'General'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`font-bold text-sm ${item.current_stock === 0 ? 'text-rose-600' : item.current_stock <= item.reorder_point ? 'text-amber-700' : 'text-emerald-forest'}`}>
                        {item.current_stock}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center text-content-secondary font-medium">
                      {item.safety_stock}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-content-primary">
                      {item.reorder_point}
                    </td>
                    <td className="py-3.5 px-4 text-center text-content-secondary">
                      {item.eoq}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-content-primary">
                      ${parseFloat(item.total_valuation || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4">
                      <StockBadge status={item.health_status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenAdjust(item)}
                          className="px-2.5 py-1 text-xs font-semibold bg-surface-bg hover:bg-emerald-sage text-content-primary hover:text-emerald-forest border border-surface-border rounded transition"
                          title="Adjust Stock & Record Ledger Movement"
                        >
                          Adjust
                        </button>
                        <button
                          onClick={() => navigate(`/products/${item.product_id}`)}
                          className="px-2.5 py-1 text-xs font-semibold bg-emerald-sage text-emerald-forest hover:bg-emerald-primary hover:text-white rounded transition"
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Stock Adjustment Modal */}
      {showAdjustModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-surface-card border border-surface-border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <div>
                <h3 className="text-base font-bold text-content-primary">Adjust Stock Level</h3>
                <p className="text-xs text-content-secondary">{selectedProduct.product_name} ({selectedProduct.sku})</p>
              </div>
              <button onClick={() => setShowAdjustModal(false)} className="text-content-secondary hover:text-content-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePerformAdjustment} className="space-y-4 text-xs">
              <div className="p-3 bg-surface-bg rounded-lg flex items-center justify-between">
                <span className="text-content-secondary">Current Stock:</span>
                <span className="font-bold text-sm text-content-primary">{selectedProduct.current_stock} units</span>
              </div>

              <div>
                <label className="block text-content-secondary font-semibold mb-1">
                  Quantity Change (+ to add, - to subtract)
                </label>
                <input
                  type="number"
                  placeholder="e.g. +10 or -5"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="w-full px-3 py-2 border border-surface-border rounded-lg text-sm font-mono focus:outline-none focus:border-emerald-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-content-secondary font-semibold mb-1">
                  Movement Classification
                </label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value)}
                  className="w-full px-3 py-2 border border-surface-border rounded-lg text-xs focus:outline-none focus:border-emerald-primary"
                >
                  <option value="ADJUSTMENT">Physical Audit Adjustment</option>
                  <option value="DAMAGE">Damaged / Expired Goods</option>
                  <option value="RETURN">Customer Return / Restock</option>
                </select>
              </div>

              <div>
                <label className="block text-content-secondary font-semibold mb-1">
                  Audit Reason / Notes
                </label>
                <textarea
                  placeholder="Provide audit justification for ledger compliance..."
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-surface-border rounded-lg text-xs focus:outline-none focus:border-emerald-primary"
                />
              </div>

              {adjustError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{adjustError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 border border-surface-border rounded-lg text-content-secondary font-semibold hover:bg-surface-bg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjusting}
                  className="px-4 py-2 bg-emerald-primary hover:bg-emerald-hover text-white font-bold rounded-lg transition disabled:opacity-50"
                >
                  {adjusting ? 'Updating Ledger...' : 'Commit Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
