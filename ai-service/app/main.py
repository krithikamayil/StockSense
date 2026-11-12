import os
import sys
from pathlib import Path
import time

# Ensure project root is in sys.path so 'app' package is always resolvable
CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.models import (
    ForecastRequest,
    ForecastResponse,
    DeadStockRequest,
    DeadStockResponse,
    AssistantQueryRequest,
    AssistantQueryResponse
)
from app.forecaster import generate_demand_forecast
from app.dead_stock_analyzer import analyze_dead_stock
from app.assistant_engine import process_assistant_query

app = FastAPI(
    title="StockSense AI Forecasting & Intelligence Service",
    version="1.0.0",
    description="Dedicated microservice for demand forecasting, inventory safety metrics, and inventory intelligence."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

START_TIME = time.time()

@app.get("/health")
def health_check():
    return {
        "status": "ONLINE",
        "service": "StockSense Python AI Microservice",
        "uptime_seconds": int(time.time() - START_TIME),
        "version": "1.0.0"
    }

@app.post("/ai/forecast/product", response_model=ForecastResponse)
def forecast_product(req: ForecastRequest):
    try:
        response = generate_demand_forecast(
            product_id=req.product_id,
            weekly_sales=req.weekly_sales,
            lead_time_days=req.lead_time_days,
            unit_cost=req.unit_cost,
            order_cost=req.order_cost,
            holding_rate=req.holding_cost_rate
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecasting error: {str(e)}")

@app.post("/ai/dead-stock/analyze", response_model=DeadStockResponse)
def dead_stock(req: DeadStockRequest):
    try:
        return analyze_dead_stock(
            product_id=req.product_id,
            weekly_sales=req.weekly_sales
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dead stock analysis error: {str(e)}")

@app.post("/ai/intelligence/assistant", response_model=AssistantQueryResponse)
def assistant_query(req: AssistantQueryRequest):
    try:
        return process_assistant_query(
            query=req.query,
            context=req.context
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Assistant engine error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
