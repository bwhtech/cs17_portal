import { FrappeProvider } from "frappe-react-sdk";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "@/components/ui/Layout";
import DashboardPage from "@/pages/DashboardPage";
import AssignmentsPage from "@/pages/AssignmentsPage";
import AlertsPage from "@/pages/AlertsPage";
import SettingsPage from "@/pages/SettingsPage";
import AssignmentDetailPage from "@/pages/AssignmentDetailPage";
import ProjectsPage from "@/pages/ProjectsPage";
import ProjectEditorPage from "@/pages/ProjectEditorPage";
import FacultyLayout from "@/faculty/FacultyLayout";
import FacultyDashboardPage from "@/faculty/FacultyDashboardPage";
import FacultySubmissionsPage from "@/faculty/FacultySubmissionsPage";
import FacultySettingsPage from "@/faculty/FacultySettingsPage";

function App() {
  return (
    <FrappeProvider>
      <BrowserRouter basename="/dashboard">
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="/assignments" element={<AssignmentsPage />} />
            <Route path="/assignments/:assignmentId/submission" element={<AssignmentDetailPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id/edit" element={<ProjectEditorPage />} />
            <Route path="/announcements" element={<AlertsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          <Route path="/faculty" element={<FacultyLayout />}>
            <Route index element={<FacultyDashboardPage />} />
            <Route path="assignments" element={<FacultySubmissionsPage />} />
            <Route path="settings" element={<FacultySettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </FrappeProvider>
  );
}

export default App;
