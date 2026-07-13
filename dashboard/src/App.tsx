import { FrappeProvider } from "frappe-react-sdk";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ZenModeProvider } from "@/context/ZenModeContext";
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
import FacultyAssignmentsPage from "@/faculty/FacultyAssignmentsPage";
import FacultyAssignmentDetailPage from "@/faculty/FacultyAssignmentDetailPage";
import FacultyAnnouncementsPage from "@/faculty/FacultyAnnouncementsPage";
import FacultySubmissionsPage from "@/faculty/FacultySubmissionsPage";
import FacultyGradingPage from "@/faculty/FacultyGradingPage";
import FacultySettingsPage from "@/faculty/FacultySettingsPage";

function App() {
  return (
    <FrappeProvider>
      <BrowserRouter basename="/dashboard">
        <ZenModeProvider>
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
            <Route path="assignments" element={<FacultyAssignmentsPage />} />
            <Route path="assignments/:assignmentId" element={<FacultyAssignmentDetailPage />} />
            <Route path="announcements" element={<FacultyAnnouncementsPage />} />
            <Route path="submissions" element={<FacultySubmissionsPage />} />
            <Route path="submissions/:submissionId" element={<FacultyGradingPage />} />
            <Route path="settings" element={<FacultySettingsPage />} />
          </Route>
          </Routes>
        </ZenModeProvider>
      </BrowserRouter>
    </FrappeProvider>
  );
}

export default App;
