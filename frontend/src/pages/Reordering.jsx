import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  CheckCircle, 
  Clock, 
  Truck, 
  AlertTriangle, 
  Plus, 
  ArrowRight,
  PackageCheck,
  RotateCcw,
  ShieldCheck,
  Send
} from 'lucide-react';
import api from '../api/client';
import StockBadge from '../components/StockBadge';
import { useAuth } from '../context/AuthContext';

export default function Reordering() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('RECOMMENDATIONS'); // or 'PURCHASE_ORDERS'

  // Recommendations state
  const [recommendations, setRecommendations] = useState([]);
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());
  const [loadingRecs, setLoadingRecs] = useState(true);
  const [creatingPo, setCreatingPo] = useState(false);
  const [poMessage, setPoMessage] = useState(null);

  // Purchase Orders state
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loadingPos, setLoadingPos] = useState(true);
  const [receivingPoId, setReceivingPoId] = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    fetchRecommendations();
    fetchPurchaseOrders();
  }, []);

  const fetchRecommendations = async () => {
    setLoadingRecs(true);
    try {
      const res = await api.get('/reorder/recommendations');
      if (res.data.success) {
        setRecommendations(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRecs(false);
    }
  };

  const fetchPurchaseOrders = async () => {
    setLoadingPos(true);
    try {
      const res = await api.get('/purchase-orders');
      if (res.data.success) {
        setPurchaseOrders(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPos(false);
    }
  };

  // Toggle selection
  const toggleSelect = (prodId) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(prodId)) next.delete(prodId);
      else next.add(prodId);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedItemIds.size === recommendations.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(recommendations.map(r => r.product_id)));
    }
  };

  // Batch Generate PO
  const handleGeneratePo = async () => {
    if (selectedItemIds.size === 0) return;
    setCreatingPo(true);
    setPoMessage(null);
    setActionError(null);

    try {
      const selectedItems = recommendations.filter(r => selectedItemIds.has(r.product_id));
      // Group by supplier
      const supplierId = selectedItems[0]?.supplier_id || 1;

      const itemsPayload = selectedItems.map(item => ({
        product_id: item.product_id,
        quantity: item.recommended_quantity,
        unit_cost: item.cost_price
      }));

      const res = await api.post('/reorder/generate-po', {
        supplier_id: supplierId,
        items: itemsPayload,
        notes: `Generated via StockSense Reordering Screen for ${itemsPayload.length} urgent SKUs.`
      });

      if (res.data.success) {
        setPoMessage(`Purchase Order ${res.data.data.po.po_number} created successfully!`);
        setSelectedItemIds(new Set());
        fetchRecommendations();
        fetchPurchaseOrders();
        setActiveTab('PURCHASE_ORDERS');
      }
    } catch (err) {
      setActionError(err.response?.data?.error?.message || 'Failed to create purchase order.');
    } finally {
      setCreatingPo(false);
    }
  };

  // Approve PO
  const handleApprovePo = async (poId) => {
    try {
      const res = await api.put(`/purchase-orders/${poId}/status`, { status: 'APPROVED' });
      if (res.data.success) {
        fetchPurchaseOrders();
      }
    } catch (err) {
      setActionError(err.response?.data?.error?.message || 'Failed to approve PO.');
    }
  };

  // Order PO
  const handleSendOrder = async (poId) => {
    try {
      const res = await api.put(`/purchase-orders/${poId}/status`, { status: 'ORDERED' });
      if (res.data.success) {
        fetchPurchaseOrders();
      }
    } catch (err) {
      setActionError(err.response?.data?.error?.message || 'Failed to mark PO as ordered.');
    }
  };

  // ATOMIC RECEIVE PO WORKFLOW
  const handleReceivePo = async (poId) => {
    setReceivingPoId(poId);
    setActionError(null);
    try {
      const res = await api.post(`/purchase-orders/${poId}/receive`);
      if (res.data.success) {
        setPoMessage(res.data.message);
        fetchPurchaseOrders();
        fetchRecommendations();
      }
    } catch (err) {
      setActionError(err.response?.data?.error?.message || 'Failed to receive purchase order.');
    } finally {
      setReceivingPoId(null);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-content-primary tracking-tight">
            Purchase Orders & Reorder Recommendations
          </h2>
          <p className="text-xs text-content-secondary mt-0.5">
            Automated replenishment recommendations based on Economic Order Quantity (EOQ) and Reorder Points (ROP).
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-surface-card border border-surface-border rounded-lg p-0.5 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('RECOMMENDATIONS')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded transition ${
              activeTab === 'RECOMMENDATIONS'
                ? 'bg-emerald-primary text-white shadow-xs'
                : 'text-content-secondary hover:text-content-primary'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Reorder Queue ({recommendations.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('PURCHASE_ORDERS')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded transition ${
              activeTab === 'PURCHASE_ORDERS'
                ? 'bg-emerald-primary text-white shadow-xs'
                : 'text-content-secondary hover:text-content-primary'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Purchase Orders ({purchaseOrders.length})</span>
          </button>
        </div>
      </div>

      {/* Status Notifications */}
      {poMessage && (
        <div className="p-3.5 rounded-xl border border-emerald-primary/30 bg-emerald-sage/40 text-emerald-forest font-semibold text-xs flex items-center justify-between">
          <span>{poMessage}</span>
          <button onClick={() => setPoMessage(null)} className="underline text-[11px]">Dismiss</button>
        </div>
      )}
      {actionError && (
        <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 font-semibold text-xs flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="underline text-[11px]">Dismiss</button>
        </div>
      )}

      {/* TAB 1: RECOMMENDATIONS */}
      {activeTab === 'RECOMMENDATIONS' && (
        <div className="space-y-4">
          {/* Top Actions Bar */}
          <div className="flex items-center justify-between p-4 bg-surface-card border border-surface-border rounded-xl">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedItemIds.size === recommendations.length && recommendations.length > 0}
                onChange={selectAll}
                className="w-4 h-4 text-emerald-primary rounded border-surface-border focus:ring-emerald-primary"
              />
              <span className="text-xs font-semibold text-content-primary">
                {selectedItemIds.size} of {recommendations.length} SKUs selected
              </span>
            </div>

            <button
              onClick={handleGeneratePo}
              disabled={selectedItemIds.size === 0 || creatingPo}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-primary hover:bg-emerald-hover text-white text-xs font-bold rounded-lg transition disabled:opacity-40 shadow-sm"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>{creatingPo ? 'Generating PO...' : `Generate Batch Purchase Order (${selectedItemIds.size})`}</span>
            </button>
          </div>

          {/* Recommendations Table */}
          <div className="rounded-xl border border-surface-border bg-surface-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-surface-bg/70 border-b border-surface-border text-content-secondary uppercase text-[10px] tracking-wider font-semibold">
                    <th className="py-3 px-4 w-10"></th>
                    <th className="py-3 px-4">SKU / Product</th>
                    <th className="py-3 px-4">Urgency</th>
                    <th className="py-3 px-4 text-center">Current Stock</th>
                    <th className="py-3 px-4 text-center">Safety Stock (SS)</th>
                    <th className="py-3 px-4 text-center">Reorder Point (ROP)</th>
                    <th className="py-3 px-4 text-center">Recommended Qty (EOQ)</th>
                    <th className="py-3 px-4">Estimated Cost</th>
                    <th className="py-3 px-4">Verified Supplier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {loadingRecs ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-content-secondary">
                        <div className="inline-block w-6 h-6 border-2 border-emerald-primary border-t-transparent rounded-full animate-spin mb-2" />
                        <p>Scanning inventory for breach of reorder thresholds...</p>
                      </td>
                    </tr>
                  ) : recommendations.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-content-secondary">
                        <CheckCircle className="w-8 h-8 text-emerald-primary mx-auto mb-2" />
                        <p className="font-semibold text-content-primary">All stock levels are optimal.</p>
                        <p className="text-[11px] text-content-secondary mt-0.5">No products currently below their reorder points.</p>
                      </td>
                    </tr>
                  ) : (
                    recommendations.map((item) => {
                      const isSelected = selectedItemIds.has(item.product_id);
                      return (
                        <tr key={item.product_id} className={`transition ${isSelected ? 'bg-emerald-sage/20' : 'hover:bg-surface-bg/40'}`}>
                          <td className="py-3.5 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(item.product_id)}
                              className="w-4 h-4 text-emerald-primary rounded border-surface-border focus:ring-emerald-primary"
                            />
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-mono font-bold text-content-primary">{item.sku}</p>
                            <p className="text-content-secondary truncate max-w-xs">{item.product_name}</p>
                          </td>
                          <td className="py-3.5 px-4">
                            <StockBadge status={item.urgency === 'CRITICAL_STOCKOUT' ? 'OUT_OF_STOCK' : 'LOW_STOCK'} />
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-rose-600">
                            {item.current_stock}
                          </td>
                          <td className="py-3.5 px-4 text-center text-content-secondary">
                            {item.safety_stock}
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-content-primary">
                            {item.reorder_point}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="font-mono font-bold text-emerald-forest bg-emerald-sage px-2 py-0.5 rounded">
                              +{item.recommended_quantity} units
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-semibold text-content-primary">
                            ${parseFloat(item.estimated_cost).toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-content-secondary">
                            <p className="font-semibold text-content-primary">{item.supplier_name || 'Apex Global'}</p>
                            <p className="text-[10px]">Lead time: {item.lead_time_days} days</p>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PURCHASE ORDERS LIFECYCLE */}
      {activeTab === 'PURCHASE_ORDERS' && (
        <div className="rounded-xl border border-surface-border bg-surface-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-surface-bg/70 border-b border-surface-border text-content-secondary uppercase text-[10px] tracking-wider font-semibold">
                  <th className="py-3 px-4">PO Number</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Items / Units</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4">Expected Delivery</th>
                  <th className="py-3 px-4 text-right">Workflow Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {loadingPos ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-content-secondary">
                      <div className="inline-block w-6 h-6 border-2 border-emerald-primary border-t-transparent rounded-full animate-spin mb-2" />
                      <p>Loading purchase orders...</p>
                    </td>
                  </tr>
                ) : purchaseOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-content-secondary">
                      No purchase orders recorded yet.
                    </td>
                  </tr>
                ) : (
                  purchaseOrders.map((po) => (
                    <tr key={po.id} className="hover:bg-surface-bg/50">
                      <td className="py-3.5 px-4 font-mono font-bold text-content-primary">
                        {po.po_number}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-content-primary">{po.supplier_name}</p>
                        <p className="text-[10px] text-content-secondary">{po.supplier_email}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <StockBadge status={po.status} />
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-content-primary">
                        ${parseFloat(po.total_amount).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-content-secondary">
                        {po.item_count} items ({po.total_units} units)
                      </td>
                      <td className="py-3.5 px-4 text-content-secondary">
                        {new Date(po.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-content-secondary">
                        {po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* DRAFT -> PENDING_APPROVAL -> APPROVED */}
                          {po.status === 'PENDING_APPROVAL' && (user?.role === 'Admin' || user?.role === 'Manager') && (
                            <button
                              onClick={() => handleApprovePo(po.id)}
                              className="px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 font-bold rounded transition text-xs"
                            >
                              Approve
                            </button>
                          )}

                          {/* APPROVED -> ORDERED */}
                          {po.status === 'APPROVED' && (
                            <button
                              onClick={() => handleSendOrder(po.id)}
                              className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 font-bold rounded transition text-xs flex items-center gap-1"
                            >
                              <Send className="w-3 h-3" />
                              <span>Dispatch Order</span>
                            </button>
                          )}

                          {/* ORDERED / APPROVED -> RECEIVE (ATOMIC UPDATE!) */}
                          {(po.status === 'ORDERED' || po.status === 'APPROVED') && (
                            <button
                              onClick={() => handleReceivePo(po.id)}
                              disabled={receivingPoId === po.id}
                              className="px-3 py-1 bg-emerald-primary hover:bg-emerald-hover text-white font-bold rounded transition text-xs flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              <span>{receivingPoId === po.id ? 'Receiving...' : 'Receive Goods'}</span>
                            </button>
                          )}

                          {/* RECEIVED STATE */}
                          {po.status === 'RECEIVED' && (
                            <span className="text-[11px] font-bold text-emerald-forest flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" /> Received
                            </span>
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
      )}
    </div>
  );
}
