import { useCallback, useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Avatar,
  Badge,
  Button,
  Dropdown,
  Form,
  Input,
  List,
  Modal,
  Result,
  Spin,
  Typography,
  message,
} from "antd";
import {
  BellOutlined,
  BookOutlined,
  CalendarOutlined,
  FileTextOutlined,
  GlobalOutlined,
  HomeOutlined,
  LockOutlined,
  LogoutOutlined,
  MailOutlined,
  MoonOutlined,
  QrcodeOutlined,
  SunOutlined,
  UserOutlined,
} from "@ant-design/icons";

import { forgotPassword } from "@/api/auth";
import { getUnreadCount } from "@/api/notifications";
import { useAuth } from "@/hooks/useAuth";
import { useThemeStore } from "@/stores/themeStore";
import { useAuthStore } from "@/stores/authStore";
import { BRAND_PRIMARY, themeColors } from "@/styles/theme";

import StudentDashboard from "@/pages/student/Dashboard";
import StudentMyCourses from "@/pages/student/MyCourses";
import StudentMySchedule from "@/pages/student/MySchedule";
import AttendanceHistory from "@/pages/student/AttendanceHistory";
import Attend from "@/pages/student/Attend";
import Appeals from "@/pages/student/Appeals";
import NotificationsPage from "@/pages/student/Notifications";
import Profile from "@/pages/Profile";

import "./studentApp.css";

const { Title, Text } = Typography;

const LANGS = [
  { key: "en", label: "EN" },
  { key: "kk", label: "KK" },
  { key: "ru", label: "RU" },
] as const;

function CenteredSpin() {
  return (
    <div className="student-app-loading">
      <Spin size="large" />
    </div>
  );
}

function StudentAppLogin() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { login, logout, isAuthenticated, user, fetchUser, isLoading: authLoading } = useAuth();
  const { isDark, toggle } = useThemeStore();
  const colors = themeColors(isDark);
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotForm] = Form.useForm();

  useEffect(() => {
    if (isAuthenticated && !user && !authLoading) {
      fetchUser();
    }
  }, [authLoading, fetchUser, isAuthenticated, user]);

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem("language", lang);
  };

  const langItems = {
    items: LANGS.map((lang) => ({
      key: lang.key,
      label: lang.label,
      onClick: () => changeLanguage(lang.key),
      style: i18n.language === lang.key ? { fontWeight: 700, color: BRAND_PRIMARY } : undefined,
    })),
  };

  if (isAuthenticated && !user) {
    return <CenteredSpin />;
  }

  if (isAuthenticated && user?.role === "student") {
    return <Navigate to="/student-app/home" replace />;
  }

  if (isAuthenticated && user && user.role !== "student") {
    return (
      <div className="student-login-page">
        <Result
          status="403"
          title={t("roles.student")}
          subTitle="This app is only for student accounts."
          extra={
            <Button
              type="primary"
              onClick={() => {
                logout();
                navigate("/student-app/login", { replace: true });
              }}
            >
              {t("common.logout")}
            </Button>
          }
        />
      </div>
    );
  }

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.email, values.password);
      const currentUser = useAuthStore.getState().user;
      if (currentUser?.role !== "student") {
        logout();
        message.error("Use a student account to enter the student app.");
        return;
      }
      navigate("/student-app/home", { replace: true });
    } catch {
      message.error(t("login.loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  const onForgotSubmit = async (values: { email: string }) => {
    setForgotLoading(true);
    try {
      await forgotPassword(values.email);
      message.success(t("login.forgotSent"));
      setForgotOpen(false);
      forgotForm.resetFields();
    } catch {
      message.error(t("login.forgotFailed"));
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="student-login-page">
      <div className="student-login-toolbar">
        <Dropdown menu={langItems} placement="bottomRight" trigger={["click"]}>
          <Button type="text" icon={<GlobalOutlined />} />
        </Dropdown>
        <Button
          type="text"
          icon={isDark ? <SunOutlined /> : <MoonOutlined />}
          onClick={toggle}
        />
      </div>

      <div className="student-login-card">
        <div className="student-login-brand">
          <div className="student-login-logo">
            <QrcodeOutlined />
          </div>
          <div>
            <Title level={3} style={{ margin: 0, color: colors.heading }}>
              Student App
            </Title>
            <Text style={{ color: colors.subtitle }}>{t("login.signInSubtitle")}</Text>
          </div>
        </div>

        <Form layout="vertical" size="large" requiredMark={false} onFinish={onFinish}>
          <Form.Item
            name="email"
            label={t("login.emailLabel")}
            rules={[
              { required: true, message: t("login.emailRequired") },
              { type: "email", message: t("login.emailInvalid") },
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder={t("login.emailPlaceholder")}
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={t("login.passwordLabel")}
            rules={[{ required: true, message: t("login.passwordRequired") }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t("login.passwordPlaceholder")}
              autoComplete="current-password"
            />
          </Form.Item>

          <Button type="link" className="student-forgot-link" onClick={() => setForgotOpen(true)}>
            {t("login.forgotPassword")}
          </Button>

          <Button type="primary" htmlType="submit" block loading={loading} className="student-login-submit">
            {t("login.signIn")}
          </Button>
        </Form>
      </div>

      <Modal
        open={forgotOpen}
        title={t("login.forgotPasswordTitle")}
        onCancel={() => {
          setForgotOpen(false);
          forgotForm.resetFields();
        }}
        footer={null}
        destroyOnHidden
      >
        <Text style={{ display: "block", marginBottom: 16 }}>{t("login.forgotDescription")}</Text>
        <Form form={forgotForm} layout="vertical" requiredMark={false} onFinish={onForgotSubmit}>
          <Form.Item
            name="email"
            label={t("login.emailLabel")}
            rules={[
              { required: true, message: t("login.emailRequired") },
              { type: "email", message: t("login.emailInvalid") },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder={t("login.emailPlaceholder")} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={forgotLoading}>
            {t("login.sendResetLink")}
          </Button>
        </Form>
      </Modal>
    </div>
  );
}

function StudentMore() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const items = [
    { key: "notifications", icon: <BellOutlined />, title: t("nav.notifications"), path: "/student-app/notifications" },
    { key: "appeals", icon: <FileTextOutlined />, title: t("nav.appeals"), path: "/student-app/appeals" },
    { key: "profile", icon: <UserOutlined />, title: t("nav.profile"), path: "/student-app/profile" },
  ];

  return (
    <div>
      <Title level={4}>{t("common.more", "More")}</Title>
      <List
        className="student-more-list"
        dataSource={items}
        renderItem={(item) => (
          <List.Item onClick={() => navigate(item.path)} className="student-more-item">
            <List.Item.Meta avatar={item.icon} title={item.title} />
          </List.Item>
        )}
      />
      <Button
        danger
        block
        size="large"
        icon={<LogoutOutlined />}
        onClick={() => {
          logout();
          navigate("/student-app/login", { replace: true });
        }}
      >
        {t("common.logout")}
      </Button>
    </div>
  );
}

function StudentAppLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isDark } = useThemeStore();
  const [unread, setUnread] = useState(0);

  const fetchUnread = useCallback(async () => {
    try {
      setUnread(await getUnreadCount());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30_000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  const navItems = [
    { path: "/student-app/home", label: t("nav.dashboard"), icon: <HomeOutlined /> },
    { path: "/student-app/schedule", label: t("nav.mySchedule"), icon: <CalendarOutlined /> },
    { path: "/student-app/attend", label: t("nav.attend"), icon: <QrcodeOutlined />, primary: true },
    { path: "/student-app/courses", label: t("nav.myCourses"), icon: <BookOutlined /> },
    { path: "/student-app/more", label: t("common.more", "More"), icon: <UserOutlined /> },
  ];

  const title = (() => {
    if (location.pathname.includes("/schedule")) return t("nav.mySchedule");
    if (location.pathname.includes("/attend")) return t("nav.attend");
    if (location.pathname.includes("/courses")) return t("nav.myCourses");
    if (location.pathname.includes("/appeals")) return t("nav.appeals");
    if (location.pathname.includes("/notifications")) return t("nav.notifications");
    if (location.pathname.includes("/profile")) return t("nav.profile");
    if (location.pathname.includes("/more")) return t("common.more", "More");
    return t("nav.dashboard");
  })();

  return (
    <div className={`student-app-root ${isDark ? "student-app-dark" : ""}`}>
      <div className="student-app-frame">
        <header className="student-app-topbar">
          <div>
            <Text className="student-app-eyebrow">Student Attendance</Text>
            <Title level={5} className="student-app-title">{title}</Title>
          </div>
          <div className="student-app-actions">
            <Button
              type="text"
              className="student-app-icon-btn"
              onClick={() => navigate("/student-app/notifications")}
            >
              <Badge count={unread} size="small">
                <BellOutlined />
              </Badge>
            </Button>
            <Avatar
              size={34}
              icon={<UserOutlined />}
              src={user?.photo_url ? `/uploads/${user.photo_url}` : undefined}
              onClick={() => navigate("/student-app/profile")}
            />
          </div>
        </header>

        <main className="student-app-content">
          <Outlet />
        </main>

        <nav className="student-app-bottom-nav">
          {navItems.map((item) => {
            const active = item.path === "/student-app/more"
              ? ["/student-app/more", "/student-app/appeals", "/student-app/notifications", "/student-app/profile"]
                  .some((path) => location.pathname.startsWith(path))
              : location.pathname === item.path || location.pathname.startsWith(item.path + "/");
            return (
              <button
                key={item.path}
                type="button"
                className={[
                  "student-app-nav-item",
                  active ? "active" : "",
                  item.primary ? "primary" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => navigate(item.path)}
              >
                <span className="student-app-nav-icon">{item.icon}</span>
                <span className="student-app-nav-label">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function StudentAppGuard() {
  const { isAuthenticated, isLoading, user, fetchUser, logout } = useAuth();

  useEffect(() => {
    if (isAuthenticated && !user && !isLoading) {
      fetchUser();
    }
  }, [fetchUser, isAuthenticated, isLoading, user]);

  if (!isAuthenticated) {
    return <Navigate to="/student-app/login" replace />;
  }

  if (isLoading || !user) {
    return <CenteredSpin />;
  }

  if (user.role !== "student") {
    return (
      <div className="student-login-page">
        <Result
          status="403"
          title="Student app"
          subTitle="This app is only for student accounts."
          extra={
            <Button
              type="primary"
              onClick={() => {
                logout();
                window.location.href = "/student-app/login";
              }}
            >
              Logout
            </Button>
          }
        />
      </div>
    );
  }

  return <StudentAppLayout />;
}

export default function StudentApp() {
  return (
    <Routes>
      <Route path="login" element={<StudentAppLogin />} />
      <Route element={<StudentAppGuard />}>
        <Route index element={<Navigate to="/student-app/home" replace />} />
        <Route path="home" element={<StudentDashboard />} />
        <Route path="schedule" element={<StudentMySchedule />} />
        <Route path="attend" element={<Attend />} />
        <Route path="courses" element={<StudentMyCourses />} />
        <Route path="courses/:courseId/attendance" element={<AttendanceHistory />} />
        <Route path="appeals" element={<Appeals />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<Profile />} />
        <Route path="more" element={<StudentMore />} />
      </Route>
      <Route path="*" element={<Navigate to="/student-app/home" replace />} />
    </Routes>
  );
}
