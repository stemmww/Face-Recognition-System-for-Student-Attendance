import { useLocation, useNavigate } from "react-router-dom";
import { Layout, Menu } from "antd";
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
      {
        key: "/admin/users",
        icon: <TeamOutlined />,
        label: "User Management",
      },
      {
        key: "/admin/courses",
        icon: <BookOutlined />,
        label: "Courses",
      },
      {
        key: "/admin/schedules",
        icon: <CalendarOutlined />,
        label: "Schedules",
      },
      {
        key: "/admin/faces",
        icon: <ScanOutlined />,
        label: "Face Registry",
      },
      {
        key: "/admin/attendance",
        icon: <BarChartOutlined />,
        label: "Attendance",
      },
      {
        key: "/profile",
        icon: <UserOutlined />,
        label: "Profile",
      },
    ];
  }

  if (role === "professor") {
    return [
      ...shared,
      {
        key: "/courses",
        icon: <BookOutlined />,
        label: "My Courses",
      },
      {
        key: "/sessions",
        icon: <ScanOutlined />,
        label: "Live Sessions",
      },
      {
        key: "/attendance",
        icon: <CalendarOutlined />,
        label: "Attendance",
      },
      {
        key: "/statistics",
        icon: <BarChartOutlined />,
        label: "Statistics",
      },
      {
        key: "/appeals-review",
        icon: <FileTextOutlined />,
        label: "Appeals",
      },
      {
        key: "/profile",
        icon: <UserOutlined />,
        label: "Profile",
      },
    ];
  }

  // student
  return [
    ...shared,
    {
      key: "/courses",
      icon: <BookOutlined />,
      label: "My Courses",
    },
    {
      key: "/appeals",
      icon: <FileTextOutlined />,
      label: "Appeals",
    },
    {
      key: "/notifications",
      icon: <BellOutlined />,
      label: "Notifications",
    },
    {
      key: "/profile",
      icon: <UserOutlined />,
      label: "Profile",
    },
  ];
}

export default function Sidebar({ role, collapsed, onCollapse }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  const items = getMenuItems(role);

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
      }}
    >
      <div
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontWeight: 700,
          fontSize: collapsed ? 14 : 16,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {collapsed ? "FAS" : "Face Attendance"}
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[location.pathname]}
        items={items}
        onClick={({ key }) => navigate(key)}
      />
    </Sider>
  );
}
