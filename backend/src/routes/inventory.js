const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

/**
 * GET /api/inventory
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status = 'ALL', search } = req.query;
    const conditions = ['p.is_active = TRUE'];
    const params = [];

    if (search) {
      params.push(`%${search.trim().toLowerCase()}%`);
      conditions.push(`(LOWER(p.name) LIKE $${params.length} OR LOWER(p.sku) LIKE $${params.length})`);
    }

    if (status === 'OUT_OF_STOCK') {
      conditions.push('COALESCE(i.current_stock, 0) = 0');
    } else if (status === 'LOW_STOCK') {
      conditions.push('COALESCE(i.current_stock, 0) > 0 AND COALESCE(i.current_stock, 0) <= COALESCE(i.reorder_point, 0)');
    } else if (status === 'HEALTHY') {
      conditions.push('COALESCE(i.current_stock, 0) > COALESCE(i.reorder_point, 0)');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        i.id as inventory_id,
        p.id as product_id,
        p.sku,
        p.name as product_name,
        c.name as category_name,
        p.price,
        p.cost_price,
        i.current_stock,
        i.reserved_stock,
        (i.current_stock - i.reserved_stock) as available_stock,
        i.safety_stock,
        i.reorder_point,
        i.eoq,
        i.last_counted_at,
        i.updated_at,
        s.name as supplier_name,
        s.lead_time_days,
        (i.current_stock * p.cost_price) as total_valuation,
        CASE 
          WHEN i.current_stock = 0 THEN 'OUT_OF_STOCK'
          WHEN i.current_stock <= i.reorder_point THEN 'LOW_STOCK'
          ELSE 'HEALTHY'
        END as health_status
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.primary_supplier_id = s.id
      ${whereClause}
      ORDER BY 
        CASE 
          WHEN i.current_stock = 0 THEN 1
          WHEN i.current_stock <= i.reorder_point THEN 2
          ELSE 3
        END,
        p.name ASC
    `;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to retrieve inventory.' } });
  }
});

/**
 * POST /api/inventory/adjust
 * Stock adjustment ledger transaction
 */
router.post('/adjust', authenticateToken, requireRoles('Admin', 'Manager', 'Staff'), async (req, res) => {
  const client = await db.getClient();
  try {
    const { product_id, quantity_change, reason, movement_type = 'ADJUSTMENT' } = req.body;

    if (!product_id || quantity_change === undefined || quantity_change === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Product ID and non-zero quantity change required.' }
      });
    }

    await client.query('BEGIN');

    // Lock the inventory row for update
    const invRes = await client.query('SELECT * FROM inventory WHERE product_id = $1 FOR UPDATE', [product_id]);
    if (invRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Inventory item not found.' } });
    }

    const currentInventory = invRes.rows[0];
    const prevStock = currentInventory.current_stock;
    const newStock = prevStock + Number(quantity_change);

    if (newStock < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: { code: 'INSUFFICIENT_STOCK', message: `Adjustment would reduce stock below zero (Current: ${prevStock}).` }
      });
    }

    // Update inventory quantity
    await client.query(`
      UPDATE inventory 
      SET current_stock = $1, last_counted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
      WHERE product_id = $2
    `, [newStock, product_id]);

    // Record stock movement in ledger
    const movRes = await client.query(`
      INSERT INTO stock_movements (product_id, movement_type, quantity_change, previous_stock, new_stock, reason, user_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [product_id, movement_type, quantity_change, prevStock, newStock, reason || 'Manual stock adjustment', req.user.id]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Stock adjusted successfully',
      data: {
        product_id,
        previous_stock: prevStock,
        new_stock: newStock,
        movement: movRes.rows[0]
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adjusting inventory:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  } finally {
    client.release();
  }
});

/**
 * GET /api/inventory/movements
 */
router.get('/movements', authenticateToken, async (req, res) => {
  try {
    const { product_id, limit = 50 } = req.query;
    const params = [];
    let whereClause = '';

    if (product_id) {
      params.push(product_id);
      whereClause = 'WHERE sm.product_id = $1';
    }

    const query = `
      SELECT 
        sm.*,
        p.name as product_name,
        p.sku,
        u.name as user_name
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      LEFT JOIN users u ON sm.user_id = u.id
      ${whereClause}
      ORDER BY sm.created_at DESC
      LIMIT $${params.length + 1}
    `;
    params.push(parseInt(limit, 10));

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching stock movements:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to retrieve movements.' } });
  }
});

module.exports = router;
