const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireRoles } = require('../middleware/auth');
const businessLogic = require('../services/businessLogic');

/**
 * GET /api/dead-stock
 * Evaluates products for dead stock / stagnation
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Fetch products with their inventory and sales dates
    const productsRes = await db.query(`
      SELECT 
        p.id,
        p.sku,
        p.name,
        p.cost_price,
        p.price,
        c.name as category_name,
        i.current_stock,
        (i.current_stock * p.cost_price) as total_holding_value,
        MAX(s.order_date) as last_sold_at,
        COALESCE(SUM(CASE WHEN s.order_date >= CURRENT_DATE - INTERVAL '60 days' THEN s.quantity ELSE 0 END), 0) as recent_60d_sales
      FROM products p
      JOIN inventory i ON p.id = i.product_id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN sales s ON p.id = s.product_id AND s.order_status = 'delivered'
      WHERE p.is_active = TRUE AND i.current_stock > 0
      GROUP BY p.id, p.sku, p.name, p.cost_price, p.price, c.name, i.current_stock
    `);

    // For each product, evaluate recent weekly sales trajectory
    const deadStockItems = [];
    let totalTiedUpCapital = 0;
    let liquidateCount = 0;
    let discountCount = 0;

    for (const prod of productsRes.rows) {
      // Get weekly sales for the last 12 weeks
      const weeklyRes = await db.query(`
        SELECT 
          DATE_TRUNC('week', order_date)::DATE as week_start,
          SUM(quantity) as units_sold
        FROM sales
        WHERE product_id = $1 AND order_status = 'delivered'
        GROUP BY DATE_TRUNC('week', order_date)
        ORDER BY week_start ASC
      `, [prod.id]);

      const weeklySales = weeklyRes.rows.map(w => parseInt(w.units_sold, 10));
      const evaluation = businessLogic.evaluateDeadStockStatus(weeklySales);

      if (evaluation.status === 'LIQUIDATE' || evaluation.status === 'DISCOUNT') {
        const itemVal = parseFloat(prod.total_holding_value) || 0;
        totalTiedUpCapital += itemVal;

        if (evaluation.status === 'LIQUIDATE') liquidateCount++;
        if (evaluation.status === 'DISCOUNT') discountCount++;

        deadStockItems.push({
          product_id: prod.id,
          sku: prod.sku,
          name: prod.name,
          category_name: prod.category_name,
          current_stock: prod.current_stock,
          cost_price: prod.cost_price,
          price: prod.price,
          holding_value: itemVal,
          last_sold_at: prod.last_sold_at,
          dead_stock_status: evaluation.status,
          reason: evaluation.reason,
          recommended_action: evaluation.action,
          trailing_zero_weeks: evaluation.trailingZeroWeeks,
          sales_drop_pct: evaluation.salesDropPct || 0
        });
      }
    }

    // Sort by tied up holding value descending
    deadStockItems.sort((a, b) => b.holding_value - a.holding_value);

    res.json({
      success: true,
      summary: {
        total_stagnant_items: deadStockItems.length,
        total_tied_up_capital: totalTiedUpCapital,
        liquidate_count: liquidateCount,
        discount_count: discountCount
      },
      data: deadStockItems
    });
  } catch (error) {
    console.error('Error analyzing dead stock:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to analyze dead stock.' } });
  }
});

/**
 * POST /api/dead-stock/action
 * Apply recommended action (discount price or liquidate/write off)
 */
router.post('/action', authenticateToken, requireRoles('Admin', 'Manager'), async (req, res) => {
  const client = await db.getClient();
  try {
    const { product_id, action_type, discount_percent, liquidation_units, reason } = req.body;

    if (!product_id || !action_type) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Product ID and action type required.' }
      });
    }

    await client.query('BEGIN');

    if (action_type === 'APPLY_DISCOUNT') {
      const discount = Math.min(Math.max(Number(discount_percent || 20), 5), 75);
      const updateRes = await client.query(`
        UPDATE products 
        SET price = ROUND(price * (1.0 - ($1 / 100.0)), 2), updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [discount, product_id]);

      await client.query('COMMIT');
      return res.json({
        success: true,
        message: `Applied ${discount}% clearance discount successfully.`,
        data: updateRes.rows[0]
      });
    } else if (action_type === 'LIQUIDATE') {
      // Deduct liquidated units from stock and record in ledger
      const invRes = await client.query('SELECT current_stock FROM inventory WHERE product_id = $1 FOR UPDATE', [product_id]);
      const current = invRes.rows[0]?.current_stock || 0;
      const unitsToRemove = Math.min(Number(liquidation_units || current), current);

      await client.query(`
        UPDATE inventory 
        SET current_stock = current_stock - $1, updated_at = CURRENT_TIMESTAMP 
        WHERE product_id = $2
      `, [unitsToRemove, product_id]);

      await client.query(`
        INSERT INTO stock_movements (product_id, movement_type, quantity_change, previous_stock, new_stock, reason, user_id)
        VALUES ($1, 'ADJUSTMENT', -$2, $3, $3 - $2, $4, $5)
      `, [product_id, unitsToRemove, current, reason || 'Dead stock asset liquidation write-down', req.user.id]);

      await client.query('COMMIT');
      return res.json({
        success: true,
        message: `Liquidated ${unitsToRemove} units and updated inventory ledger.`,
        data: { units_liquidated: unitsToRemove, remaining_stock: current - unitsToRemove }
      });
    }

    await client.query('ROLLBACK');
    res.status(400).json({ success: false, error: { code: 'INVALID_ACTION', message: 'Unknown action type.' } });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error applying dead stock action:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  } finally {
    client.release();
  }
});

module.exports = router;
