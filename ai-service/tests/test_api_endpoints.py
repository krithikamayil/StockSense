import unittest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

class TestFastAPIEndpoints(unittest.TestCase):
    def test_health(self):
        response = client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ONLINE")
        self.assertIn("uptime_seconds", data)

    def test_forecast_endpoint(self):
        payload = {
            "product_id": "test_sku_101",
            "weekly_sales": [12.0, 14.0, 15.0, 13.0, 16.0, 18.0, 20.0, 22.0],
            "lead_time_days": 7,
            "unit_cost": 35.0,
            "order_cost": 50.0,
            "holding_cost_rate": 0.20
        }
        response = client.post("/ai/forecast/product", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["product_id"], "test_sku_101")
        self.assertEqual(len(data["forecast"]), 4)
        self.assertGreater(data["metrics"]["reorder_point"], 0)
        self.assertGreater(data["metrics"]["eoq"], 0)
        self.assertIn("mae", data["metrics"])
        self.assertIn("rmse", data["metrics"])

    def test_forecast_sparse_data(self):
        # Test honest handling of sparse historical data (< 4 weeks)
        payload = {
            "product_id": "test_sku_sparse",
            "weekly_sales": [10.0, 15.0],
            "lead_time_days": 5,
            "unit_cost": 25.0
        }
        response = client.post("/ai/forecast/product", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("MOVING_AVERAGE_BASELINE", data["model_used"])
        self.assertIsNotNone(data["notes"])
        self.assertEqual(len(data["forecast"]), 4)

    def test_dead_stock_endpoint_liquidate(self):
        payload = {
            "product_id": "test_sku_stagnant",
            "weekly_sales": [20.0, 15.0, 0.0, 0.0, 0.0, 0.0, 0.0]
        }
        response = client.post("/ai/dead-stock/analyze", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "LIQUIDATE")
        self.assertEqual(data["trailing_zero_weeks"], 5)

    def test_dead_stock_endpoint_discount(self):
        payload = {
            "product_id": "test_sku_discount",
            "weekly_sales": [20.0, 15.0, 0.0, 0.0]
        }
        response = client.post("/ai/dead-stock/analyze", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "DISCOUNT")

    def test_assistant_endpoint(self):
        payload = {
            "query": "Which items are in low stock?",
            "context": {
                "lowStockCount": 3,
                "totalProducts": 50,
                "valuation": 12500.0,
                "sampleLowStock": [{"name": "Smart Watch", "current_stock": 4, "reorder_point": 15}]
            }
        }
        response = client.post("/ai/intelligence/assistant", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("3 items", data["reply"])
        self.assertGreaterEqual(len(data["suggested_actions"]), 1)

if __name__ == '__main__':
    unittest.main()
