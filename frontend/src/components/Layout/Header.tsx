import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Avatar,
  Badge,
  Dropdown,
  Layout,
  List,
  Popover,
  Space,
  Tag,
  Typography,
} from "antd";
import { BellOutlined, LogoutOutlined, UserOutlined } from "@ant-design/icons";
import type { Notification, User } from "@/types";
import { ROLE_LABELS } from "@/utils/constants";
import { getUnreadCount, listNotifications, markRead, markAllRead } from "@/api/notifications";

const { Header: AntHeader } = Layout;
const { Text } = Typography;

interface Props {
  user: User;
  onLogout: () => void;
}

const roleColors: Record<string, string> = {
  admin: "red",
  professor: "blue",
  student: "green",
};

export default function Header({ user, onLogout }: Props) {
  const navigate = useNavigate();
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
    <div style={{ width: 320, maxHeight: 400, overflowY: "auto" }}>
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
              background: n.is_read ? undefined : "#f0f5ff",
              cursor: n.is_read ? "default" : "pointer",
              padding: "8px 12px",
              borderRadius: 4,
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
        padding: "0 24px",
        background: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        borderBottom: "1px solid #f0f0f0",
        gap: 16,
      }}
    >
      <Popover
        content={bellContent}
        title="Notifications"
        trigger="click"
        open={bellOpen}
        onOpenChange={handleBellOpen}
        placement="bottomRight"
      >
        <Badge count={unreadCount} size="small" offset={[-2, 2]}>
          <BellOutlined style={{ fontSize: 18, cursor: "pointer" }} />
        </Badge>
      </Popover>

      <Tag color={roleColors[user.role]}>{ROLE_LABELS[user.role]}</Tag>
      <Dropdown menu={dropdownItems} placement="bottomRight">
        <Space style={{ cursor: "pointer" }}>
          <Avatar icon={<UserOutlined />} src={user.photo_url} />
          <Text strong>
            {user.first_name} {user.last_name}
          </Text>
        </Space>
      </Dropdown>
    </AntHeader>
  );
}
