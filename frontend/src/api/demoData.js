/**
 * StockSense Standalone Demo Engine for GitHub Pages
 * Provides rich, realistic Olist-backed inventory data when hosted statically without backend server.
 */

export const demoSummary = {
  valuation: 345300.62,
  totalProducts: 300,
  totalUnits: 7388,
  lowStockCount: 64,
  outOfStockCount: 26,
  healthyCount: 210,
  pendingPOCount: 2,
  pendingPOValue: 4900.00
};

export const demoRevenueSeries = [
  { month: '2017-09', revenue: 124800.50, orders: 1120 },
  { month: '2017-10', revenue: 148900.20, orders: 1340 },
  { month: '2017-11', revenue: 198400.80, orders: 1890 },
  { month: '2017-12', revenue: 182300.40, orders: 1710 },
  { month: '2018-01', revenue: 165400.10, orders: 1550 },
  { month: '2018-02', revenue: 172900.60, orders: 1630 },
  { month: '2018-03', revenue: 194800.00, orders: 1810 },
  { month: '2018-04', revenue: 210500.90, orders: 1980 },
  { month: '2018-05', revenue: 228900.70, orders: 2120 },
  { month: '2018-06', revenue: 219400.30, orders: 2040 },
  { month: '2018-07', revenue: 236800.00, orders: 2190 },
  { month: '2018-08', revenue: 251122.53, orders: 2354 }
];

export const demoCategoryBreakdown = [
  { category: 'Health & Beauty', value: 89400.00, percentage: 25.9 },
  { category: 'Watches & Gifts', value: 68200.00, percentage: 19.8 },
  { category: 'Bed, Bath & Table', value: 55100.00, percentage: 16.0 },
  { category: 'Sports & Leisure', value: 48900.00, percentage: 14.2 },
  { category: 'Computers & Accessories', value: 42100.00, percentage: 12.2 },
  { category: 'Furniture & Decor', value: 41600.62, percentage: 11.9 }
];

export const demoTopReorderItems = [
  { id: 'prod_952670bc', sku: 'SKU-BEAUTY-001', name: 'Facial Revitalizing Serum 50ml', current_stock: 2, reorder_point: 14, eoq: 45, status: 'LOW_STOCK', supplier_name: 'Replenish Logistics Global' },
  { id: 'prod_a62e25e8', sku: 'SKU-WATCH-002', name: 'Chronograph Stainless Steel Watch', current_stock: 0, reorder_point: 8, eoq: 20, status: 'OUT_OF_STOCK', supplier_name: 'Apex Precision Supply' },
  { id: 'prod_53b36df6', sku: 'SKU-HOME-003', name: 'Egyptian Cotton Luxury Sheet Set', current_stock: 4, reorder_point: 18, eoq: 50, status: 'LOW_STOCK', supplier_name: 'Metro FastFreight Vendors' },
  { id: 'prod_d285360f', sku: 'SKU-SPORT-004', name: 'Pro Grip Aerobic Dumbbell Set', current_stock: 1, reorder_point: 10, eoq: 30, status: 'LOW_STOCK', supplier_name: 'Vanguard Industrial Direct' },
  { id: 'prod_ec2d43cc', sku: 'SKU-TECH-005', name: 'Wireless Ergonomic Mechanical Keyboard', current_stock: 0, reorder_point: 12, eoq: 35, status: 'OUT_OF_STOCK', supplier_name: 'Zenith Component Express' }
];

export const demoProducts = [
  { id: 'prod_952670bc', sku: 'SKU-BEAUTY-001', name: 'Facial Revitalizing Serum 50ml', category_name: 'Health & Beauty', price: 49.90, cost_price: 22.00, current_stock: 2, safety_stock: 6, reorder_point: 14, eoq: 45, status: 'LOW_STOCK', supplier_name: 'Replenish Logistics Global' },
  { id: 'prod_a62e25e8', sku: 'SKU-WATCH-002', name: 'Chronograph Stainless Steel Watch', category_name: 'Watches & Gifts', price: 189.00, cost_price: 85.00, current_stock: 0, safety_stock: 4, reorder_point: 8, eoq: 20, status: 'OUT_OF_STOCK', supplier_name: 'Apex Precision Supply' },
  { id: 'prod_53b36df6', sku: 'SKU-HOME-003', name: 'Egyptian Cotton Luxury Sheet Set', category_name: 'Bed, Bath & Table', price: 79.50, cost_price: 34.00, current_stock: 4, safety_stock: 7, reorder_point: 18, eoq: 50, status: 'LOW_STOCK', supplier_name: 'Metro FastFreight Vendors' },
  { id: 'prod_d285360f', sku: 'SKU-SPORT-004', name: 'Pro Grip Aerobic Dumbbell Set', category_name: 'Sports & Leisure', price: 55.00, cost_price: 24.00, current_stock: 1, safety_stock: 5, reorder_point: 10, eoq: 30, status: 'LOW_STOCK', supplier_name: 'Vanguard Industrial Direct' },
  { id: 'prod_ec2d43cc', sku: 'SKU-TECH-005', name: 'Wireless Ergonomic Mechanical Keyboard', category_name: 'Computers & Accessories', price: 119.00, cost_price: 52.00, current_stock: 0, safety_stock: 5, reorder_point: 12, eoq: 35, status: 'OUT_OF_STOCK', supplier_name: 'Zenith Component Express' },
  { id: 'prod_b001a111', sku: 'SKU-BEAUTY-006', name: 'Hydrating Botanical Cleanser 200ml', category_name: 'Health & Beauty', price: 32.00, cost_price: 14.00, current_stock: 28, safety_stock: 5, reorder_point: 12, eoq: 40, status: 'HEALTHY', supplier_name: 'Replenish Logistics Global' },
  { id: 'prod_c002b222', sku: 'SKU-HOME-007', name: 'Bamboo Memory Foam Pillow', category_name: 'Bed, Bath & Table', price: 45.00, cost_price: 19.00, current_stock: 35, safety_stock: 6, reorder_point: 15, eoq: 45, status: 'HEALTHY', supplier_name: 'Metro FastFreight Vendors' },
  { id: 'prod_d003c333', sku: 'SKU-TECH-008', name: 'Ultra-Fast USB-C 100W GaN Charger', category_name: 'Computers & Accessories', price: 39.99, cost_price: 16.50, current_stock: 42, safety_stock: 8, reorder_point: 20, eoq: 60, status: 'HEALTHY', supplier_name: 'Zenith Component Express' },
  { id: 'prod_e004d444', sku: 'SKU-DEAD-009', name: 'Vintage 2016 FM Docking Station', category_name: 'Computers & Accessories', price: 89.00, cost_price: 45.00, current_stock: 18, safety_stock: 2, reorder_point: 5, eoq: 10, status: 'LIQUIDATE', supplier_name: 'Zenith Component Express' },
  { id: 'prod_f005e555', sku: 'SKU-DEAD-010', name: 'Discontinued Ceramic Teapot Grey', category_name: 'Bed, Bath & Table', price: 42.00, cost_price: 21.00, current_stock: 25, safety_stock: 3, reorder_point: 6, eoq: 15, status: 'DISCOUNT', supplier_name: 'Metro FastFreight Vendors' }
];

export const demoSuppliers = [
  { id: 1, name: 'Replenish Logistics Global', contact_name: 'Lucas Silva', email: 'lucas@replenish.com', phone: '+55 11 98821-4321', lead_time_days: 7, rating: 4.9, active_pos: 1 },
  { id: 2, name: 'Apex Precision Supply', contact_name: 'Mariana Costa', email: 'mariana@apexsupply.com', phone: '+55 21 97712-8899', lead_time_days: 10, rating: 4.8, active_pos: 1 },
  { id: 3, name: 'Metro FastFreight Vendors', contact_name: 'Rodrigo Santos', email: 'rodrigo@metrofast.com', phone: '+55 31 99123-5566', lead_time_days: 5, rating: 4.7, active_pos: 0 },
  { id: 4, name: 'Vanguard Industrial Direct', contact_name: 'Camila Lima', email: 'camila@vanguard.com', phone: '+55 41 98456-1122', lead_time_days: 8, rating: 4.9, active_pos: 0 },
  { id: 5, name: 'Zenith Component Express', contact_name: 'Gabriel Alves', email: 'gabriel@zenithexpress.com', phone: '+55 51 99876-3344', lead_time_days: 6, rating: 4.6, active_pos: 0 }
];

export const demoPurchaseOrders = [
  { id: 101, po_number: 'PO-2026-001', supplier_name: 'Replenish Logistics Global', status: 'ORDERED', total_amount: 2450.00, created_at: '2026-11-10T10:00:00Z', items: [{ name: 'Facial Revitalizing Serum 50ml', quantity: 45, unit_cost: 22.00 }] },
  { id: 102, po_number: 'PO-2026-002', supplier_name: 'Apex Precision Supply', status: 'PENDING_APPROVAL', total_amount: 2450.00, created_at: '2026-11-11T14:30:00Z', items: [{ name: 'Chronograph Stainless Steel Watch', quantity: 20, unit_cost: 85.00 }] },
  { id: 103, po_number: 'PO-2026-003', supplier_name: 'Metro FastFreight Vendors', status: 'RECEIVED', total_amount: 1700.00, created_at: '2026-11-05T09:15:00Z', items: [{ name: 'Egyptian Cotton Luxury Sheet Set', quantity: 50, unit_cost: 34.00 }] }
];
