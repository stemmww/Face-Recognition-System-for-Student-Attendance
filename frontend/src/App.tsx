import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ConfigProvider, Spin, theme } from "antd";
import { useAuth } from "@/hooks/useAuth";
import { useThemeStore } from "@/stores/themeStore";
import AppLayout from "@/components/Layout/AppLayout";
import ProtectedRoute from "@/components/Layout/ProtectedRoute";
import Login from "@/pages/Login";
import StudentApp from "@/studentApp/StudentApp";

// Admin pages
import AdminDashboard from "@/pages/admin/Dashboard";
import UserManagement from "@/pages/admin/UserManagement";
import CourseManagement from "@/pages/admin/CourseManagement";
import GroupManagement from "@/pages/admin/GroupManagement";
import ProfessorManagement from "@/pages/admin/ProfessorManagement";
import ClassroomManagement from "@/pages/admin/ClassroomManagement";
import ScheduleManagement from "@/pages/admin/ScheduleManagement";
import FaceRegistry from "@/pages/admin/FaceRegistry";
import AttendanceOverview from "@/pages/admin/AttendanceOverview";
import QrAccess from "@/pages/admin/QrAccess";

// Professor pages
import ProfessorDashboard from "@/pages/professor/Dashboard";
import ProfessorMyCourses from "@/pages/professor/MyCourses";
import ProfessorMySchedule from "@/pages/professor/MySchedule";
import LiveSession from "@/pages/professor/LiveSession";
import ProfessorAttendance from "@/pages/professor/Attendance";
import ProfessorStatistics from "@/pages/professor/Statistics";
import AppealsReview from "@/pages/professor/AppealsReview";

// Student pages
import StudentDashboard from "@/pages/student/Dashboard";
import StudentMyCourses from "@/pages/student/MyCourses";
import StudentMySchedule from "@/pages/student/MySchedule";
import AttendanceHistory from "@/pages/student/AttendanceHistory";
import Appeals from "@/pages/student/Appeals";
import NotificationsPage from "@/pages/student/Notifications";
import Attend from "@/pages/student/Attend";
import FaceEnrollment from "@/pages/student/FaceEnrollment";

// Shared pages
import Profile from "@/pages/Profile";
import ResetPassword from "@/pages/ResetPassword";
import { BRAND_PRIMARY, BRAND_PRIMARY_RGB } from "@/styles/theme";

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
    // Run only once on mount — authoritative auth bootstrap.
    // Including `user`/`fetchUser` in deps would re-fetch on every store update.
    if (!user) fetchUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          path="/admin/groups"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <GroupManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/professors"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <ProfessorManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/classrooms"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <ClassroomManagement />
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
        <Route
          path="/admin/qr-access"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <QrAccess />
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

        {/* My Schedule (professor + student) */}
        <Route
          path="/my-schedule"
          element={
            <ProtectedRoute allowedRoles={["professor", "student"]}>
              <MyScheduleRouter />
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
        <Route
          path="/student/face-enrollment"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <FaceEnrollment />
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

function MyScheduleRouter() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === "professor") return <ProfessorMySchedule />;
  return <StudentMySchedule />;
}

export default function App() {
  const { isAuthenticated } = useAuth();
  const isDark = useThemeStore((s) => s.isDark);

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: BRAND_PRIMARY,
          colorInfo: BRAND_PRIMARY,
          colorSuccess: "#10b981",
          colorWarning: "#f59e0b",
          colorError: "#ef4444",
          colorBgLayout: isDark ? "rgb(12, 12, 12)" : "#f1f5f9",
          ...(isDark && {
            colorBgContainer: "rgb(33, 33, 33)",
            colorBgElevated: "rgb(33, 33, 33)",
            colorBorder: "#3a3a3a",
            colorBorderSecondary: "#2b2b2b",
            colorBgSpotlight: "rgb(33, 33, 33)",
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
            colorPrimary: BRAND_PRIMARY,
            algorithm: true,
          },
          Menu: {
            darkItemBg: "transparent",
            darkItemSelectedBg: `rgba(${BRAND_PRIMARY_RGB},0.25)`,
            darkItemHoverBg: `rgba(${BRAND_PRIMARY_RGB},0.15)`,
            darkItemSelectedColor: BRAND_PRIMARY,
          },
          Card: {
            borderRadiusLG: 12,
            ...(isDark && {
              colorBgContainer: "rgb(33, 33, 33)",
            }),
          },
          Table: isDark ? {
            colorBgContainer: "rgb(33, 33, 33)",
            headerBg: "#2b2b2b",
            rowHoverBg: "#2b2b2b",
          } : {},
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/student-app/*" element={<StudentApp />} />
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
