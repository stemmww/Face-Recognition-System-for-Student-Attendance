import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ConfigProvider, Spin, theme } from "antd";
import { useAuth } from "@/hooks/useAuth";
import { useThemeStore } from "@/stores/themeStore";
import AppLayout from "@/components/Layout/AppLayout";
import ProtectedRoute from "@/components/Layout/ProtectedRoute";
import Login from "@/pages/Login";

// Admin pages
import AdminDashboard from "@/pages/admin/Dashboard";
import UserManagement from "@/pages/admin/UserManagement";
import CourseManagement from "@/pages/admin/CourseManagement";
import ScheduleManagement from "@/pages/admin/ScheduleManagement";
import FaceRegistry from "@/pages/admin/FaceRegistry";
import AttendanceOverview from "@/pages/admin/AttendanceOverview";

// Professor pages
import ProfessorDashboard from "@/pages/professor/Dashboard";
import ProfessorMyCourses from "@/pages/professor/MyCourses";
import LiveSession from "@/pages/professor/LiveSession";
import ProfessorAttendance from "@/pages/professor/Attendance";
import ProfessorStatistics from "@/pages/professor/Statistics";
import AppealsReview from "@/pages/professor/AppealsReview";

// Student pages
import StudentDashboard from "@/pages/student/Dashboard";
import StudentMyCourses from "@/pages/student/MyCourses";
import AttendanceHistory from "@/pages/student/AttendanceHistory";
import Appeals from "@/pages/student/Appeals";
import NotificationsPage from "@/pages/student/Notifications";
import Attend from "@/pages/student/Attend";

// Shared pages
import Profile from "@/pages/Profile";
import ResetPassword from "@/pages/ResetPassword";

function DashboardRouter() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === "admin") return <AdminDashboard />;
  if (user.role === "professor") return <ProfessorDashboard />;
  return <StudentDashboard />;
}

function AuthenticatedApp() {
  const { user, isLoading, fetchUser, logout } = useAuth();

  useEffect(() => {
    if (!user) fetchUser();
  }, []);

  if (isLoading || !user) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<AppLayout user={user} onLogout={() => { logout(); window.location.href = "/login"; }} />}>
        <Route path="/dashboard" element={<DashboardRouter />} />
        <Route path="/profile" element={<Profile />} />

        {/* Admin routes */}
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/courses"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <CourseManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/schedules"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <ScheduleManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/faces"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <FaceRegistry />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/attendance"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AttendanceOverview />
            </ProtectedRoute>
          }
        />

        {/* Professor routes */}
        <Route
          path="/courses"
          element={
            <ProtectedRoute allowedRoles={["professor", "student"]}>
              <CoursesRouter />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sessions"
          element={
            <ProtectedRoute allowedRoles={["admin", "professor"]}>
              <LiveSession />
            </ProtectedRoute>
          }
        />
        <Route
          path="/attendance"
          element={
            <ProtectedRoute allowedRoles={["admin", "professor"]}>
              <ProfessorAttendance />
            </ProtectedRoute>
          }
        />

        {/* Professor: statistics + appeals review */}
        <Route
          path="/statistics"
          element={
            <ProtectedRoute allowedRoles={["admin", "professor"]}>
              <ProfessorStatistics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/appeals-review"
          element={
            <ProtectedRoute allowedRoles={["admin", "professor"]}>
              <AppealsReview />
            </ProtectedRoute>
          }
        />

        {/* Student routes */}
        <Route
          path="/attend"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <Attend />
            </ProtectedRoute>
          }
        />
        <Route
          path="/courses/:courseId/attendance"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <AttendanceHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/appeals"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <Appeals />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <NotificationsPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

function CoursesRouter() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === "professor") return <ProfessorMyCourses />;
  return <StudentMyCourses />;
}

export default function App() {
  const { isAuthenticated } = useAuth();
  const isDark = useThemeStore((s) => s.isDark);

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: "#6366f1",
          colorInfo: "#6366f1",
          colorSuccess: "#10b981",
          colorWarning: "#f59e0b",
          colorError: "#ef4444",
          colorBgLayout: isDark ? "#111827" : "#f1f5f9",
          ...(isDark && {
            colorBgContainer: "#1e293b",
            colorBgElevated: "#1e293b",
            colorBorder: "#334155",
            colorBorderSecondary: "#283548",
            colorBgSpotlight: "#374151",
            colorText: "#e2e8f0",
            colorTextSecondary: "#94a3b8",
            colorTextTertiary: "#64748b",
            colorTextQuaternary: "#475569",
          }),
          borderRadius: 8,
          fontFamily:
            "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        },
        components: {
          Button: {
            colorPrimary: "#6366f1",
            algorithm: true,
          },
          Menu: {
            darkItemBg: "transparent",
            darkItemSelectedBg: "rgba(99,102,241,0.25)",
            darkItemHoverBg: "rgba(99,102,241,0.15)",
            darkItemSelectedColor: "#c7d2fe",
          },
          Card: {
            borderRadiusLG: 12,
            ...(isDark && {
              colorBgContainer: "#1e293b",
            }),
          },
          Table: isDark ? {
            colorBgContainer: "#1e293b",
            headerBg: "#283548",
            rowHoverBg: "#283548",
          } : {},
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/*"
            element={isAuthenticated ? <AuthenticatedApp /> : <Navigate to="/login" replace />}
          />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
