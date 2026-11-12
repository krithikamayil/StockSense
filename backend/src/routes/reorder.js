const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

/**
 * GET /api/reorder/recommendations
 */
router.get('/recommendations', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        p.id as product_id,
        p.sku,
        p.name as product_name,
        p.cost_price,
        p.price,
        c.name as category_name,
        s.id as supplier_id,
        s.name as supplier_name,
        s.lead_time_days,
        s.rating as supplier_rating,
        i.current_stock,
        i.safety_stock,
        i.reorder_point,
        i.eoq,
        GREATEST(i.eoq, (i.reorder_point - i.current_stock)) as recommended_quantity,
        (GREATEST(i.eoq, (i.reorder_point - i.current_stock)) * p.cost_price) as estimated_cost,
        CASE 
          WHEN i.current_stock = 0 THEN 'CRITICAL_STOCKOUT'
          WHEN i.current_stock < i.safety_stock THEN 'HIGH_SAFETY_BREACH'
          ELSE 'MEDIUM_REORDER_DUE'
        END as urgency
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.primary_supplier_id = s.id
      WHERE p.is_active = TRUE 
        AND i.current_stock <= i.reorder_point
      ORDER BY 
        CASE 
          WHEN i.current_stock = 0 THEN 1
          WHEN i.current_stock < i.safety_stock THEN 2
          ELSE 3
        END,
        (i.reorder_point - i.current_stock) DESC
    `;

    const result = await db.query(query);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching reorder recommendations:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to retrieve reorder list.' } });
  }
});

/**
 * POST /api/reorder/generate-po
 * Automatically creates a Purchase Order from recommended items
 */
router.post('/generate-po', authenticateToken, requireRoles('Admin', 'Manager'), async (req, res) => {
  const client = await db.getClient();
  try {
    const { supplier_id, items, notes } = req.body;
    // items: [{ product_id, quantity, unit_cost }]

    if (!supplier_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Supplier ID and at least one item required.' }
      });
    }

    await client.query('BEGIN');

    // Supplier lookup for lead time
    const supRes = await client.query('SELECT * FROM suppliers WHERE id = $1', [supplier_id]);
    if (supRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Supplier not found.' } });
    }
    const supplier = supRes.rows[0];

    const poNumber = `PO-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    const totalAmount = items.reduce((acc, it) => acc + (Number(it.quantity) * Number(it.unit_cost)), 0);

    const poQuery = `
      INSERT INTO purchase_orders (po_number, supplier_id, status, total_amount, expected_delivery_date, created_by, notes)
      VALUES ($1, $2, 'DRAFT', $3, CURRENT_DATE + ($4 || ' days')::INTERVAL, $5, $6)
      RETURNING *
    `;
    const poRes = await client.query(poQuery, [
      poNumber,
      supplier_id,
      totalAmount,
      supplier.lead_time_days || 7,
      req.user.id,
      notes || 'Generated via StockSense Reorder Recommendations'
    ]);
    const po = poRes.rows[0];

    // Insert items
    for (const item of items) {
      const lineCost = Number(item.quantity) * Number(item.unit_cost);
      await client.query(`
        INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, unit_cost, total_cost)
        VALUES ($1, $2, $3, $4, $5)
      `, [po.id, item.product_id, item.quantity, item.unit_cost, lineCost]);
    }

    // Insert notification
    await client.query(`
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES ($1, 'PO_APPROVAL', 'New Purchase Order Created', $2, $3)
    `, [req.user.id, `PO ${poNumber} generated for ${supplier.name} ($${totalAmount.toFixed(2)})`, `/reordering`]);

    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      message: 'Purchase order generated successfully',
      data: { po, items_count: items.length }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating PO from recommendation:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  } finally {
    client.release();
  }
});

module.exports = router;
