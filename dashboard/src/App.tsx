import { FrappeProvider } from "frappe-react-sdk";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "@/components/ui/Layout";
import DashboardPage from "@/pages/DashboardPage";
import AssignmentsPage from "@/pages/AssignmentsPage";
import AlertsPage from "@/pages/AlertsPage";
import SettingsPage from "@/pages/SettingsPage";
import AssignmentDetailPage from "@/pages/AssignmentDetailPage";

function App() {
  return (
    <FrappeProvider>
      <BrowserRouter basename="/dashboard">
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="/assignments" element={<AssignmentsPage />} />
            <Route path="/assignments/:assignmentId/submission" element={<AssignmentDetailPage />} />
            <Route path="/announcements" element={<AlertsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </FrappeProvider>
  );
}

export default App;