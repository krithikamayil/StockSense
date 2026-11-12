const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireRoles } = require('../middleware/auth');
const aiService = require('../services/aiService');

/**
 * GET /api/products
 * Query: page, limit, search, category_id, stock_status
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search.trim().toLowerCase()}%` : null;
    const categoryId = req.query.category_id ? parseInt(req.query.category_id, 10) : null;
    const stockStatus = req.query.stock_status || 'ALL';

    const conditions = ['p.is_active = TRUE'];
    const params = [];

    if (search) {
      params.push(search);
      conditions.push(`(LOWER(p.name) LIKE $${params.length} OR LOWER(p.sku) LIKE $${params.length} OR LOWER(p.id) LIKE $${params.length})`);
    }

    if (categoryId) {
      params.push(categoryId);
      conditions.push(`p.category_id = $${params.length}`);
    }

    if (stockStatus === 'OUT_OF_STOCK') {
      conditions.push('COALESCE(i.current_stock, 0) = 0');
    } else if (stockStatus === 'LOW_STOCK') {
      conditions.push('COALESCE(i.current_stock, 0) > 0 AND COALESCE(i.current_stock, 0) <= COALESCE(i.reorder_point, 0)');
    } else if (stockStatus === 'HEALTHY') {
      conditions.push('COALESCE(i.current_stock, 0) > COALESCE(i.reorder_point, 0)');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM products p
      LEFT JOIN inventory i ON p.id = i.product_id
      ${whereClause}
    `;
    const countRes = await db.query(countQuery, params);
    const total = parseInt(countRes.rows[0].total, 10);

    const dataQuery = `
      SELECT 
        p.id,
        p.sku,
        p.name,
        p.price,
        p.cost_price,
        p.weight_g,
        c.id as category_id,
        c.name as category_name,
        s.id as supplier_id,
        s.name as supplier_name,
        s.lead_time_days,
        COALESCE(i.current_stock, 0) as current_stock,
        COALESCE(i.reserved_stock, 0) as reserved_stock,
        (COALESCE(i.current_stock, 0) - COALESCE(i.reserved_stock, 0)) as available_stock,
        COALESCE(i.safety_stock, 0) as safety_stock,
        COALESCE(i.reorder_point, 0) as reorder_point,
        COALESCE(i.eoq, 0) as eoq,
        CASE 
          WHEN COALESCE(i.current_stock, 0) = 0 THEN 'OUT_OF_STOCK'
          WHEN COALESCE(i.current_stock, 0) <= COALESCE(i.reorder_point, 0) THEN 'LOW_STOCK'
          ELSE 'HEALTHY'
        END as stock_status
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.primary_supplier_id = s.id
      LEFT JOIN inventory i ON p.id = i.product_id
      ${whereClause}
      ORDER BY 
        CASE 
          WHEN COALESCE(i.current_stock, 0) = 0 THEN 1
          WHEN COALESCE(i.current_stock, 0) <= COALESCE(i.reorder_point, 0) THEN 2
          ELSE 3
        END,
        p.name ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    const result = await db.query(dataQuery, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to retrieve products.' }
    });
  }
});

/**
 * GET /api/products/categories/list
 */
router.get('/categories/list', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT c.id, c.name, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.is_active = TRUE
      GROUP BY c.id, c.name
      ORDER BY product_count DESC, c.name ASC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to retrieve categories.' } });
  }
});

/**
 * GET /api/products/:id
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const productQuery = `
      SELECT 
        p.*,
        c.name as category_name,
        s.name as supplier_name,
        s.email as supplier_email,
        s.lead_time_days,
        s.rating as supplier_rating,
        COALESCE(i.current_stock, 0) as current_stock,
        COALESCE(i.reserved_stock, 0) as reserved_stock,
        COALESCE(i.safety_stock, 0) as safety_stock,
        COALESCE(i.reorder_point, 0) as reorder_point,
        COALESCE(i.eoq, 0) as eoq,
        COALESCE(i.order_cost, 50.0) as order_cost,
        COALESCE(i.holding_cost_rate, 0.20) as holding_cost_rate
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.primary_supplier_id = s.id
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE p.id = $1
    `;
    const prodRes = await db.query(productQuery, [id]);
    if (prodRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product not found.' }
      });
    }

    const product = prodRes.rows[0];

    // Fetch weekly sales aggregation for demand chart
    const salesQuery = `
      SELECT 
        DATE_TRUNC('week', order_date)::DATE as week_start,
        SUM(quantity) as units_sold,
        SUM(total_price) as revenue
      FROM sales
      WHERE product_id = $1 AND order_status = 'delivered'
      GROUP BY DATE_TRUNC('week', order_date)
      ORDER BY week_start ASC
    `;
    const salesRes = await db.query(salesQuery, [id]);

    // Fetch recent stock movements
    const movementsQuery = `
      SELECT sm.*, u.name as user_name
      FROM stock_movements sm
      LEFT JOIN users u ON sm.user_id = u.id
      WHERE sm.product_id = $1
      ORDER BY sm.created_at DESC
      LIMIT 10
    `;
    const movementsRes = await db.query(movementsQuery, [id]);

    // Fetch latest forecast if exists
    const forecastRes = await db.query(`
      SELECT * FROM forecasts 
      WHERE product_id = $1 
      ORDER BY week_start_date ASC
      LIMIT 8
    `, [id]);

    res.json({
      success: true,
      data: {
        product,
        sales_history: salesRes.rows,
        stock_movements: movementsRes.rows,
        forecasts: forecastRes.rows
      }
    });
  } catch (error) {
    console.error('Error fetching product details:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to retrieve product details.' }
    });
  }
});

/**
 * POST /api/products
 */
router.post('/', authenticateToken, requireRoles('Admin', 'Manager'), async (req, res) => {
  const client = await db.getClient();
  try {
    const {
      name,
      sku,
      category_id,
      primary_supplier_id,
      description,
      price,
      cost_price,
      weight_g,
      initial_stock = 0
    } = req.body;

    if (!name || !sku || price === undefined) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Name, SKU, and Price are required.' }
      });
    }

    await client.query('BEGIN');
    const id = 'prod_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

    const insertProd = `
      INSERT INTO products (id, sku, name, category_id, primary_supplier_id, description, price, cost_price, weight_g)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const prodRes = await client.query(insertProd, [
      id,
      sku.toUpperCase().trim(),
      name.trim(),
      category_id || null,
      primary_supplier_id || null,
      description || null,
      Number(price),
      Number(cost_price || price * 0.55),
      Number(weight_g || 100)
    ]);

    // Initialize inventory record
    await client.query(`
      INSERT INTO inventory (product_id, current_stock, safety_stock, reorder_point, eoq)
      VALUES ($1, $2, $3, $4, $5)
    `, [id, initial_stock, 10, 25, 50]);

    if (initial_stock > 0) {
      await client.query(`
        INSERT INTO stock_movements (product_id, movement_type, quantity_change, previous_stock, new_stock, reason, user_id)
        VALUES ($1, 'INITIAL', $2, 0, $2, 'Initial inventory setup', $3)
      `, [id, initial_stock, req.user.id]);
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: prodRes.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating product:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/products/:id
 */
router.put('/:id', authenticateToken, requireRoles('Admin', 'Manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category_id, primary_supplier_id, description, price, cost_price, is_active } = req.body;

    const query = `
      UPDATE products 
      SET 
        name = COALESCE($1, name),
        category_id = COALESCE($2, category_id),
        primary_supplier_id = COALESCE($3, primary_supplier_id),
        description = COALESCE($4, description),
        price = COALESCE($5, price),
        cost_price = COALESCE($6, cost_price),
        is_active = COALESCE($7, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `;
    const result = await db.query(query, [name, category_id, primary_supplier_id, description, price, cost_price, is_active, id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found.' } });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to update product.' } });
  }
});

module.exports = router;
