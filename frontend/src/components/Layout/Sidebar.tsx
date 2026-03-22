import { useLocation, useNavigate } from "react-router-dom";
import { Drawer, Layout, Menu } from "antd";
import {
  DashboardOutlined,
  UserOutlined,
  BookOutlined,
  CalendarOutlined,
  ScanOutlined,
  BarChartOutlined,
  BellOutlined,
  FileTextOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import type { Role } from "@/types";

const { Sider } = Layout;

interface Props {
  role: Role;
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
  isMobile: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function getMenuItems(role: Role) {
  const shared = [
    {
      key: "/dashboard",
      icon: <DashboardOutlined />,
      label: "Dashboard",
    },
  ];

  if (role === "admin") {
    return [
      ...shared,
      { key: "/admin/users", icon: <TeamOutlined />, label: "User Management" },
      { key: "/admin/courses", icon: <BookOutlined />, label: "Courses" },
      { key: "/admin/schedules", icon: <CalendarOutlined />, label: "Schedules" },
      { key: "/admin/faces", icon: <ScanOutlined />, label: "Face Registry" },
      { key: "/admin/attendance", icon: <BarChartOutlined />, label: "Attendance" },
      { key: "/profile", icon: <UserOutlined />, label: "Profile" },
    ];
  }

  if (role === "professor") {
    return [
      ...shared,
      { key: "/courses", icon: <BookOutlined />, label: "My Courses" },
      { key: "/sessions", icon: <ScanOutlined />, label: "Live Sessions" },
      { key: "/attendance", icon: <CalendarOutlined />, label: "Attendance" },
      { key: "/statistics", icon: <BarChartOutlined />, label: "Statistics" },
      { key: "/appeals-review", icon: <FileTextOutlined />, label: "Appeals" },
      { key: "/profile", icon: <UserOutlined />, label: "Profile" },
    ];
  }

  return [
    ...shared,
    { key: "/attend", icon: <ScanOutlined />, label: "Attend" },
    { key: "/courses", icon: <BookOutlined />, label: "My Courses" },
    { key: "/appeals", icon: <FileTextOutlined />, label: "Appeals" },
    { key: "/notifications", icon: <BellOutlined />, label: "Notifications" },
    { key: "/profile", icon: <UserOutlined />, label: "Profile" },
  ];
}

const logoArea = (collapsed: boolean) => (
  <div
    style={{
      height: 64,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      borderBottom: "1px solid rgba(255,255,255,0.08)",
      margin: "0 0 8px",
    }}
  >
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: "rgba(99,102,241,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <ScanOutlined style={{ color: "#c7d2fe", fontSize: 16 }} />
    </div>
    {!collapsed && (
      <span
        style={{
          color: "#e0e7ff",
          fontWeight: 700,
          fontSize: 15,
          whiteSpace: "nowrap",
          letterSpacing: -0.3,
        }}
      >
        Face Attendance
      </span>
    )}
  </div>
);

const sidebarBg = "linear-gradient(180deg, #1e1b4b 0%, #312e81 100%)";

export default function Sidebar({
  role,
  collapsed,
  onCollapse,
  isMobile,
  mobileOpen,
  onMobileClose,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const items = getMenuItems(role);

  const handleClick = (key: string) => {
    navigate(key);
    if (isMobile) onMobileClose();
  };

  const menuContent = (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[location.pathname]}
      items={items}
      onClick={({ key }) => handleClick(key)}
      style={{ background: "transparent", borderRight: 0 }}
    />
  );

  if (isMobile) {
    return (
      <Drawer
        placement="left"
        open={mobileOpen}
        onClose={onMobileClose}
        width={260}
        styles={{
          body: { padding: 0, background: "#1e1b4b" },
          header: { display: "none" },
        }}
      >
        <div style={{ background: sidebarBg, minHeight: "100vh" }}>
          {logoArea(false)}
          {menuContent}
        </div>
      </Drawer>
    );
  }

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={onCollapse}
      style={{
        overflow: "auto",
        height: "100vh",
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        background: sidebarBg,
      }}
      trigger={
        <div
          style={{
            background: "rgba(255,255,255,0.06)",
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {collapsed ? "\u203A" : "\u2039 Collapse"}
        </div>
      }
    >
      {logoArea(collapsed)}
      {menuContent}
    </Sider>
  );
}
