/**
 * StockSense Olist Dataset Importer & Seeder
 * Implements batch processing, delivered orders filter,
 * synthetic supplier linking, and Section 8 inventory business logic.
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const bcrypt = require('bcryptjs');
const db = require('../src/config/db');
const businessLogic = require('../src/services/businessLogic');

const DATASET_DIR = path.resolve(__dirname, '../../dataset');

// Helper to stream and parse CSV
function parseCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`File not found: ${filePath}`));
    }
    fs.createReadStream(filePath, { encoding: 'utf-8' })
      .pipe(csv())
      .on('data', (data) => rows.push(data))
      .on('end', () => resolve(rows))
      .on('error', (err) => reject(err));
  });
}

// English Category Translation Dictionary
const CATEGORY_TRANSLATIONS = {
  'beleza_saude': 'Health & Beauty',
  'informatica_acessorios': 'Computers & Accessories',
  'automotivo': 'Automotive',
  'cama_mesa_banho': 'Bed, Bath & Table',
  'moveis_decoracao': 'Furniture & Decor',
  'esporte_lazer': 'Sports & Leisure',
  'perfumaria': 'Perfumery & Fragrances',
  'utilidades_domesticas': 'Housewares',
  'telefonia': 'Telephony & Mobile',
  'relogios_presentes': 'Watches & Gifts',
  'brinquedos': 'Toys & Games',
  'ferramentas_jardim': 'Garden & Tools',
  'eletronicos': 'Consumer Electronics',
  'papelaria': 'Stationery & Office',
  'bebes': 'Baby & Maternity',
  'fashion_bolsas_e_acessorios': 'Fashion Bags & Accessories',
  'pet_shop': 'Pet Supplies',
  'cool_stuff': 'Lifestyle & Gadgets',
  'alimentos': 'Food & Groceries',
  'instrumentos_musicais': 'Musical Instruments'
};

async function runImporter() {
  const client = await db.getClient();
  console.log('====================================================');
  console.log('   StockSense Olist Dataset Importer Starting       ');
  console.log('====================================================');

  try {
    // 1. Seed Demo Accounts
    console.log('-> Seeding Demo User Accounts...');
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const demoUsers = [
      { name: 'Admin Administrator', email: 'admin@stocksense.io', role: 'Admin' },
      { name: 'Elena Vance (Manager)', email: 'manager@stocksense.io', role: 'Manager' },
      { name: 'Marcus Brody (Staff)', email: 'staff@stocksense.io', role: 'Staff' },
      { name: 'Supplier Rep (Apex)', email: 'supplier@stocksense.io', role: 'Supplier' },
    ];

    for (const u of demoUsers) {
      await client.query(`
        INSERT INTO users (name, email, password_hash, role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (email) DO UPDATE SET 
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role
      `, [u.name, u.email, passwordHash, u.role]);
    }
    console.log('   [OK] Demo accounts created/updated.');

    // 2. Seed Verified Replenishment Suppliers (Explicitly Synthetic)
    console.log('-> Seeding Verified Replenishment Suppliers...');
    const demoSuppliers = [
      { name: 'Apex Global Logistics (Synthetic Supplier)', contact_name: 'Arthur Pendelton', email: 'orders@apexsupply.io', phone: '+1-555-0101', lead_time_days: 7, rating: 4.8 },
      { name: 'PrimeSource Wholesale (Synthetic Supplier)', contact_name: 'Beatrice Chen', email: 'supply@primesource.com', phone: '+1-555-0102', lead_time_days: 10, rating: 4.6 },
      { name: 'Nexus Manufacturing Co. (Synthetic Supplier)', contact_name: 'Carl Rodriguez', email: 'sales@nexusmfg.io', phone: '+1-555-0103', lead_time_days: 14, rating: 4.5 },
      { name: 'Zenith Industrial Supplies (Synthetic Supplier)', contact_name: 'Diane Foster', email: 'fulfillment@zenithparts.com', phone: '+1-555-0104', lead_time_days: 5, rating: 4.9 },
      { name: 'Vanguard Commerce Partners (Synthetic Supplier)', contact_name: 'Edward Kim', email: 'partners@vanguardlog.io', phone: '+1-555-0105', lead_time_days: 12, rating: 4.4 },
    ];

    const supplierIdMap = [];
    for (const s of demoSuppliers) {
      const res = await client.query(`
        INSERT INTO suppliers (name, contact_name, email, phone, lead_time_days, rating)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `, [s.name, s.contact_name, s.email, s.phone, s.lead_time_days, s.rating]);
      const supId = res.rows.length > 0 ? res.rows[0].id : 1;
      supplierIdMap.push(supId);
    }
    // If returning empty because of conflict, fetch existing IDs
    if (supplierIdMap.length === 0 || supplierIdMap[0] === undefined) {
      const allSup = await client.query('SELECT id FROM suppliers ORDER BY id ASC');
      supplierIdMap.push(...allSup.rows.map(r => r.id));
    }
    console.log(`   [OK] ${demoSuppliers.length} verified replenishment suppliers ready.`);

    // 3. Load Olist Products and Categories
    console.log('-> Loading Olist products CSV...');
    const productsCsvPath = path.join(DATASET_DIR, 'olist_products_dataset.csv');
    const rawProducts = await parseCsvFile(productsCsvPath);
    console.log(`   Parsed ${rawProducts.length} raw products from CSV.`);

    // Extract categories
    const categoryNameMap = new Map();
    for (const p of rawProducts) {
      const cat = p.product_category_name;
      if (cat && !categoryNameMap.has(cat)) {
        const engName = CATEGORY_TRANSLATIONS[cat] || p.product_category_name_english || cat.replace(/_/g, ' ');
        categoryNameMap.set(cat, engName);
      }
    }

    console.log(`-> Inserting ${categoryNameMap.size} product categories...`);
    const categoryIdLookup = new Map();
    for (const [ptName, engName] of categoryNameMap.entries()) {
      const catRes = await client.query(`
        INSERT INTO categories (name, description)
        VALUES ($1, $2)
        ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
        RETURNING id
      `, [engName, `Original Portuguese key: ${ptName}`]);
      categoryIdLookup.set(ptName, catRes.rows[0].id);
    }

    // 4. Load Olist Order Items and identify top products by volume
    console.log('-> Loading Olist order items CSV...');
    const itemsCsvPath = path.join(DATASET_DIR, 'olist_order_items_dataset.csv');
    const rawItems = await parseCsvFile(itemsCsvPath);
    console.log(`   Parsed ${rawItems.length} order items.`);

    // Tally item counts and prices per product
    const productStats = new Map();
    for (const it of rawItems) {
      const pid = it.product_id;
      const price = parseFloat(it.price) || 50.0;
      if (!productStats.has(pid)) {
        productStats.set(pid, { count: 0, totalPrice: 0, orderIds: new Set() });
      }
      const st = productStats.get(pid);
      st.count += 1;
      st.totalPrice += price;
      st.orderIds.add(it.order_id);
    }

    // Select top 300 products sorted by volume
    const sortedProducts = Array.from(productStats.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 300);

    const targetProductIds = new Set(sortedProducts.map(([pid]) => pid));
    console.log(`-> Selected top ${targetProductIds.size} high-volume products for catalog.`);

    // Create a lookup of raw product rows
    const rawProdLookup = new Map();
    for (const p of rawProducts) {
      if (targetProductIds.has(p.product_id)) {
        rawProdLookup.set(p.product_id, p);
      }
    }

    // Insert Products into database
    console.log('-> Inserting products into database...');
    let prodIndex = 1;
    for (const [pid, stat] of sortedProducts) {
      const raw = rawProdLookup.get(pid) || {};
      const catPt = raw.product_category_name;
      const catId = categoryIdLookup.get(catPt) || null;
      const avgPrice = Number((stat.totalPrice / stat.count).toFixed(2));
      const costPrice = Number((avgPrice * 0.55).toFixed(2));
      const sku = `SKU-${(raw.product_category_name || 'GEN').substring(0, 4).toUpperCase()}-${String(prodIndex).padStart(4, '0')}`;
      const name = `${raw.product_category_name_english || catPt || 'General Product'} #${prodIndex} (${pid.substring(0, 8)})`;
      const supId = supplierIdMap[prodIndex % supplierIdMap.length];

      await client.query(`
        INSERT INTO products (
          id, sku, name, category_id, primary_supplier_id, description,
          price, cost_price, weight_g, length_cm, height_cm, width_cm
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET 
          sku = EXCLUDED.sku,
          price = EXCLUDED.price,
          cost_price = EXCLUDED.cost_price,
          name = EXCLUDED.name
      `, [
        pid,
        sku,
        name,
        catId,
        supId,
        `Olist historical catalog item. Category: ${catPt || 'General'}. Weight: ${raw.product_weight_g || 500}g.`,
        avgPrice,
        costPrice,
        parseFloat(raw.product_weight_g) || 500,
        parseFloat(raw.product_length_cm) || 20,
        parseFloat(raw.product_height_cm) || 15,
        parseFloat(raw.product_width_cm) || 15
      ]);

      prodIndex++;
    }
    console.log(`   [OK] ${sortedProducts.length} products inserted into database.`);

    // 5. Load Olist Orders (Delivered only)
    console.log('-> Loading Olist delivered orders...');
    const ordersCsvPath = path.join(DATASET_DIR, 'olist_orders_dataset.csv');
    const rawOrders = await parseCsvFile(ordersCsvPath);
    console.log(`   Parsed ${rawOrders.length} raw orders.`);

    const deliveredOrdersMap = new Map();
    for (const o of rawOrders) {
      if (o.order_status === 'delivered' && o.order_purchase_timestamp) {
        deliveredOrdersMap.set(o.order_id, o);
      }
    }
    console.log(`   Identified ${deliveredOrdersMap.size} fulfilled (delivered) historical orders.`);

    // 6. Insert Sales Records for targeted products (Delivered only)
    console.log('-> Inserting delivered sales records (batch execution)...');
    let salesCount = 0;
    const salesBatch = [];

    for (const it of rawItems) {
      if (!targetProductIds.has(it.product_id)) continue;
      const order = deliveredOrdersMap.get(it.order_id);
      if (!order) continue; // skip non-delivered orders per Section 7

      const orderDate = new Date(order.order_purchase_timestamp);
      const unitPrice = parseFloat(it.price) || 50.0;

      salesBatch.push({
        order_id: it.order_id,
        order_item_id: parseInt(it.order_item_id, 10) || 1,
        product_id: it.product_id,
        quantity: 1,
        unit_price: unitPrice,
        total_price: unitPrice,
        order_date: orderDate,
        customer_id: order.customer_id
      });
    }

    // Insert sales in chunks of 500 for optimal Postgres performance
    const CHUNK_SIZE = 500;
    for (let i = 0; i < salesBatch.length; i += CHUNK_SIZE) {
      const chunk = salesBatch.slice(i, i + CHUNK_SIZE);
      const values = [];
      const placeholders = [];
      let paramIdx = 1;

      for (const s of chunk) {
        placeholders.push(`($${paramIdx}, $${paramIdx+1}, $${paramIdx+2}, $${paramIdx+3}, $${paramIdx+4}, $${paramIdx+5}, $${paramIdx+6}, $${paramIdx+7})`);
        values.push(s.order_id, s.order_item_id, s.product_id, s.quantity, s.unit_price, s.total_price, s.order_date, s.customer_id);
        paramIdx += 8;
      }

      await client.query(`
        INSERT INTO sales (order_id, order_item_id, product_id, quantity, unit_price, total_price, order_date, customer_id)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT DO NOTHING
      `, values);

      salesCount += chunk.length;
    }
    console.log(`   [OK] ${salesCount} historical sales records inserted.`);

    // 7. Compute Section 8 Inventory Business Metrics for every product
    console.log('-> Computing Section 8 inventory business logic (Safety Stock, ROP, EOQ, Dead Stock)...');
    let invCount = 0;

    for (let idx = 0; idx < sortedProducts.length; idx++) {
      const [pid] = sortedProducts[idx];
      const supId = supplierIdMap[(idx + 1) % supplierIdMap.length];
      const leadTime = 7; // standard supplier lead time in days

      // Fetch weekly sales for this product
      const weeklyRes = await client.query(`
        SELECT 
          DATE_TRUNC('week', order_date)::DATE as week_start,
          SUM(quantity) as units
        FROM sales
        WHERE product_id = $1 AND order_status = 'delivered'
        GROUP BY DATE_TRUNC('week', order_date)
        ORDER BY week_start ASC
      `, [pid]);

      const weeklyUnits = weeklyRes.rows.map(r => parseInt(r.units, 10));

      const avgDailyDemand = businessLogic.calculateAverageDailyDemand(weeklyUnits);
      const dailyStd = businessLogic.calculateDailyStdDev(weeklyUnits);
      const safetyStock = businessLogic.calculateSafetyStock(dailyStd, leadTime);
      const reorderPoint = businessLogic.calculateReorderPoint(avgDailyDemand, leadTime, safetyStock);

      const prodPriceRes = await client.query('SELECT cost_price FROM products WHERE id = $1', [pid]);
      const costPrice = parseFloat(prodPriceRes.rows[0]?.cost_price) || 30.0;
      const eoq = businessLogic.calculateEOQ(avgDailyDemand, costPrice);

      // Controlled synthetic distribution of current_stock:
      // ~20% low stock (< ROP) to populate Reorder recommendations
      // ~10% out of stock (current_stock = 0)
      // ~10% dead stock (stagnant)
      // ~60% healthy stock
      let currentStock;
      if (idx % 10 === 0) {
        currentStock = 0; // Out of stock
      } else if (idx % 5 === 0) {
        currentStock = Math.max(Math.floor(reorderPoint * 0.4), 1); // Below ROP (Low Stock)
      } else if (idx % 7 === 0) {
        currentStock = Math.floor(reorderPoint * 0.8); // Just below ROP
      } else {
        currentStock = Math.max(reorderPoint + Math.floor(eoq * 0.6), 25); // Healthy
      }

      await client.query(`
        INSERT INTO inventory (product_id, current_stock, reserved_stock, safety_stock, reorder_point, eoq)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (product_id) DO UPDATE SET 
          current_stock = EXCLUDED.current_stock,
          safety_stock = EXCLUDED.safety_stock,
          reorder_point = EXCLUDED.reorder_point,
          eoq = EXCLUDED.eoq,
          updated_at = CURRENT_TIMESTAMP
      `, [pid, currentStock, Math.floor(currentStock * 0.05), safetyStock, reorderPoint, eoq]);

      invCount++;
    }
    console.log(`   [OK] Computed and seeded ${invCount} inventory records.`);

    // 8. Seed Sample Purchase Orders across lifecycles
    console.log('-> Seeding realistic purchase orders across lifecycles...');
    const adminUser = await client.query("SELECT id FROM users WHERE role = 'Admin' LIMIT 1");
    const adminId = adminUser.rows[0]?.id || 1;

    const samplePos = [
      { po_number: 'PO-2026-0801', supplier_id: supplierIdMap[0], status: 'RECEIVED', received_at: '2026-11-01T10:00:00Z', notes: 'Initial replenishment batch' },
      { po_number: 'PO-2026-0802', supplier_id: supplierIdMap[1], status: 'ORDERED', ordered_at: '2026-11-08T14:30:00Z', notes: 'In-transit shipment via Express Freight' },
      { po_number: 'PO-2026-0803', supplier_id: supplierIdMap[2], status: 'PENDING_APPROVAL', notes: 'Automated EOQ replenishment waiting for Manager sign-off' },
      { po_number: 'PO-2026-0804', supplier_id: supplierIdMap[3], status: 'DRAFT', notes: 'Draft reorder batch for winter electronics line' },
    ];

    for (const poData of samplePos) {
      // Pick 2 products
      const p1 = sortedProducts[0][0];
      const p2 = sortedProducts[1][0];

      const poRes = await client.query(`
        INSERT INTO purchase_orders (po_number, supplier_id, status, total_amount, expected_delivery_date, created_by, approved_by, ordered_at, received_at, notes)
        VALUES ($1, $2, $3, 2450.00, CURRENT_DATE + INTERVAL '5 days', $4, $4, $5, $6, $7)
        ON CONFLICT (po_number) DO NOTHING
        RETURNING id
      `, [
        poData.po_number,
        poData.supplier_id,
        poData.status,
        adminId,
        poData.ordered_at || null,
        poData.received_at || null,
        poData.notes
      ]);

      if (poRes.rows.length > 0) {
        const poId = poRes.rows[0].id;
        await client.query(`
          INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, unit_cost, total_cost, received_quantity)
          VALUES 
            ($1, $2, 50, 25.00, 1250.00, $4),
            ($1, $3, 40, 30.00, 1200.00, $5)
        `, [poId, p1, p2, poData.status === 'RECEIVED' ? 50 : 0, poData.status === 'RECEIVED' ? 40 : 0]);
      }
    }
    console.log('   [OK] Sample POs seeded across all lifecycle statuses.');

    // 9. Seed Initial Notifications
    console.log('-> Seeding system alerts and notifications...');
    await client.query(`
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES 
        ($1, 'LOW_STOCK', 'Urgent Reorder Required', 'Multiple products have breached calculated safety stock thresholds.', '/reordering'),
        ($1, 'DEAD_STOCK', 'Stagnant Inventory Detected', 'Products identified with >= 5 trailing zero-sale weeks.', '/dead-stock'),
        ($1, 'PO_APPROVAL', 'PO Approval Pending', 'PO-2026-0803 requires manager sign-off.', '/reordering')
      ON CONFLICT DO NOTHING
    `, [adminId]);
    console.log('   [OK] Notifications seeded.');

    console.log('====================================================');
    console.log('   [SUCCESS] Olist Relational Import Complete!      ');
    console.log('====================================================');
  } catch (error) {
    console.error('Error during dataset import:', error);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

runImporter();
