import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Avatar,
  Badge,
  Button,
  Dropdown,
  Layout,
  List,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  BellOutlined,
  CheckOutlined,
  GlobalOutlined,
  LogoutOutlined,
  MenuOutlined,
  MoonOutlined,
  SunOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { Notification, User } from "@/types";
import { getUnreadCount, listNotifications, markRead, markAllRead } from "@/api/notifications";
import { useThemeStore } from "@/stores/themeStore";

const { Header: AntHeader } = Layout;
const { Text } = Typography;

interface Props {
  user: User;
  onLogout: () => void;
  isMobile: boolean;
  onMenuClick: () => void;
}

const roleColors: Record<string, string> = {
  admin: "purple",
  professor: "geekblue",
  student: "cyan",
};

const LANGS = [
  { key: "en", label: "English" },
  { key: "kk", label: "Қазақша" },
  { key: "ru", label: "Русский" },
] as const;

const iconBtnStyle = (isDark: boolean): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 36,
  height: 36,
  borderRadius: 8,
  fontSize: 17,
  color: isDark ? "#c7d2fe" : "#475569",
  transition: "all 0.2s",
});

export default function Header({ user, onLogout, isMobile, onMenuClick }: Props) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { isDark, toggle: toggleTheme } = useThemeStore();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem("language", lang);
  };

  const fetchUnread = useCallback(async () => {
    try {
      setUnreadCount(await getUnreadCount());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  const handleBellOpen = async (open: boolean) => {
    if (open) {
      try {
        setNotifications(await listNotifications());
      } catch {
        /* ignore */
      }
    }
  };

  const handleMarkRead = async (id: number) => {
    try {
      await markRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      /* ignore */
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      /* ignore */
    }
  };

  const langItems = {
    items: LANGS.map((l) => ({
      key: l.key,
      label: l.label,
      onClick: () => changeLanguage(l.key),
      style: i18n.language === l.key
        ? { fontWeight: 600, color: "#6366f1" }
        : undefined,
    })),
  };

  const userItems = {
    items: [
      {
        key: "profile",
        icon: <UserOutlined />,
        label: t("common.profile"),
        onClick: () => navigate("/profile"),
      },
      { type: "divider" as const },
      {
        key: "logout",
        icon: <LogoutOutlined />,
        label: t("common.logout"),
        danger: true,
        onClick: onLogout,
      },
    ],
  };

  const bellDropdown = {
    items: [
      ...(notifications.length > 0 && unreadCount > 0
        ? [{
            key: "mark-all",
            style: { padding: 0, cursor: "default", background: "transparent" },
            className: "no-hover-highlight",
            label: (
              <div style={{
                textAlign: "center",
                padding: "6px 0 2px",
                marginBottom: 4,
                borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
              }}>
                <Button
                  type="link"
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={handleMarkAllRead}
                  className="mark-all-read-btn"
                  style={{
                    color: isDark ? "#818cf8" : "#6366f1",
                    fontWeight: 500,
                  }}
                >
                  {t("header.markAllRead")}
                </Button>
              </div>
            ),
          }]
        : []),
      {
        key: "list",
        style: { padding: 0, cursor: "default", background: "transparent" },
        className: "no-hover-highlight",
        label: (
          <div className="notification-scroll" style={{ width: isMobile ? 260 : 340, maxHeight: 380, overflowY: "auto" as const }}>
            <List
              size="small"
              dataSource={notifications.slice(0, 20)}
              locale={{ emptyText: t("header.noNotifications") }}
              renderItem={(n) => (
                <List.Item
                  className="notification-item"
                  style={{
                    background: n.is_read
                      ? "transparent"
                      : isDark ? "rgba(99,102,241,0.12)" : "#f0f0ff",
                    cursor: "pointer",
                    padding: "10px 12px",
                    borderRadius: 8,
                    marginBottom: 4,
                    transition: "background 0.2s",
                  }}
                  onClick={(e) => {
                    if (!n.is_read) {
                      e.stopPropagation();
                      handleMarkRead(n.id);
                    }
                  }}
                >
                  <List.Item.Meta
                    description={
                      <>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: n.is_read ? 400 : 500,
                            color: isDark ? "#e2e8f0" : "#1e293b",
                          }}
                        >
                          {n.message}
                        </Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {new Date(n.created_at).toLocaleString()}
                        </Text>
                      </>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        ),
      },
    ],
  };

  return (
    <AntHeader
      style={{
        padding: isMobile ? "0 12px" : "0 24px",
        background: isDark ? "#1f2937" : "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
        boxShadow: isDark ? "none" : "0 1px 3px rgba(0,0,0,0.04)",
        height: 56,
        lineHeight: "56px",
      }}
    >
      {/* Left: hamburger on mobile */}
      <div style={{ display: "flex", alignItems: "center" }}>
        {isMobile && (
          <Button
            type="text"
            icon={<MenuOutlined style={{ fontSize: 18 }} />}
            onClick={onMenuClick}
            style={{ color: isDark ? "#c7d2fe" : "#475569" }}
          />
        )}
      </div>

      {/* Right: actions */}
      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 4 : 8 }}>
        {/* Language */}
        <Dropdown menu={langItems} placement="bottomRight" trigger={["click"]}>
          <Button type="text" style={iconBtnStyle(isDark)}>
            <GlobalOutlined />
          </Button>
        </Dropdown>

        {/* Theme */}
        <Tooltip title={isDark ? "Light mode" : "Dark mode"} mouseEnterDelay={0.4}>
          <Button type="text" onClick={toggleTheme} style={{
            ...iconBtnStyle(isDark),
            color: isDark ? "#facc15" : "#475569",
          }}>
            {isDark ? <SunOutlined /> : <MoonOutlined />}
          </Button>
        </Tooltip>

        {/* Notifications */}
        <Dropdown
          menu={bellDropdown}
          placement="bottomRight"
          trigger={["click"]}
          onOpenChange={handleBellOpen}
          overlayStyle={{ minWidth: isMobile ? 280 : 360 }}
          overlayClassName="notification-dropdown"
        >
          <Button type="text" style={iconBtnStyle(isDark)}>
            <Badge count={unreadCount} size="small" offset={[4, -4]}>
              <BellOutlined style={{ fontSize: 17, color: isDark ? "#c7d2fe" : "#475569" }} />
            </Badge>
          </Button>
        </Dropdown>

        {/* Divider */}
        <div
          style={{
            width: 1,
            height: 24,
            background: isDark ? "#374151" : "#e2e8f0",
            margin: isMobile ? "0 2px" : "0 6px",
          }}
        />

        {/* Role tag */}
        {!isMobile && (
          <Tag
            color={roleColors[user.role]}
            style={{ borderRadius: 6, fontWeight: 500, textTransform: "capitalize", margin: 0 }}
          >
            {t(`roles.${user.role}`)}
          </Tag>
        )}

        {/* User dropdown */}
        <Dropdown menu={userItems} placement="bottomRight" trigger={["click"]}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: 8,
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <Avatar
              icon={<UserOutlined />}
              src={user.photo_url}
              size={isMobile ? "small" : "default"}
              style={{ backgroundColor: user.photo_url ? undefined : "#6366f1" }}
            />
            {!isMobile && (
              <Text strong style={{ color: isDark ? "#e2e8f0" : "#1e293b", whiteSpace: "nowrap" }}>
                {user.first_name} {user.last_name}
              </Text>
            )}
          </div>
        </Dropdown>
      </div>
    </AntHeader>
  );
}
