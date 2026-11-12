import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Package, 
  Truck, 
  TrendingUp, 
  Calendar, 
  Layers, 
  ShieldAlert, 
  CheckCircle,
  ExternalLink,
  History,
  DollarSign
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import api from '../api/client';
import StockBadge from '../components/StockBadge';
import StatCard from '../components/StatCard';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProductDetails();
  }, [id]);

  const fetchProductDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/products/${id}`);
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error?.message || 'Failed to load product details.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-emerald-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-content-secondary">Loading SKU Profile...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <button onClick={() => navigate('/inventory')} className="flex items-center gap-2 text-xs font-bold text-emerald-primary mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Inventory
        </button>
        <div className="p-6 rounded-xl border border-rose-200 bg-rose-50 text-rose-800">
          <p className="text-sm font-bold">{error || 'Product not found.'}</p>
        </div>
      </div>
    );
  }

  const { product, sales_history = [], stock_movements = [] } = data;

  const grossMargin = product.price > 0 
    ? (((product.price - product.cost_price) / product.price) * 100).toFixed(1)
    : 0;

  // Weekly Sales History Chart
  const salesChartData = {
    labels: sales_history.map(s => s.week_start),
    datasets: [
      {
        label: 'Weekly Units Delivered',
        data: sales_history.map(s => parseInt(s.units_sold, 10)),
        borderColor: '#087F5B',
        backgroundColor: 'rgba(8, 127, 91, 0.1)',
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#087F5B',
        pointRadius: 3,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#182923',
        padding: 8,
        callbacks: {
          label: (ctx) => `Units Sold: ${ctx.raw} units`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#718078', font: { size: 10 }, maxRotation: 45 }
      },
      y: {
        grid: { color: '#E5ECE8' },
        ticks: { color: '#718078', font: { size: 10 }, precision: 0 }
      }
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Back button & Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/inventory')}
            className="p-2 border border-surface-border rounded-lg bg-surface-card hover:bg-surface-bg text-content-secondary transition"
            title="Back to Inventory"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold bg-surface-bg border border-surface-border px-2 py-0.5 rounded text-emerald-forest">
                {product.sku}
              </span>
              <StockBadge 
                status={
                  product.current_stock === 0 ? 'OUT_OF_STOCK' : 
                  product.current_stock <= product.reorder_point ? 'LOW_STOCK' : 'HEALTHY'
                } 
              />
            </div>
            <h2 className="text-xl font-bold text-content-primary mt-1">{product.name}</h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/forecasting?product_id=${product.id}`)}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-primary text-white text-xs font-bold rounded-lg hover:bg-emerald-hover transition shadow-sm"
          >
            <TrendingUp className="w-4 h-4" />
            <span>Generate Demand Forecast</span>
          </button>
        </div>
      </div>

      {/* Product Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Current Stock"
          value={`${product.current_stock} units`}
          subtitle={`Available: ${product.current_stock - product.reserved_stock} | Reserved: ${product.reserved_stock}`}
          icon={Package}
          variant={product.current_stock <= product.reorder_point ? "amber" : "default"}
        />
        <StatCard
          title="Reorder Point (ROP)"
          value={`${product.reorder_point} units`}
          subtitle={`Safety Stock: ${product.safety_stock} units (Z=1.65)`}
          icon={ShieldAlert}
          variant="default"
        />
        <StatCard
          title="Economic Order Qty (EOQ)"
          value={`${product.eoq} units`}
          subtitle={`Order Cost: $${product.order_cost} | Holding: ${(product.holding_cost_rate * 100).toFixed(0)}%`}
          icon={Layers}
          variant="default"
        />
        <StatCard
          title="Unit Economics"
          value={`$${parseFloat(product.price).toFixed(2)}`}
          subtitle={`Cost: $${parseFloat(product.cost_price).toFixed(2)} (${grossMargin}% margin)`}
          icon={DollarSign}
          variant="emerald"
        />
      </div>

      {/* Main Content 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Historical Delivered Sales Chart */}
        <div className="lg:col-span-2 p-6 rounded-xl border border-surface-border bg-surface-card shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-content-primary uppercase tracking-wider">
                Delivered Historical Sales Timeline
              </h3>
              <p className="text-xs text-content-secondary">
                Weekly fulfilled sales from Olist dataset ({sales_history.length} active weeks observed)
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-primary bg-emerald-sage px-2.5 py-1 rounded">
              Fulfilled Orders: {sales_history.reduce((a, b) => a + parseInt(b.units_sold, 10), 0)} units
            </span>
          </div>

          <div className="h-64">
            {sales_history.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-content-secondary">
                No historical sales recorded for this SKU.
              </div>
            ) : (
              <Line data={salesChartData} options={chartOptions} />
            )}
          </div>
        </div>

        {/* Right Column: Supplier & Specifications Card */}
        <div className="space-y-6">
          {/* Supplier Card */}
          <div className="p-6 rounded-xl border border-surface-border bg-surface-card shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-content-primary uppercase tracking-wider">
                Verified Replenishment Supplier
              </span>
              <Truck className="w-4 h-4 text-emerald-primary" />
            </div>

            <div className="space-y-2 text-xs">
              <p className="font-bold text-sm text-content-primary">{product.supplier_name || 'Apex Global Logistics'}</p>
              <p className="text-content-secondary">Contact: {product.supplier_email || 'orders@apexsupply.io'}</p>
              <div className="flex items-center justify-between pt-2 border-t border-surface-border">
                <span className="text-content-secondary">Lead Time:</span>
                <span className="font-bold text-content-primary">{product.lead_time_days} days</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-content-secondary">Supplier Rating:</span>
                <span className="font-bold text-emerald-primary">★ {product.supplier_rating || 4.8} / 5.0</span>
              </div>
            </div>
          </div>

          {/* Physical Specifications */}
          <div className="p-6 rounded-xl border border-surface-border bg-surface-card shadow-sm space-y-3 text-xs">
            <span className="text-xs font-bold text-content-primary uppercase tracking-wider block">
              Catalog Specifications
            </span>
            <div className="space-y-1.5 text-content-secondary">
              <div className="flex justify-between">
                <span>Category:</span>
                <span className="font-semibold text-content-primary">{product.category_name || 'General'}</span>
              </div>
              <div className="flex justify-between">
                <span>Weight:</span>
                <span className="font-semibold text-content-primary">{product.weight_g} grams</span>
              </div>
              <div className="flex justify-between">
                <span>Dimensions (L×W×H):</span>
                <span className="font-semibold text-content-primary">
                  {product.length_cm} × {product.width_cm} × {product.height_cm} cm
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total Holding Value:</span>
                <span className="font-mono font-bold text-emerald-forest">
                  ${(product.current_stock * product.cost_price).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Stock Movement Ledger */}
      <div className="p-6 rounded-xl border border-surface-border bg-surface-card shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-content-primary uppercase tracking-wider">
              Immutable Stock Movement Ledger
            </h3>
            <p className="text-xs text-content-secondary">
              Audit trail of every stock modification, purchase order receipt, and inventory adjustment
            </p>
          </div>
          <History className="w-4 h-4 text-content-secondary" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border text-content-secondary uppercase text-[10px] tracking-wider font-semibold">
                <th className="pb-3">Timestamp</th>
                <th className="pb-3">Type</th>
                <th className="pb-3">Quantity Delta</th>
                <th className="pb-3">Previous Stock</th>
                <th className="pb-3">New Stock</th>
                <th className="pb-3">Reference / Reason</th>
                <th className="pb-3 text-right">Auditor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {stock_movements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-content-secondary">
                    No recent movement events recorded for this SKU.
                  </td>
                </tr>
              ) : (
                stock_movements.map((mov) => (
                  <tr key={mov.id} className="hover:bg-surface-bg/50">
                    <td className="py-3 text-content-secondary">
                      {new Date(mov.created_at).toLocaleString()}
                    </td>
                    <td className="py-3">
                      <StockBadge status={mov.movement_type} />
                    </td>
                    <td className="py-3 font-mono font-bold">
                      <span className={mov.quantity_change > 0 ? 'text-emerald-primary' : 'text-rose-600'}>
                        {mov.quantity_change > 0 ? `+${mov.quantity_change}` : mov.quantity_change}
                      </span>
                    </td>
                    <td className="py-3 text-content-secondary">{mov.previous_stock}</td>
                    <td className="py-3 font-bold text-content-primary">{mov.new_stock}</td>
                    <td className="py-3 text-content-secondary max-w-xs truncate">
                      {mov.reference_id ? `${mov.reference_id} — ` : ''}{mov.reason || 'Standard operational update'}
                    </td>
                    <td className="py-3 text-right text-content-secondary">
                      {mov.user_name || 'System Auto'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
