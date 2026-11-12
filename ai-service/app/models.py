from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class ForecastRequest(BaseModel):
    product_id: str
    weekly_sales: List[float] = Field(..., description="Chronological weekly sales counts")
    lead_time_days: int = Field(default=7, ge=1)
    unit_cost: float = Field(default=50.0, ge=0.0)
    order_cost: float = Field(default=50.0, ge=0.0)
    holding_cost_rate: float = Field(default=0.20, ge=0.0)

class ForecastWeekPoint(BaseModel):
    week_number: int
    predicted_units: int
    lower_bound: int
    upper_bound: int

class InventoryMetrics(BaseModel):
    avg_daily_demand: float
    daily_std_dev: float
    lead_time_days: int
    safety_stock: int
    reorder_point: int
    eoq: int
    trend_factor: float
    baseline_sma: float
    mae: Optional[float] = None
    rmse: Optional[float] = None

class ForecastResponse(BaseModel):
    product_id: str
    metrics: InventoryMetrics
    forecast: List[ForecastWeekPoint]
    model_used: str
    status: str = "SUCCESS"
    notes: Optional[str] = None

class DeadStockRequest(BaseModel):
    product_id: str
    weekly_sales: List[float]

class DeadStockResponse(BaseModel):
    product_id: str
    status: str  # LIQUIDATE, DISCOUNT, HEALTHY
    reason: str
    action: str
    trailing_zero_weeks: int
    sales_drop_pct: float

class AssistantQueryRequest(BaseModel):
    query: str
    context: Optional[Dict[str, Any]] = None

class ActionItem(BaseModel):
    label: str
    route: Optional[str] = None
    action: Optional[str] = None

class AssistantQueryResponse(BaseModel):
    reply: str
    suggested_actions: List[ActionItem] = []
    confidence: float = 0.95
