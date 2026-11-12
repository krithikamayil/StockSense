const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/analytics/dashboard
 */
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    // 1. Overall counts & inventory valuation
    const kpiRes = await db.query(`
      SELECT 
        COUNT(DISTINCT p.id) as total_products,
        COALESCE(SUM(i.current_stock * p.cost_price), 0) as total_inventory_valuation,
        COALESCE(SUM(i.current_stock), 0) as total_units_in_stock,
        COUNT(DISTINCT CASE WHEN i.current_stock = 0 THEN p.id END) as out_of_stock_count,
        COUNT(DISTINCT CASE WHEN i.current_stock > 0 AND i.current_stock <= i.reorder_point THEN p.id END) as low_stock_count,
        COUNT(DISTINCT CASE WHEN i.current_stock > i.reorder_point THEN p.id END) as healthy_stock_count
      FROM products p
      JOIN inventory i ON p.id = i.product_id
      WHERE p.is_active = TRUE
    `);

    // 2. Pending purchase orders count & total pending value
    const poKpiRes = await db.query(`
      SELECT 
        COUNT(id) as pending_po_count,
        COALESCE(SUM(total_amount), 0) as pending_po_amount
      FROM purchase_orders 
      WHERE status IN ('PENDING_APPROVAL', 'APPROVED', 'ORDERED')
    `);

    // 3. Historical Sales KPIs (from delivered orders)
    const salesKpiRes = await db.query(`
      SELECT 
        COALESCE(SUM(total_price), 0) as total_sales_revenue,
        COALESCE(SUM(quantity), 0) as total_units_sold,
        COUNT(DISTINCT order_id) as total_delivered_orders,
        MIN(order_date) as earliest_sale_date,
        MAX(order_date) as latest_sale_date
      FROM sales
      WHERE order_status = 'delivered'
    `);

    // 4. Monthly sales revenue trend (last 12 months in data)
    const monthlySalesRes = await db.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', order_date), 'YYYY-MM') as month,
        SUM(total_price) as revenue,
        SUM(quantity) as units_sold
      FROM sales
      WHERE order_status = 'delivered'
      GROUP BY DATE_TRUNC('month', order_date)
      ORDER BY month DESC
      LIMIT 12
    `);

    // 5. Category distribution
    const categoryDistRes = await db.query(`
      SELECT 
        c.name as category_name,
        COUNT(p.id) as product_count,
        COALESCE(SUM(i.current_stock), 0) as total_stock,
        COALESCE(SUM(i.current_stock * p.cost_price), 0) as category_valuation
      FROM categories c
      JOIN products p ON c.id = p.category_id AND p.is_active = TRUE
      JOIN inventory i ON p.id = i.product_id
      GROUP BY c.name
      ORDER BY category_valuation DESC
      LIMIT 8
    `);

    // 6. Recent low-stock alerts
    const lowStockAlertsRes = await db.query(`
      SELECT 
        p.id,
        p.sku,
        p.name,
        i.current_stock,
        i.reorder_point,
        i.safety_stock,
        s.name as supplier_name,
        s.lead_time_days
      FROM products p
      JOIN inventory i ON p.id = i.product_id
      LEFT JOIN suppliers s ON p.primary_supplier_id = s.id
      WHERE p.is_active = TRUE AND i.current_stock <= i.reorder_point
      ORDER BY i.current_stock ASC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        kpis: {
          total_products: parseInt(kpiRes.rows[0].total_products, 10),
          total_inventory_valuation: parseFloat(kpiRes.rows[0].total_inventory_valuation),
          total_units_in_stock: parseInt(kpiRes.rows[0].total_units_in_stock, 10),
          out_of_stock_count: parseInt(kpiRes.rows[0].out_of_stock_count, 10),
          low_stock_count: parseInt(kpiRes.rows[0].low_stock_count, 10),
          healthy_stock_count: parseInt(kpiRes.rows[0].healthy_stock_count, 10),
          pending_pos_count: parseInt(poKpiRes.rows[0].pending_po_count, 10),
          pending_pos_amount: parseFloat(poKpiRes.rows[0].pending_po_amount),
          total_historical_revenue: parseFloat(salesKpiRes.rows[0].total_sales_revenue),
          total_units_sold: parseInt(salesKpiRes.rows[0].total_units_sold, 10),
          as_of_date: salesKpiRes.rows[0].latest_sale_date || '2018-08-29'
        },
        monthly_sales: monthlySalesRes.rows.reverse(),
        category_distribution: categoryDistRes.rows,
        urgent_reorder_alerts: lowStockAlertsRes.rows
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to retrieve analytics.' } });
  }
});

/**
 * GET /api/analytics/sales-history
 */
router.get('/sales-history', authenticateToken, async (req, res) => {
  try {
    const weeklySalesRes = await db.query(`
      SELECT 
        DATE_TRUNC('week', order_date)::DATE as week_start,
        SUM(total_price) as revenue,
        SUM(quantity) as units_sold
      FROM sales
      WHERE order_status = 'delivered'
      GROUP BY DATE_TRUNC('week', order_date)
      ORDER BY week_start ASC
    `);

    res.json({ success: true, data: weeklySalesRes.rows });
  } catch (error) {
    console.error('Error fetching sales history:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to retrieve sales history.' } });
  }
});

module.exports = router;
