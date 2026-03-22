import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Layout } from "antd";
import Sidebar from "./Sidebar";
import Header from "./Header";
import type { User } from "@/types";
import { useIsMobile } from "@/hooks/useIsMobile";

const { Content } = Layout;

interface Props {
  user: User;
  onLogout: () => void;
}

export default function AppLayout({ user, onLogout }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();

  const marginLeft = isMobile ? 0 : collapsed ? 80 : 200;

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar
        role={user.role}
        collapsed={collapsed}
        onCollapse={setCollapsed}
        isMobile={isMobile}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <Layout style={{ marginLeft, transition: isMobile ? "none" : "margin-left 0.2s" }}>
        <Header
          user={user}
          onLogout={onLogout}
          isMobile={isMobile}
          onMenuClick={() => setMobileOpen(true)}
        />
        <Content
          style={{
            margin: isMobile ? 12 : 24,
            padding: isMobile ? 16 : 24,
            background: "#fff",
            borderRadius: 12,
            minHeight: 280,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
