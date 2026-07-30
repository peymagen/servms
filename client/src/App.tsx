import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import AppShell from "./components/layout/AppShell";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import UserManagementPage from "./pages/UserManagementPage";
import RoleManagementPage from "./pages/RoleManagementPage";
import LocationMastersPage from "./pages/LocationMastersPage";
import VendorManagementPage from "./pages/VendorManagementPage";
import VendorRegistrationPage from "./pages/VendorRegistrationPage";
import ContractorManagementPage from "./pages/ContractorManagementPage";
import ContractorRegistrationPage from "./pages/ContractorRegistrationPage";
import IdCardQrPage from "./pages/IdCardQrPage";
import RenewalsPage from "./pages/RenewalsPage";
import ComplaintsPage from "./pages/ComplaintsPage";
import ComplaintRegistrationPage from "./pages/ComplaintRegistrationPage";
import ComplaintImportPage from "./pages/ComplaintImportPage";
import ComplaintTypeMasterPage from "./pages/ComplaintTypeMasterPage";
import InspectionsPage from "./pages/InspectionsPage";
import InspectionFormPage from "./pages/InspectionFormPage";
import InspectionTypeMasterPage from "./pages/InspectionTypeMasterPage";
import PenaltiesPage from "./pages/PenaltiesPage";
import QrVerificationPage from "./pages/QrVerificationPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import ReportsPage from "./pages/ReportsPage";
import ReportBuilderPage from "./pages/ReportBuilderPage";
import SavedReportsPage from "./pages/SavedReportsPage";
import ExportHistoryPage from "./pages/ExportHistoryPage";
import ImportManagementPage from "./pages/ImportManagementPage";
import SettingsPage from "./pages/SettingsPage";
import HelpCenterPage from "./pages/HelpCenterPage";
import NotificationsPage from "./pages/NotificationsPage";

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
          <Route path="/verify/:code" element={<QrVerificationPage />} />

          <Route path="/dashboard" element={protectedPage(<DashboardPage />)} />
          <Route path="/users" element={protectedPage(<UserManagementPage />)} />
          <Route path="/roles" element={protectedPage(<RoleManagementPage />)} />
          <Route path="/locations" element={protectedPage(<LocationMastersPage />)} />
          <Route path="/vendors" element={protectedPage(<VendorManagementPage />)} />
          <Route path="/vendors/new" element={protectedPage(<VendorRegistrationPage />)} />
          <Route path="/contractors" element={protectedPage(<ContractorManagementPage />)} />
          <Route path="/contractors/new" element={protectedPage(<ContractorRegistrationPage />)} />
          <Route path="/id-cards" element={protectedPage(<IdCardQrPage />)} />
          <Route path="/renewals" element={protectedPage(<RenewalsPage />)} />
          <Route path="/complaints" element={protectedPage(<ComplaintsPage />)} />
          <Route path="/complaints/new" element={protectedPage(<ComplaintRegistrationPage />)} />
          <Route path="/complaints/import" element={protectedPage(<ComplaintImportPage />)} />
          <Route path="/complaints/types" element={protectedPage(<ComplaintTypeMasterPage />)} />
          <Route path="/inspections" element={protectedPage(<InspectionsPage />)} />
          <Route path="/inspections/new" element={protectedPage(<InspectionFormPage />)} />
          <Route path="/inspections/:id/edit" element={protectedPage(<InspectionFormPage />)} />
          <Route path="/inspections/types" element={protectedPage(<InspectionTypeMasterPage />)} />
          <Route path="/penalties" element={protectedPage(<PenaltiesPage />)} />
          <Route path="/audit-logs" element={protectedPage(<AuditLogsPage />)} />
          <Route path="/reports" element={protectedPage(<ReportsPage />)} />
          <Route path="/reports/builder" element={protectedPage(<ReportBuilderPage />)} />
          <Route path="/reports/saved" element={protectedPage(<SavedReportsPage />)} />
          <Route path="/reports/exports" element={protectedPage(<ExportHistoryPage />)} />
          <Route path="/reports/import" element={protectedPage(<ImportManagementPage />)} />
          <Route path="/notifications" element={protectedPage(<NotificationsPage />)} />
          <Route path="/settings" element={protectedPage(<SettingsPage />)} />
          <Route path="/help" element={protectedPage(<HelpCenterPage />)} />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
