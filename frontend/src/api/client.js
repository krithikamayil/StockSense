import axios from 'axios';
import {
  demoSummary,
  demoRevenueSeries,
  demoCategoryBreakdown,
  demoTopReorderItems,
  demoProducts,
  demoSuppliers,
  demoPurchaseOrders
} from './demoData';

const isGitHubPages = typeof window !== 'undefined' && window.location.hostname.includes('github.io');

const api = axios.create({
  baseURL: isGitHubPages ? 'https://stocksense.demo/api' : '/api',
  timeout: isGitHubPages ? 500 : 5000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('stocksense_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Fallback demo mock responder for GitHub Pages & offline deployment
function handleMockResponse(config) {
  const url = config.url || '';
  const method = (config.method || 'get').toLowerCase();

  // 1. Auth Login
  if (url.includes('/auth/login')) {
    const body = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : (config.data || {});
    const email = body.email || 'admin@stocksense.io';
    let role = 'Admin';
    if (email.includes('manager')) role = 'Manager';
    else if (email.includes('staff')) role = 'Staff';
    else if (email.includes('supplier')) role = 'Supplier';

    return {
      data: {
        success: true,
        token: 'demo_jwt_token_for_github_pages',
        user: {
          id: 'usr_demo_01',
          name: `${role} Evaluator`,
          email: email,
          role: role
        }
      },
      status: 200
    };
  }

  // 2. Auth Profile
  if (url.includes('/auth/me')) {
    return {
      data: {
        success: true,
        user: JSON.parse(localStorage.getItem('stocksense_user') || '{"name":"Admin Evaluator","role":"Admin","email":"admin@stocksense.io"}')
      },
      status: 200
    };
  }

  // 3. Analytics Dashboard
  if (url.includes('/analytics/dashboard')) {
    return {
      data: {
        success: true,
        data: {
          summary: demoSummary,
          revenueSeries: demoRevenueSeries,
          categoryBreakdown: demoCategoryBreakdown,
          topReorderItems: demoTopReorderItems
        }
      },
      status: 200
    };
  }

  // 4. Inventory List
  if (url.includes('/inventory') && !url.includes('/adjust')) {
    return {
      data: {
        success: true,
        data: demoProducts,
        total: demoProducts.length
      },
      status: 200
    };
  }

  // 5. Products List
  if (url.includes('/products') && !url.match(/\/products\/[\w-]+/)) {
    return {
      data: {
        success: true,
        data: demoProducts,
        total: demoProducts.length
      },
      status: 200
    };
  }

  // 6. Single Product Details
  if (url.match(/\/products\/[\w-]+/)) {
    const prod = demoProducts[0];
    return {
      data: {
        success: true,
        data: {
          ...prod,
          weekly_sales: [12, 14, 15, 13, 16, 18, 20, 22, 19, 21, 24, 26, 28, 25, 30],
          history: [
            { week: 'W-1', units: 30 }, { week: 'W-2', units: 25 }, { week: 'W-3', units: 28 }, { week: 'W-4', units: 26 },
            { week: 'W-5', units: 24 }, { week: 'W-6', units: 21 }, { week: 'W-7', units: 19 }, { week: 'W-8', units: 22 }
          ],
          movements: [
            { id: 1, movement_type: 'RECEIVE', quantity: 45, reason: 'PO-2026-001 Received', created_at: '2026-11-08' },
            { id: 2, movement_type: 'SALE', quantity: -12, reason: 'Delivered Customer Orders', created_at: '2026-11-09' }
          ]
        }
      },
      status: 200
    };
  }

  // 7. Demand Forecast
  if (url.includes('/forecasts')) {
    return {
      data: {
        success: true,
        data: {
          product_id: 'prod_952670bc',
          source: 'AI_SERVICE',
          model_used: 'ENSEMBLE_TREND_REGRESSION',
          metrics: {
            avg_daily_demand: 3.86,
            safety_stock: 6,
            reorder_point: 14,
            eoq: 45,
            trend_factor: 1.18,
            mae: 1.45,
            rmse: 1.82
          },
          forecast: [
            { week_number: 1, predicted_units: 28, lower_bound: 23, upper_bound: 34 },
            { week_number: 2, predicted_units: 30, lower_bound: 24, upper_bound: 36 },
            { week_number: 3, predicted_units: 32, lower_bound: 26, upper_bound: 38 },
            { week_number: 4, predicted_units: 34, lower_bound: 27, upper_bound: 41 }
          ]
        }
      },
      status: 200
    };
  }

  // 8. Reorder Recommendations
  if (url.includes('/reorder/recommendations')) {
    return {
      data: {
        success: true,
        data: demoTopReorderItems
      },
      status: 200
    };
  }

  // 9. Dead Stock
  if (url.includes('/dead-stock')) {
    return {
      data: {
        success: true,
        data: {
          liquidate: demoProducts.filter(p => p.status === 'LIQUIDATE'),
          discount: demoProducts.filter(p => p.status === 'DISCOUNT'),
          summary: { liquidateCount: 1, discountCount: 1, capitalTiedUp: 2127.00 }
        }
      },
      status: 200
    };
  }

  // 10. Suppliers
  if (url.includes('/suppliers')) {
    return {
      data: {
        success: true,
        data: demoSuppliers
      },
      status: 200
    };
  }

  // 11. Purchase Orders
  if (url.includes('/purchase-orders')) {
    return {
      data: {
        success: true,
        data: demoPurchaseOrders
      },
      status: 200
    };
  }

  // 12. AI Assistant Chat
  if (url.includes('/ai/chat')) {
    const body = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : (config.data || {});
    const q = (body.message || '').toLowerCase();
    let reply = `🤖 StockSense AI: All system nodes are operational. You currently have 64 SKUs operating below their safety threshold (ROP), with 2 purchase orders pending replenishment.`;
    const actions = [
      { label: 'View Reorder Queue', route: '/reordering' },
      { label: 'Inspect Low Stock', route: '/inventory' }
    ];

    if (q.includes('valuation') || q.includes('kpi')) {
      reply = `📊 Total inventory valuation is $345,300.62 across 300 monitored SKUs in the Olist catalog.`;
      actions[0] = { label: 'Open Dashboard', route: '/dashboard' };
    } else if (q.includes('dead') || q.includes('stagnant')) {
      reply = `📦 Dead stock analysis flagged 1 SKU for liquidation write-off and 1 SKU for clearance discounts.`;
      actions[0] = { label: 'Review Dead Stock', route: '/dead-stock' };
    } else if (q.includes('forecast')) {
      reply = `📈 Demand forecasting uses polynomial trend regression with dynamic safety stock (Z=1.65).`;
      actions[0] = { label: 'View Forecasting', route: '/forecasting' };
    }

    return {
      data: {
        success: true,
        data: {
          reply: reply,
          suggested_actions: actions,
          source: 'AI_SERVICE'
        }
      },
      status: 200
    };
  }

  // 13. Notifications
  if (url.includes('/notifications')) {
    return {
      data: {
        success: true,
        data: [
          { id: 1, title: 'Low Stock Alert', message: '64 SKUs have breached their Reorder Point threshold.', is_read: false, created_at: '2026-11-12T10:00:00Z' },
          { id: 2, title: 'Purchase Order Approved', message: 'PO-2026-001 approved by System Administrator.', is_read: true, created_at: '2026-11-12T09:00:00Z' }
        ],
        unread_count: 1
      },
      status: 200
    };
  }

  return {
    data: { success: true, message: 'Action simulated successfully.' },
    status: 200
  };
}

// Response interceptor with graceful mock fallback on network/404 errors or GitHub Pages
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If running on GitHub Pages OR backend server is offline, provide mock data
    if (isGitHubPages || !error.response || error.response.status === 404 || error.code === 'ERR_NETWORK') {
      const mock = handleMockResponse(error.config);
      if (mock) {
        return Promise.resolve(mock);
      }
    }

    if (error.response && error.response.status === 401) {
      if (!window.location.hash.includes('/login') && !window.location.pathname.includes('/login')) {
        localStorage.removeItem('stocksense_token');
        localStorage.removeItem('stocksense_user');
        window.location.hash = '#/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
