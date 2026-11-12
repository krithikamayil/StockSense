import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Truck, 
  Star, 
  Clock, 
  Plus, 
  Mail, 
  Phone, 
  MapPin, 
  Package, 
  ShoppingCart,
  CheckCircle,
  X,
  ExternalLink
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Suppliers() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState(7);
  const [rating, setRating] = useState(4.8);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/suppliers');
      if (res.data.success) {
        setSuppliers(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Supplier name is required.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const res = await api.post('/suppliers', {
        name: name.trim(),
        contact_name: contactName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        lead_time_days: parseInt(leadTimeDays, 10),
        rating: parseFloat(rating)
      });
      if (res.data.success) {
        setShowAddModal(false);
        fetchSuppliers();
        setName('');
        setContactName('');
        setEmail('');
        setPhone('');
      }
    } catch (err) {
      setFormError(err.response?.data?.error?.message || 'Failed to create supplier.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-content-primary tracking-tight">Verified Replenishment Suppliers</h2>
          <p className="text-xs text-content-secondary mt-0.5">
            Directory of certified replenishment vendors powering lead-time calculations and safety stock formulas.
          </p>
        </div>

        {(user?.role === 'Admin' || user?.role === 'Manager') && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-primary hover:bg-emerald-hover text-white text-xs font-bold rounded-lg transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Onboard New Supplier</span>
          </button>
        )}
      </div>

      {/* Synthetic Supplier Transparency Note */}
      <div className="p-4 rounded-xl bg-surface-card border border-surface-border text-xs text-content-secondary flex items-start gap-3">
        <div className="w-6 h-6 rounded-md bg-emerald-sage text-emerald-forest flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
          ℹ
        </div>
        <div>
          <span className="font-bold text-content-primary">Replenishment Protocol Rule:</span>
          <span className="block mt-0.5">
            Olist marketplace sellers are non-verified retail merchants. The replenishment suppliers below are explicitly verified vendor partners with calibrated lead times used by our EOQ and ROP mathematical engines.
          </span>
        </div>
      </div>

      {/* Suppliers Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-16 text-center text-content-secondary">
            <div className="inline-block w-6 h-6 border-2 border-emerald-primary border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs">Loading verified supplier directory...</p>
          </div>
        ) : suppliers.length === 0 ? (
          <div className="col-span-full py-12 text-center text-content-secondary">
            <p className="text-sm font-semibold">No suppliers found.</p>
          </div>
        ) : (
          suppliers.map((s) => (
            <div key={s.id} className="p-5 rounded-xl border border-surface-border bg-surface-card shadow-sm hover:shadow transition flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-start justify-between">
                  <div className="w-9 h-9 rounded-lg bg-emerald-sage text-emerald-forest flex items-center justify-center font-bold">
                    <Truck className="w-5 h-5" />
                  </div>
                  <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    <span>{parseFloat(s.rating || 4.5).toFixed(1)}</span>
                  </span>
                </div>

                <div className="mt-3">
                  <h3 className="font-bold text-sm text-content-primary">{s.name}</h3>
                  <p className="text-xs text-content-secondary mt-0.5">{s.contact_name || 'Accounts Representative'}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-surface-border space-y-2 text-xs text-content-secondary">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-content-muted" />
                    <span className="truncate">{s.email || 'orders@supplier.internal'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-emerald-primary" />
                    <span>Lead Time: <strong className="text-content-primary">{s.lead_time_days} days</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Package className="w-3.5 h-3.5 text-content-muted" />
                    <span>Supplying: <strong className="text-content-primary">{s.product_count} active SKUs</strong></span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-surface-border flex items-center justify-between">
                <span className="text-[11px] font-semibold text-content-secondary">
                  {s.active_purchase_orders || 0} active orders
                </span>
                <button
                  onClick={() => navigate('/reordering')}
                  className="flex items-center gap-1 text-xs font-bold text-emerald-primary hover:text-emerald-forest"
                >
                  <span>Order Items</span>
                  <ShoppingCart className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-surface-card border border-surface-border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <h3 className="text-base font-bold text-content-primary">Onboard Replenishment Vendor</h3>
              <button onClick={() => setShowAddModal(false)} className="text-content-secondary hover:text-content-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-content-secondary font-semibold mb-1">Company / Supplier Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Apex Industrial Supplies"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-surface-border rounded-lg text-xs focus:outline-none focus:border-emerald-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-content-secondary font-semibold mb-1">Contact Name</label>
                <input
                  type="text"
                  placeholder="Account Executive Name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full px-3 py-2 border border-surface-border rounded-lg text-xs focus:outline-none focus:border-emerald-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-content-secondary font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="orders@vendor.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-surface-border rounded-lg text-xs focus:outline-none focus:border-emerald-primary"
                  />
                </div>
                <div>
                  <label className="block text-content-secondary font-semibold mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="+1 555-0100"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-surface-border rounded-lg text-xs focus:outline-none focus:border-emerald-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-content-secondary font-semibold mb-1">Lead Time (Days)</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={leadTimeDays}
                    onChange={(e) => setLeadTimeDays(e.target.value)}
                    className="w-full px-3 py-2 border border-surface-border rounded-lg text-xs focus:outline-none focus:border-emerald-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-content-secondary font-semibold mb-1">Initial Rating (1–5)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="5.0"
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                    className="w-full px-3 py-2 border border-surface-border rounded-lg text-xs focus:outline-none focus:border-emerald-primary"
                  />
                </div>
              </div>

              {formError && (
                <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 font-semibold text-xs">
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-surface-border rounded-lg text-content-secondary font-semibold hover:bg-surface-bg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-emerald-primary hover:bg-emerald-hover text-white font-bold rounded-lg transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Add Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
