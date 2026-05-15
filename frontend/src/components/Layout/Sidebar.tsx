import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Drawer } from "antd";
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
import { useThemeStore } from "@/stores/themeStore";
import { useAuthStore } from "@/stores/authStore";

interface Props {
  role: Role;
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
  isMobile: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

interface NavItem {
  key: string;
  icon: React.ReactNode;
  label: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

function useNavSections(role: Role): NavSection[] {
  const { t } = useTranslation();

  if (role === "admin") {
    return [
      {
        label: "GENERAL",
        items: [
          { key: "/dashboard", icon: <DashboardOutlined />, label: t("nav.dashboard") },
          { key: "/admin/users", icon: <TeamOutlined />, label: t("nav.userManagement") },
          { key: "/admin/courses", icon: <BookOutlined />, label: t("nav.courses") },
          { key: "/admin/schedules", icon: <CalendarOutlined />, label: t("nav.schedules") },
        ],
      },
      {
        label: "SYSTEM",
        items: [
          { key: "/admin/faces", icon: <ScanOutlined />, label: t("nav.faceRegistry") },
          { key: "/admin/attendance", icon: <BarChartOutlined />, label: t("nav.attendance") },
          { key: "/profile", icon: <UserOutlined />, label: t("nav.profile") },
        ],
      },
    ];
  }

  if (role === "professor") {
    return [
      {
        label: "GENERAL",
        items: [
          { key: "/dashboard", icon: <DashboardOutlined />, label: t("nav.dashboard") },
          { key: "/courses", icon: <BookOutlined />, label: t("nav.myCourses") },
          { key: "/sessions", icon: <ScanOutlined />, label: t("nav.liveSessions") },
          { key: "/attendance", icon: <CalendarOutlined />, label: t("nav.attendance") },
        ],
      },
      {
        label: "MORE",
        items: [
          { key: "/statistics", icon: <BarChartOutlined />, label: t("nav.statistics") },
          { key: "/appeals-review", icon: <FileTextOutlined />, label: t("nav.appeals") },
          { key: "/profile", icon: <UserOutlined />, label: t("nav.profile") },
        ],
      },
    ];
  }

  return [
    {
      label: "GENERAL",
      items: [
        { key: "/dashboard", icon: <DashboardOutlined />, label: t("nav.dashboard") },
        { key: "/attend", icon: <ScanOutlined />, label: t("nav.attend") },
        { key: "/courses", icon: <BookOutlined />, label: t("nav.myCourses") },
      ],
    },
    {
      label: "MORE",
      items: [
        { key: "/appeals", icon: <FileTextOutlined />, label: t("nav.appeals") },
        { key: "/notifications", icon: <BellOutlined />, label: t("nav.notifications") },
        { key: "/profile", icon: <UserOutlined />, label: t("nav.profile") },
      ],
    },
  ];
}

const roleLabels: Record<Role, string> = {
  admin: "Administrator",
  professor: "Professor",
  student: "Student",
};

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function SidebarContent({
  role,
  collapsed,
  onItemClick,
  currentPath,
}: {
  role: Role;
  collapsed: boolean;
  onItemClick: (key: string) => void;
  currentPath: string;
}) {
  const isDark = useThemeStore((s) => s.isDark);
  const user = useAuthStore((s) => s.user);
  const sections = useNavSections(role);

  const surface = isDark ? "#1f2937" : "#ffffff";
  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const text = isDark ? "#e2e8f0" : "#1e293b";
  const textMuted = isDark ? "#94a3b8" : "#64748b";
  const textFaint = isDark ? "#64748b" : "#94a3b8";
  const accent = "#3D5AFE";
  const hover = isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9";
  const active = isDark ? "rgba(61,90,254,0.15)" : "#eef2ff";

  return (
    <div
      style={{
        background: surface,
        borderRight: `1px solid ${border}`,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: collapsed ? "16px 8px" : "20px 14px",
        gap: 4,
        overflowY: "auto",
        overflowX: "hidden",
        transition: "padding 0.2s",
      }}
    >
      {/* Profile */}
      {!collapsed && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 10px",
            borderRadius: 12,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${accent}, #6B82FE)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            {user ? getInitials(user.first_name, user.last_name) : "?"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user ? `${user.first_name} ${user.last_name}` : "—"}
            </div>
            <div style={{ fontSize: 11, color: textMuted }}>{roleLabels[role]}</div>
          </div>
        </div>
      )}

      {collapsed && (
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${accent}, #6B82FE)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            margin: "0 auto 12px",
          }}
        >
          {user ? getInitials(user.first_name, user.last_name) : "?"}
        </div>
      )}

      {/* Nav Sections */}
      {sections.map((section) => (
        <div key={section.label} style={{ marginTop: collapsed ? 12 : 16 }}>
          {!collapsed && (
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: textFaint,
                letterSpacing: "0.1em",
                padding: "0 10px",
                marginBottom: 6,
                textTransform: "uppercase",
              }}
            >
              {section.label}
            </div>
          )}
          {section.items.map((item) => {
            const isActive = currentPath === item.key || currentPath.startsWith(item.key + "/");
            return (
              <div
                key={item.key}
                onClick={() => onItemClick(item.key)}
                title={collapsed ? item.label : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: collapsed ? 0 : 10,
                  padding: collapsed ? "9px" : "9px 10px",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? text : textMuted,
                  background: isActive ? active : "transparent",
                  transition: "all 0.15s",
                  justifyContent: collapsed ? "center" : "flex-start",
                  marginBottom: 2,
                  minHeight: 38,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = hover;
                  if (!isActive) e.currentTarget.style.color = text;
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = "transparent";
                  if (!isActive) e.currentTarget.style.color = textMuted;
                }}
              >
                <span
                  style={{
                    fontSize: 16,
                    color: isActive ? accent : "inherit",
                    display: "flex",
                    alignItems: "center",
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </span>
                {!collapsed && (
                  <span
                    title={item.label}
                    style={{
                      minWidth: 0,
                      lineHeight: 1.25,
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {item.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Footer spacer */}
      <div style={{ marginTop: "auto", paddingTop: 8 }} />
    </div>
  );
}

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
  const isDark = useThemeStore((s) => s.isDark);
  const surface = isDark ? "#1f2937" : "#ffffff";

  const handleClick = (key: string) => {
    navigate(key);
    if (isMobile) onMobileClose();
  };

  if (isMobile) {
    return (
      <Drawer
        placement="left"
        open={mobileOpen}
        onClose={onMobileClose}
        width={264}
        styles={{
          body: { padding: 0, background: surface },
          header: { display: "none" },
        }}
      >
        <SidebarContent
          role={role}
          collapsed={false}
          onItemClick={handleClick}
          currentPath={location.pathname}
        />
      </Drawer>
    );
  }

  return (
    <div
      style={{
        width: collapsed ? 64 : 248,
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 100,
        transition: "width 0.2s",
        flexShrink: 0,
      }}
    >
      <SidebarContent
        role={role}
        collapsed={collapsed}
        onItemClick={handleClick}
        currentPath={location.pathname}
      />
      {/* Collapse toggle */}
      <div
        style={{
          position: "absolute",
          bottom: 16,
          right: collapsed ? "50%" : 14,
          transform: collapsed ? "translateX(50%)" : "none",
          transition: "all 0.2s",
        }}
      >
        <button
          onClick={() => onCollapse(!collapsed)}
          title={collapsed ? "Expand" : "Collapse"}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "#3D5AFE",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.15s, transform 0.15s",
            boxShadow: "0 2px 8px rgba(61,90,254,0.35)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#2747F5";
            e.currentTarget.style.transform = "scale(1.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#3D5AFE";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            {collapsed ? (
              <path d="M5 2.5L9.5 7L5 11.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M9 2.5L4.5 7L9 11.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        </button>
      </div>
    </div>
  );
}
