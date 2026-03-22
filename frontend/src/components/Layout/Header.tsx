import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Avatar,
  Badge,
  Button,
  Dropdown,
  Layout,
  List,
  Popover,
  Space,
  Tag,
  Typography,
} from "antd";
import { BellOutlined, LogoutOutlined, MenuOutlined, MoonOutlined, SunOutlined, UserOutlined } from "@ant-design/icons";
import type { Notification, User } from "@/types";
import { ROLE_LABELS } from "@/utils/constants";
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

export default function Header({ user, onLogout, isMobile, onMenuClick }: Props) {
  const navigate = useNavigate();
  const { isDark, toggle: toggleTheme } = useThemeStore();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [bellOpen, setBellOpen] = useState(false);

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
    setBellOpen(open);
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

  const dropdownItems = {
    items: [
      {
        key: "profile",
        icon: <UserOutlined />,
        label: "Profile",
        onClick: () => navigate("/profile"),
      },
      { type: "divider" as const },
      {
        key: "logout",
        icon: <LogoutOutlined />,
        label: "Logout",
        danger: true,
        onClick: onLogout,
      },
    ],
  };

  const bellContent = (
    <div style={{ width: isMobile ? 260 : 320, maxHeight: 400, overflowY: "auto" }}>
      {notifications.length > 0 && unreadCount > 0 && (
        <div style={{ textAlign: "right", marginBottom: 8 }}>
          <a onClick={handleMarkAllRead}>Mark all as read</a>
        </div>
      )}
      <List
        size="small"
        dataSource={notifications.slice(0, 20)}
        locale={{ emptyText: "No notifications" }}
        renderItem={(n) => (
          <List.Item
            style={{
              background: n.is_read ? undefined : (isDark ? "rgba(99,102,241,0.15)" : "#eef2ff"),
              cursor: n.is_read ? "default" : "pointer",
              padding: "8px 12px",
              borderRadius: 6,
              marginBottom: 2,
            }}
            onClick={() => !n.is_read && handleMarkRead(n.id)}
          >
            <List.Item.Meta
              description={
                <>
                  <Text style={{ fontSize: 13 }}>{n.message}</Text>
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
  );

  return (
    <AntHeader
      style={{
        padding: isMobile ? "0 12px" : "0 24px",
        background: isDark ? "#1f2937" : "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
        gap: isMobile ? 8 : 16,
        boxShadow: isDark ? "none" : "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      {/* Left: hamburger on mobile */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {isMobile && (
          <Button
            type="text"
            icon={<MenuOutlined style={{ fontSize: 18 }} />}
            onClick={onMenuClick}
            style={{ color: isDark ? "#c7d2fe" : "#475569" }}
          />
        )}
      </div>

      {/* Right: theme toggle, notifications, role, user */}
      <Space size={isMobile ? 8 : 16}>
        <Button
          type="text"
          icon={isDark ? <SunOutlined /> : <MoonOutlined />}
          onClick={toggleTheme}
          style={{ color: isDark ? "#facc15" : "#475569", fontSize: 18 }}
        />

        <Popover
          content={bellContent}
          title="Notifications"
          trigger="click"
          open={bellOpen}
          onOpenChange={handleBellOpen}
          placement="bottomRight"
        >
          <Badge count={unreadCount} size="small" offset={[-2, 2]}>
            <BellOutlined style={{ fontSize: 18, cursor: "pointer", color: isDark ? "#c7d2fe" : "#475569" }} />
          </Badge>
        </Popover>

        {!isMobile && (
          <Tag
            color={roleColors[user.role]}
            style={{ borderRadius: 6, fontWeight: 500, textTransform: "capitalize" }}
          >
            {ROLE_LABELS[user.role]}
          </Tag>
        )}

        <Dropdown menu={dropdownItems} placement="bottomRight">
          <Space style={{ cursor: "pointer" }}>
            <Avatar
              icon={<UserOutlined />}
              src={user.photo_url}
              size={isMobile ? "small" : "default"}
              style={{ backgroundColor: user.photo_url ? undefined : "#6366f1" }}
            />
            {!isMobile && (
              <Text strong style={{ color: isDark ? "#e2e8f0" : "#1e293b" }}>
                {user.first_name} {user.last_name}
              </Text>
            )}
          </Space>
        </Dropdown>
      </Space>
    </AntHeader>
  );
}
