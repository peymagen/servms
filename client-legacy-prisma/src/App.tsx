import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import AppShell from "./components/layout/AppShell";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import UserManagementPage from "./pages/UserManagementPage";
import VendorManagementPage from "./pages/VendorManagementPage";
import LocationMastersPage from "./pages/LocationMastersPage";
import IdCardQrPage from "./pages/IdCardQrPage";
import ComplaintsPage from "./pages/ComplaintsPage";
import PenaltiesPage from "./pages/PenaltiesPage";
import ReportsPage from "./pages/ReportsPage";

function protectedPage(page: ReactNode) {
  return (
    <ProtectedRoute>
      <AppShell>{page}</AppShell>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={protectedPage(<DashboardPage />)} />
          <Route path="/users" element={protectedPage(<UserManagementPage />)} />
          <Route path="/locations" element={protectedPage(<LocationMastersPage />)} />
          <Route path="/vendors" element={protectedPage(<VendorManagementPage />)} />
          <Route path="/id-cards" element={protectedPage(<IdCardQrPage />)} />
          <Route path="/complaints" element={protectedPage(<ComplaintsPage />)} />
          <Route path="/penalties" element={protectedPage(<PenaltiesPage />)} />
          <Route path="/reports" element={protectedPage(<ReportsPage />)} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
