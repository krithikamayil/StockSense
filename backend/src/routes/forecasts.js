const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const aiService = require('../services/aiService');

/**
 * GET /api/forecasts/product/:id
 */
router.get('/product/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get product and lead time
    const prodRes = await db.query(`
      SELECT p.*, COALESCE(s.lead_time_days, 7) as lead_time_days, i.current_stock, i.reorder_point, i.safety_stock, i.eoq
      FROM products p
      LEFT JOIN suppliers s ON p.primary_supplier_id = s.id
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE p.id = $1
    `, [id]);

    if (prodRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found.' } });
    }

    const product = prodRes.rows[0];

    // Get historical weekly delivered sales ordered chronologically
    const salesRes = await db.query(`
      SELECT 
        DATE_TRUNC('week', order_date)::DATE as week_start,
        SUM(quantity) as units_sold
      FROM sales
      WHERE product_id = $1 AND order_status = 'delivered'
      GROUP BY DATE_TRUNC('week', order_date)
      ORDER BY week_start ASC
    `, [id]);

    const weeklyHistory = salesRes.rows.map(r => ({
      week_start: r.week_start,
      units_sold: parseInt(r.units_sold, 10)
    }));

    const weeklyUnits = weeklyHistory.map(w => w.units_sold);

    // Call AI forecasting service (with automatic JS fallback)
    const forecastResult = await aiService.getProductForecast(
      id,
      weeklyUnits,
      product.lead_time_days,
      product.cost_price || product.price * 0.55
    );

    // Save forecast to database cache if calculated
    if (forecastResult.forecast && forecastResult.forecast.length > 0) {
      // Latest valid date in history or current date as as_of_date
      const lastWeek = weeklyHistory.length > 0 ? weeklyHistory[weeklyHistory.length - 1].week_start : '2018-08-29';
      for (const fc of forecastResult.forecast) {
        await db.query(`
          INSERT INTO forecasts (product_id, as_of_date, week_start_date, predicted_units, lower_bound, upper_bound, baseline_sma, trend_factor, model_used)
          VALUES ($1, $2, CURRENT_DATE + ($3 * 7), $4, $5, $6, $7, $8, $9)
          ON CONFLICT DO NOTHING
        `, [
          id,
          lastWeek,
          fc.week_number || 1,
          fc.predicted_units,
          fc.lower_bound || 0,
          fc.upper_bound || 0,
          forecastResult.metrics?.baseline_sma || 0,
          forecastResult.metrics?.trend_factor || 1.0,
          forecastResult.model_used || 'AI_SERVICE'
        ]);
      }
    }

    res.json({
      success: true,
      data: {
        product: {
          id: product.id,
          sku: product.sku,
          name: product.name,
          current_stock: product.current_stock,
          lead_time_days: product.lead_time_days,
        },
        metrics: forecastResult.metrics,
        history: weeklyHistory,
        forecast: forecastResult.forecast,
        model_used: forecastResult.model_used,
        source: forecastResult.source
      }
    });
  } catch (error) {
    console.error('Error generating forecast:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to generate demand forecast.' } });
  }
});

/**
 * GET /api/forecasts/summary
 */
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const summaryQuery = `
      SELECT 
        p.id,
        p.sku,
        p.name,
        c.name as category_name,
        i.current_stock,
        i.safety_stock,
        i.reorder_point,
        i.eoq,
        s.name as supplier_name,
        COALESCE(SUM(sa.quantity), 0) as total_historical_sales,
        COALESCE(COUNT(DISTINCT sa.order_id), 0) as total_orders
      FROM products p
      JOIN inventory i ON p.id = i.product_id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.primary_supplier_id = s.id
      LEFT JOIN sales sa ON p.id = sa.product_id AND sa.order_status = 'delivered'
      WHERE p.is_active = TRUE
      GROUP BY p.id, p.sku, p.name, c.name, i.current_stock, i.safety_stock, i.reorder_point, i.eoq, s.name
      ORDER BY total_historical_sales DESC
      LIMIT 50
    `;
    const result = await db.query(summaryQuery);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching forecast summary:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to retrieve summary.' } });
  }
});

module.exports = router;
