import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  DollarSign, 
  Package, 
  AlertTriangle, 
  ShoppingCart, 
  TrendingUp, 
  ArrowRight,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import api from '../api/client';
import StatCard from '../components/StatCard';
import StockBadge from '../components/StockBadge';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/analytics/dashboard');
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load dashboard analytics.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-emerald-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-content-secondary">Loading Inventory Intelligence...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <div className="p-6 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 flex items-center justify-between">
          <p className="text-sm font-semibold">{error || 'Could not fetch data'}</p>
          <button onClick={fetchDashboardData} className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { kpis, monthly_sales = [], category_distribution = [], urgent_reorder_alerts = [] } = data;

  // Chart 1: Monthly Revenue Trend
  const monthlyRevenueChartData = {
    labels: monthly_sales.map(m => m.month),
    datasets: [
      {
        label: 'Historical Fulfilled Revenue ($)',
        data: monthly_sales.map(m => parseFloat(m.revenue)),
        borderColor: '#087F5B',
        backgroundColor: 'rgba(8, 127, 91, 0.08)',
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#087F5B',
        pointRadius: 4,
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
        titleFont: { size: 12, weight: 'bold' },
        bodyFont: { size: 12 },
        padding: 10,
        callbacks: {
          label: (ctx) => `Revenue: $${ctx.raw.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#718078', font: { size: 11 } }
      },
      y: {
        grid: { color: '#E5ECE8' },
        ticks: {
          color: '#718078',
          font: { size: 11 },
          callback: (v) => `$${v.toLocaleString()}`
        }
      }
    }
  };

  // Chart 2: Category Valuation Distribution
  const categoryChartData = {
    labels: category_distribution.map(c => c.category_name),
    datasets: [
      {
        data: category_distribution.map(c => parseFloat(c.category_valuation)),
        backgroundColor: [
          '#087F5B', '#145A43', '#20c997', '#0ca678', 
          '#63e6be', '#38d9a9', '#12b886', '#a9e34b'
        ],
        borderWidth: 2,
        borderColor: '#FFFFFF',
      }
    ]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: { boxWidth: 12, font: { size: 11 }, color: '#182923' }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.label}: $${ctx.raw.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
        }
      }
    },
    cutout: '68%'
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Banner Alert if low stock exists */}
      {kpis.low_stock_count > 0 && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-200 text-amber-900 flex items-center justify-center font-bold">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-950">
                Action Required: {kpis.low_stock_count} SKUs Have Breached Reorder Thresholds
              </p>
              <p className="text-xs text-amber-800">
                Calculated based on dynamic safety stock (Z=1.65) and supplier lead times.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/reordering')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-primary text-white text-xs font-bold rounded-lg hover:bg-emerald-hover transition shadow-sm"
          >
            <span>Review Reorder Queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Inventory Valuation"
          value={`$${kpis.total_inventory_valuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle={`${kpis.total_units_in_stock.toLocaleString()} units across ${kpis.total_products} SKUs`}
          icon={DollarSign}
          variant="emerald"
        />
        <StatCard
          title="Urgent Low Stock Items"
          value={kpis.low_stock_count}
          subtitle={`Current stock ≤ calculated ROP`}
          icon={AlertTriangle}
          variant={kpis.low_stock_count > 0 ? "amber" : "default"}
        />
        <StatCard
          title="Stockouts (0 Units)"
          value={kpis.out_of_stock_count}
          subtitle={`Requires emergency replenishment`}
          icon={Package}
          variant={kpis.out_of_stock_count > 0 ? "rose" : "default"}
        />
        <StatCard
          title="Pending Purchase Orders"
          value={kpis.pending_pos_count}
          subtitle={`$${kpis.pending_pos_amount.toLocaleString()} committed`}
          icon={ShoppingCart}
          variant="default"
        />
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trajectory (2 Cols) */}
        <div className="lg:col-span-2 p-6 rounded-xl border border-surface-border bg-surface-card shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-content-primary uppercase tracking-wider">
                Delivered Sales Revenue Velocity
              </h2>
              <p className="text-xs text-content-secondary">
                Verified fulfilled sales from Olist dataset (preserved dates)
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-primary bg-emerald-sage px-2.5 py-1 rounded-md">
              Total: ${kpis.total_historical_revenue.toLocaleString()}
            </span>
          </div>
          <div className="h-72">
            <Line data={monthlyRevenueChartData} options={chartOptions} />
          </div>
        </div>

        {/* Category Share (1 Col) */}
        <div className="p-6 rounded-xl border border-surface-border bg-surface-card shadow-sm flex flex-col">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-content-primary uppercase tracking-wider">
              Capital Tied Up by Category
            </h2>
            <p className="text-xs text-content-secondary">
              Valuation distribution across product lines
            </p>
          </div>
          <div className="h-72 flex-1 relative flex items-center justify-center">
            <Doughnut data={categoryChartData} options={doughnutOptions} />
          </div>
        </div>
      </div>

      {/* Urgent Reorder Queue Table */}
      <div className="p-6 rounded-xl border border-surface-border bg-surface-card shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-bold text-content-primary uppercase tracking-wider">
              Immediate Reorder Priority Queue
            </h2>
            <p className="text-xs text-content-secondary">
              Top items where current stock has fallen below Reorder Point (ROP = ADD × Lead Time + Safety Stock)
            </p>
          </div>
          <button
            onClick={() => navigate('/reordering')}
            className="text-xs font-bold text-emerald-primary hover:text-emerald-forest flex items-center gap-1"
          >
            <span>View All Reorder Items</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border text-content-secondary uppercase text-[10px] tracking-wider font-semibold">
                <th className="pb-3">SKU</th>
                <th className="pb-3">Product Name</th>
                <th className="pb-3">Current Stock</th>
                <th className="pb-3">Safety Stock (SS)</th>
                <th className="pb-3">Reorder Point (ROP)</th>
                <th className="pb-3">Supplier Lead Time</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {urgent_reorder_alerts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-content-secondary">
                    No urgent stockout alerts at this moment.
                  </td>
                </tr>
              ) : (
                urgent_reorder_alerts.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-bg/60 transition">
                    <td className="py-3 font-mono font-bold text-content-primary">{item.sku}</td>
                    <td className="py-3 font-medium text-content-primary max-w-xs truncate">{item.name}</td>
                    <td className="py-3">
                      <span className={`font-bold ${item.current_stock === 0 ? 'text-rose-600' : 'text-amber-700'}`}>
                        {item.current_stock} units
                      </span>
                    </td>
                    <td className="py-3 text-content-secondary">{item.safety_stock} units</td>
                    <td className="py-3 font-semibold text-content-primary">{item.reorder_point} units</td>
                    <td className="py-3 text-content-secondary">{item.lead_time_days} days ({item.supplier_name})</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => navigate(`/reordering`)}
                        className="px-2.5 py-1 bg-emerald-sage text-emerald-forest hover:bg-emerald-primary hover:text-white text-xs font-bold rounded transition"
                      >
                        Reorder
                      </button>
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
