import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Empty,
  List,
  Tag,
  Typography,
  message,
} from "antd";
import { CheckOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import type { Notification } from "@/types";
import { listNotifications, markRead, markAllRead } from "@/api/notifications";
import { useThemeStore } from "@/stores/themeStore";

const { Title, Text } = Typography;

export default function NotificationsPage() {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const isDark = useThemeStore((s) => s.isDark);

  const fetchData = useCallback(async () => {
    try {
      setNotifications(await listNotifications());
    } catch {
      message.error(t("notifications.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleMarkRead = async (id: number) => {
    await markRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    message.success(t("notifications.allRead"));
  };

  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          {t("notifications.title")} {unread > 0 && <Tag color="red">{t("notifications.unread", { count: unread })}</Tag>}
        </Title>
        {unread > 0 && (
          <Button icon={<CheckOutlined />} onClick={handleMarkAllRead}>
            {t("notifications.markAllRead")}
          </Button>
        )}
      </div>

      <List
        loading={loading}
        dataSource={notifications}
        locale={{ emptyText: <Empty description={t("notifications.noNotifications")} /> }}
        renderItem={(n) => (
          <List.Item
            style={{
              background: n.is_read
                ? (isDark ? "transparent" : "#fff")
                : (isDark ? "rgba(35,35,206,0.15)" : "#f0f5ff"),
              padding: "12px 16px",
              borderRadius: 6,
              marginBottom: 4,
            }}
            actions={
              !n.is_read
                ? [
                    <Button size="small" type="link" onClick={() => handleMarkRead(n.id)}>
                      {t("notifications.markRead")}
                    </Button>,
                  ]
                : undefined
            }
          >
            <List.Item.Meta
              title={<Text strong={!n.is_read}>{n.message}</Text>}
              description={dayjs(n.created_at).format("YYYY-MM-DD HH:mm")}
            />
          </List.Item>
        )}
      />
    </>
  );
}
