import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import ProductDetails from './pages/ProductDetails';
import Forecasting from './pages/Forecasting';
import Reordering from './pages/Reordering';
import DeadStock from './pages/DeadStock';
import Suppliers from './pages/Suppliers';
import AiAssistant from './pages/AiAssistant';

// Protected Route Component
function ProtectedLayout() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-emerald-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-content-secondary">Authenticating Session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Derive header title from route
  const path = location.pathname;
  let title = 'Dashboard';
  if (path.startsWith('/inventory')) title = 'Inventory Catalog';
  else if (path.startsWith('/products/')) title = 'Product Details';
  else if (path.startsWith('/forecasting')) title = 'Demand Forecasting';
  else if (path.startsWith('/reordering')) title = 'Reordering & Purchase Orders';
  else if (path.startsWith('/dead-stock')) title = 'Dead Stock Analysis';
  else if (path.startsWith('/suppliers')) title = 'Verified Replenishment Suppliers';
  else if (path.startsWith('/assistant')) title = 'AI Assistant Console';

  return (
    <div className="min-h-screen bg-surface-bg flex">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <Navbar title={title} />
        <main className="flex-1">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/products/:id" element={<ProductDetails />} />
            <Route path="/forecasting" element={<Forecasting />} />
            <Route path="/reordering" element={<Reordering />} />
            <Route path="/dead-stock" element={<DeadStock />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/assistant" element={<AiAssistant />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
