const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireRoles } = require('../middleware/auth');

/**
 * GET /api/suppliers
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        s.*,
        COUNT(DISTINCT p.id) as product_count,
        COUNT(DISTINCT po.id) as total_purchase_orders,
        COUNT(DISTINCT CASE WHEN po.status IN ('PENDING_APPROVAL', 'APPROVED', 'ORDERED') THEN po.id END) as active_purchase_orders
      FROM suppliers s
      LEFT JOIN products p ON s.id = p.primary_supplier_id AND p.is_active = TRUE
      LEFT JOIN purchase_orders po ON s.id = po.supplier_id
      GROUP BY s.id
      ORDER BY s.rating DESC, s.name ASC
    `;
    const result = await db.query(query);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to retrieve suppliers.' } });
  }
});

/**
 * GET /api/suppliers/:id
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const supRes = await db.query('SELECT * FROM suppliers WHERE id = $1', [id]);
    if (supRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Supplier not found.' } });
    }

    const productsRes = await db.query(`
      SELECT p.id, p.sku, p.name, p.price, p.cost_price, i.current_stock, i.reorder_point
      FROM products p
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE p.primary_supplier_id = $1 AND p.is_active = TRUE
    `, [id]);

    const posRes = await db.query(`
      SELECT * FROM purchase_orders 
      WHERE supplier_id = $1 
      ORDER BY created_at DESC 
      LIMIT 10
    `, [id]);

    res.json({
      success: true,
      data: {
        supplier: supRes.rows[0],
        products: productsRes.rows,
        recent_pos: posRes.rows
      }
    });
  } catch (error) {
    console.error('Error fetching supplier details:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to retrieve supplier.' } });
  }
});

/**
 * POST /api/suppliers
 */
router.post('/', authenticateToken, requireRoles('Admin', 'Manager'), async (req, res) => {
  try {
    const { name, contact_name, email, phone, address, lead_time_days = 7, rating = 4.5 } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Supplier name is required.' } });
    }

    const query = `
      INSERT INTO suppliers (name, contact_name, email, phone, address, lead_time_days, rating)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const result = await db.query(query, [
      name.trim(),
      contact_name || null,
      email || null,
      phone || null,
      address || null,
      parseInt(lead_time_days, 10),
      parseFloat(rating)
    ]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

/**
 * PUT /api/suppliers/:id
 */
router.put('/:id', authenticateToken, requireRoles('Admin', 'Manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact_name, email, phone, address, lead_time_days, rating, is_active } = req.body;

    const query = `
      UPDATE suppliers 
      SET 
        name = COALESCE($1, name),
        contact_name = COALESCE($2, contact_name),
        email = COALESCE($3, email),
        phone = COALESCE($4, phone),
        address = COALESCE($5, address),
        lead_time_days = COALESCE($6, lead_time_days),
        rating = COALESCE($7, rating),
        is_active = COALESCE($8, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `;
    const result = await db.query(query, [name, contact_name, email, phone, address, lead_time_days, rating, is_active, id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Supplier not found.' } });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

module.exports = router;
