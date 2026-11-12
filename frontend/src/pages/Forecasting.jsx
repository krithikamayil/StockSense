import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  Cpu, 
  Activity, 
  Sparkles, 
  Layers, 
  ShieldCheck, 
  ShoppingCart,
  Calendar,
  AlertCircle
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
import StatCard from '../components/StatCard';
import StockBadge from '../components/StockBadge';

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

export default function Forecasting() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(searchParams.get('product_id') || '');
  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load product list for selector
  useEffect(() => {
    fetchProducts();
  }, []);

  // Fetch forecast whenever selected product changes
  useEffect(() => {
    if (selectedProductId) {
      fetchForecast(selectedProductId);
    }
  }, [selectedProductId]);

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products?limit=100');
      if (res.data.success && res.data.data.length > 0) {
        setProducts(res.data.data);
        if (!selectedProductId) {
          setSelectedProductId(res.data.data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchForecast = async (prodId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/forecasts/product/${prodId}`);
      if (res.data.success) {
        setForecastData(res.data.data);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error?.message || 'Failed to generate demand forecast.');
    } finally {
      setLoading(false);
    }
  };

  const { product, metrics = {}, history = [], forecast = [], model_used, source } = forecastData || {};

  // Build combined timeline labels and datasets for Chart.js
  const historyLabels = history.slice(-12).map(h => h.week_start);
  const forecastLabels = forecast.map((f, i) => `Week +${i+1}`);
  const allLabels = [...historyLabels, ...forecastLabels];

  // Historical line points (null for forecast period)
  const historyDataPoints = [
    ...history.slice(-12).map(h => h.units_sold),
    ...forecast.map(() => null)
  ];

  // Forecast line points (connecting from last historical point)
  const lastHistoryPoint = history.length > 0 ? history[history.length - 1].units_sold : 0;
  const forecastDataPoints = [
    ...history.slice(-12).map((_, i) => (i === history.slice(-12).length - 1 ? lastHistoryPoint : null)),
    ...forecast.map(f => f.predicted_units)
  ];

  // Upper Bound points
  const upperBoundPoints = [
    ...history.slice(-12).map(() => null),
    ...forecast.map(f => f.upper_bound)
  ];

  // Lower Bound points
  const lowerBoundPoints = [
    ...history.slice(-12).map(() => null),
    ...forecast.map(f => f.lower_bound)
  ];

  const chartData = {
    labels: allLabels,
    datasets: [
      {
        label: 'Historical Fulfilled Demand',
        data: historyDataPoints,
        borderColor: '#145A43',
        backgroundColor: '#145A43',
        tension: 0.25,
        pointRadius: 4,
      },
      {
        label: 'AI Forecast (Next 4 Weeks)',
        data: forecastDataPoints,
        borderColor: '#087F5B',
        backgroundColor: 'rgba(8, 127, 91, 0.1)',
        borderDash: [5, 5],
        tension: 0.25,
        pointRadius: 5,
        pointBackgroundColor: '#087F5B',
      },
      {
        label: 'Upper Confidence Bound (95%)',
        data: upperBoundPoints,
        borderColor: 'rgba(32, 201, 151, 0.4)',
        borderDash: [2, 2],
        fill: false,
        pointRadius: 0,
      },
      {
        label: 'Lower Confidence Bound',
        data: lowerBoundPoints,
        borderColor: 'rgba(32, 201, 151, 0.4)',
        borderDash: [2, 2],
        fill: '-1',
        backgroundColor: 'rgba(8, 127, 91, 0.06)',
        pointRadius: 0,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { boxWidth: 12, font: { size: 11 }, color: '#182923' }
      },
      tooltip: {
        backgroundColor: '#182923',
        padding: 8,
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#718078', font: { size: 10 } }
      },
      y: {
        grid: { color: '#E5ECE8' },
        ticks: { color: '#718078', font: { size: 10 }, precision: 0 }
      }
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header & SKU Dropdown */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-content-primary tracking-tight">Demand Forecasting & Reorder Point Model</h2>
            <span className="flex items-center gap-1 text-[11px] font-bold bg-emerald-sage text-emerald-forest px-2.5 py-0.5 rounded-full border border-emerald-primary/20">
              <Sparkles className="w-3 h-3 text-emerald-primary" /> Python FastAPI Engine
            </span>
          </div>
          <p className="text-xs text-content-secondary mt-0.5">
            4-week demand projection fitted using polynomial regression, moving-average trend factors, and dynamic safety stock (Z=1.65).
          </p>
        </div>

        {/* Product Picker */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-content-secondary">Select SKU:</label>
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="px-3 py-1.5 text-xs bg-surface-card border border-surface-border rounded-lg font-semibold text-content-primary focus:outline-none focus:border-emerald-primary max-w-xs truncate"
          >
            {products.map(p => (
              <option key={p.id} value={p.id}>
                {p.sku} — {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-emerald-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-content-secondary">Computing Machine Learning Projections...</span>
        </div>
      ) : error ? (
        <div className="p-6 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-semibold">{error}</span>
        </div>
      ) : (
        <>
          {/* Machine Learning Model Diagnostics Header */}
          <div className="p-4 rounded-xl border border-surface-border bg-surface-card shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-sage text-emerald-forest flex items-center justify-center font-bold">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-content-primary">
                  Model: <span className="font-mono text-emerald-forest">{model_used || 'ENSEMBLE_TREND_REGRESSION'}</span>
                </p>
                <p className="text-content-secondary text-[11px]">
                  Execution Source: <span className="font-bold uppercase text-emerald-primary">{source || 'AI_SERVICE'}</span> • Supplier Lead Time: <span className="font-semibold">{product?.lead_time_days || 7} days</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs">
              {metrics.mae !== undefined && metrics.mae !== null && (
                <div className="px-3 py-1 bg-surface-bg rounded-lg border border-surface-border">
                  <span className="text-content-secondary text-[10px] block">Mean Absolute Error (MAE)</span>
                  <span className="font-mono font-bold text-content-primary">{metrics.mae} units</span>
                </div>
              )}
              {metrics.rmse !== undefined && metrics.rmse !== null && (
                <div className="px-3 py-1 bg-surface-bg rounded-lg border border-surface-border">
                  <span className="text-content-secondary text-[10px] block">Root Mean Sq Error (RMSE)</span>
                  <span className="font-mono font-bold text-content-primary">{metrics.rmse} units</span>
                </div>
              )}
              <div className="px-3 py-1 bg-surface-bg rounded-lg border border-surface-border">
                <span className="text-content-secondary text-[10px] block">Trend Factor (clamped)</span>
                <span className="font-mono font-bold text-emerald-forest">{metrics.trend_factor}×</span>
              </div>
            </div>
          </div>

          {/* 4 Formulation Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="Avg Daily Demand (D_avg)"
              value={`${metrics.avg_daily_demand} units/day`}
              subtitle={`Mean Weekly Sales / 7`}
              icon={Activity}
              variant="default"
            />
            <StatCard
              title="Daily Demand Std Dev (σ)"
              value={`${metrics.daily_std_dev} units`}
              subtitle={`Demand variance`}
              icon={TrendingUp}
              variant="default"
            />
            <StatCard
              title="Safety Stock (SS)"
              value={`${metrics.safety_stock} units`}
              subtitle={`Z=1.65 × σ × √LeadTime`}
              icon={ShieldCheck}
              variant="emerald"
            />
            <StatCard
              title="Calculated Reorder Point (ROP)"
              value={`${metrics.reorder_point} units`}
              subtitle={`(D_avg × L) + Safety Stock`}
              icon={Layers}
              variant={product?.current_stock <= metrics.reorder_point ? "amber" : "default"}
            />
          </div>

          {/* Historical vs Forecast Chart */}
          <div className="p-6 rounded-xl border border-surface-border bg-surface-card shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-content-primary uppercase tracking-wider">
                  Demand Curve & 4-Week AI Forecast Band
                </h3>
                <p className="text-xs text-content-secondary">
                  Delivered sales observations with projected trend and 95% service-level uncertainty bounds
                </p>
              </div>
              <button
                onClick={() => navigate('/reordering')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-primary text-white text-xs font-bold rounded-lg hover:bg-emerald-hover transition shadow-sm"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Go to Reorder Queue</span>
              </button>
            </div>

            <div className="h-80">
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>

          {/* Forecast Weekly Breakdown Table */}
          <div className="p-6 rounded-xl border border-surface-border bg-surface-card shadow-sm">
            <h3 className="text-sm font-bold text-content-primary uppercase tracking-wider mb-3">
              Weekly Predicted Demand & Bounds
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-surface-border text-content-secondary uppercase text-[10px] tracking-wider font-semibold">
                    <th className="pb-2.5">Horizon</th>
                    <th className="pb-2.5">Target Week</th>
                    <th className="pb-2.5">Predicted Demand</th>
                    <th className="pb-2.5">Lower Bound (Uncertainty)</th>
                    <th className="pb-2.5">Upper Bound (Peak)</th>
                    <th className="pb-2.5 text-right">Replenishment Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {forecast.map((f, idx) => (
                    <tr key={idx} className="hover:bg-surface-bg/50">
                      <td className="py-3 font-semibold text-emerald-forest">Week +{f.week_number}</td>
                      <td className="py-3 text-content-secondary">Forward Projection Horizon</td>
                      <td className="py-3 font-mono font-bold text-sm text-content-primary">{f.predicted_units} units</td>
                      <td className="py-3 text-content-secondary font-mono">{f.lower_bound} units</td>
                      <td className="py-3 text-content-secondary font-mono">{f.upper_bound} units</td>
                      <td className="py-3 text-right">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-sage text-emerald-forest">
                          Protected by Safety Stock ({metrics.safety_stock})
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
