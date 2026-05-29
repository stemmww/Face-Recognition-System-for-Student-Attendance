import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Layout } from "antd";
import Sidebar from "./Sidebar";
import Header from "./Header";
import ErrorBoundary from "./ErrorBoundary";
import type { User } from "@/types";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useThemeStore } from "@/stores/themeStore";

const { Content } = Layout;

interface Props {
  user: User;
  onLogout: () => void;
}

export default function AppLayout({ user, onLogout }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();
  const isDark = useThemeStore((s) => s.isDark);

  const sidebarWidth = isMobile ? 0 : collapsed ? 64 : 248;
  const pageBg = isDark ? "rgb(12, 12, 12)" : "#f8fafc";

  return (
    <Layout style={{ minHeight: "100vh", background: pageBg }}>
      <Sidebar
        role={user.role}
        collapsed={collapsed}
        onCollapse={setCollapsed}
        isMobile={isMobile}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        canSelfEnrollFace={user.can_self_enroll_face === true}
      />
      <Layout
        style={{
          marginLeft: sidebarWidth,
          transition: isMobile ? "none" : "margin-left 0.2s",
          background: pageBg,
          minHeight: "100vh",
        }}
      >
        <Header
          user={user}
          onLogout={onLogout}
          isMobile={isMobile}
          onMenuClick={() => setMobileOpen(true)}
        />
        <Content
          style={{
            padding: isMobile ? 16 : 24,
            background: pageBg,
            minHeight: "calc(100vh - 56px)",
          }}
        >
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </Content>
      </Layout>
    </Layout>
  );
}
