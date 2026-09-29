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
import NotificationsPage from "./pages/NotificationsPage";
import type { ModuleName, PermissionAction } from "./types";

function protectedPage(page: ReactNode, module?: ModuleName, action?: PermissionAction) {
  return (
    <ProtectedRoute module={module} action={action}>
      <AppShell>{page}</AppShell>
    </ProtectedRoute>
  );
}
//App
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify/:code" element={<QrVerificationPage />} />

          <Route path="/dashboard" element={protectedPage(<DashboardPage />, "dashboard")} />
          <Route path="/users" element={protectedPage(<UserManagementPage />, "user_management")} />
          <Route path="/roles" element={protectedPage(<RoleManagementPage />, "role_management")} />
          <Route path="/locations" element={protectedPage(<LocationMastersPage />, "location_management")} />
          <Route path="/vendors" element={protectedPage(<VendorManagementPage />, "vendor_management")} />
          <Route path="/vendors/new" element={protectedPage(<VendorRegistrationPage />, "vendor_management")} />
          <Route path="/vendors/:id/edit" element={protectedPage(<VendorRegistrationPage />, "vendor_management", "edit")} />
          <Route path="/contractors" element={protectedPage(<ContractorManagementPage />, "contractor_management")} />
          <Route path="/contractors/new" element={protectedPage(<ContractorRegistrationPage />, "contractor_management")} />
          <Route path="/id-cards" element={protectedPage(<IdCardQrPage />, "id_card_management")} />
          <Route path="/renewals" element={protectedPage(<RenewalsPage />, "vendor_management")} />
          <Route path="/complaints" element={protectedPage(<ComplaintsPage />, "complaint_management")} />
          <Route path="/complaints/new" element={protectedPage(<ComplaintRegistrationPage />, "complaint_management")} />
          <Route path="/complaints/import" element={protectedPage(<ComplaintImportPage />, "complaint_management")} />
          <Route path="/complaints/types" element={protectedPage(<ComplaintTypeMasterPage />, "complaint_management")} />
          <Route path="/inspections" element={protectedPage(<InspectionsPage />, "inspection_management")} />
          <Route path="/inspections/new" element={protectedPage(<InspectionFormPage />, "inspection_management")} />
          <Route path="/inspections/:id/edit" element={protectedPage(<InspectionFormPage />, "inspection_management")} />
          <Route path="/inspections/types" element={protectedPage(<InspectionTypeMasterPage />, "inspection_management")} />
          <Route path="/penalties" element={protectedPage(<PenaltiesPage />, "penalty_management")} />
          <Route path="/audit-logs" element={protectedPage(<AuditLogsPage />, "audit_logs")} />
          <Route path="/reports" element={protectedPage(<ReportsPage />, "reports")} />
          <Route path="/reports/builder" element={protectedPage(<ReportBuilderPage />, "reports")} />
          <Route path="/reports/saved" element={protectedPage(<SavedReportsPage />, "reports")} />
          <Route path="/reports/exports" element={protectedPage(<ExportHistoryPage />, "reports")} />
          <Route path="/reports/import" element={protectedPage(<ImportManagementPage />, "reports")} />
          {/* Notifications are personal, not module-gated — every
              authenticated role can reach them regardless of role_permissions. */}
          <Route path="/notifications" element={protectedPage(<NotificationsPage />)} />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
