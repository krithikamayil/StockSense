import unittest
from app.inventory_math import (
    calculate_daily_demand_metrics,
    calculate_safety_stock,
    calculate_reorder_point,
    calculate_eoq,
    calculate_trend_factor,
)
from app.forecaster import generate_demand_forecast
from app.dead_stock_analyzer import analyze_dead_stock
from app.assistant_engine import process_assistant_query

class TestAIServiceBusinessLogic(unittest.TestCase):
    def test_daily_demand_calculation(self):
        # 4 weeks of sales: 14, 21, 28, 35 -> Mean weekly = 24.5 -> avg daily = 3.5
        weekly = [14.0, 21.0, 28.0, 35.0]
        avg_daily, daily_std = calculate_daily_demand_metrics(weekly)
        self.assertEqual(avg_daily, 3.5)
        self.assertGreater(daily_std, 0.0)

    def test_safety_stock_and_rop(self):
        # Z = 1.65, daily_std = 1.0, lead_time = 9 days -> SS = ceil(1.65 * 1.0 * 3) = 5
        ss = calculate_safety_stock(1.0, 9)
        self.assertEqual(ss, 5)
        
        # Avg daily = 4.0, lead_time = 9, SS = 5 -> ROP = ceil(4.0 * 9 + 5) = 41
        rop = calculate_reorder_point(4.0, 9, ss)
        self.assertEqual(rop, 41)

    def test_eoq_calculation(self):
        # Annual demand = 10 * 365 = 3650, Order cost = 50, Holding cost = 50 * 0.20 = 10
        # EOQ = sqrt(2 * 3650 * 50 / 10) = sqrt(36500) approx 191
        eoq = calculate_eoq(avg_daily=10.0, unit_cost=50.0, order_cost=50.0, holding_rate=0.20)
        self.assertAlmostEqual(eoq, 192, delta=2)

    def test_trend_factor_clamping(self):
        # Huge growth: prev 4 weeks = [1, 1, 1, 1] sum=4, last 4 weeks = [20, 20, 20, 20] sum=80
        # Ratio = 20, clamped to 1.6
        weekly = [1.0]*4 + [20.0]*4
        trend, sma = calculate_trend_factor(weekly)
        self.assertEqual(trend, 1.6)
        self.assertEqual(sma, 20.0)

        # Huge decline: prev = [50, 50, 50, 50], last = [1, 1, 1, 1] -> Ratio = 0.02, clamped to 0.5
        weekly_down = [50.0]*4 + [1.0]*4
        trend_down, _ = calculate_trend_factor(weekly_down)
        self.assertEqual(trend_down, 0.5)

    def test_dead_stock_detection(self):
        # 5 trailing zero weeks -> Liquidate
        weekly_stagnant = [10.0, 15.0, 0.0, 0.0, 0.0, 0.0, 0.0]
        res = analyze_dead_stock("prod_test_01", weekly_stagnant)
        self.assertEqual(res.status, "LIQUIDATE")

        # 2 zero weeks -> Discount
        weekly_slow = [10.0, 15.0, 8.0, 12.0, 0.0, 0.0]
        res2 = analyze_dead_stock("prod_test_02", weekly_slow)
        self.assertEqual(res2.status, "DISCOUNT")

        # Sales drop > 55%
        weekly_drop = [20.0, 25.0, 20.0, 25.0, 2.0, 2.0, 2.0, 2.0]
        res3 = analyze_dead_stock("prod_test_03", weekly_drop)
        self.assertEqual(res3.status, "DISCOUNT")

    def test_forecast_ensemble(self):
        weekly = [10.0, 12.0, 11.0, 13.0, 14.0, 15.0, 16.0, 17.0]
        fc = generate_demand_forecast("prod_100", weekly, lead_time_days=7, unit_cost=40.0)
        self.assertEqual(len(fc.forecast), 4)
        self.assertGreater(fc.forecast[0].predicted_units, 0)
        self.assertIsNotNone(fc.metrics.mae)
        self.assertIsNotNone(fc.metrics.rmse)

    def test_assistant_query_context(self):
        res = process_assistant_query(
            "Which products need urgent reorder?",
            {"lowStockCount": 5, "totalProducts": 100, "sampleLowStock": [{"name": "Camera X", "current_stock": 2, "reorder_point": 10}]}
        )
        self.assertIn("5 items", res.reply)
        self.assertGreaterEqual(len(res.suggested_actions), 1)

if __name__ == '__main__':
    unittest.main()
