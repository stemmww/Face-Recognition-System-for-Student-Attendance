import { Avatar, Card, Descriptions, Tag, Typography } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTime } from "@/utils/formatters";

const { Title } = Typography;

const roleColors: Record<string, string> = {
  admin: "red",
  professor: "blue",
  student: "green",
};

export default function Profile() {
  const { user } = useAuth();
  const { t } = useTranslation();

  if (!user) return null;

  return (
    <div style={{ maxWidth: 700 }}>
      <Title level={4}>{t("profilePage.title")}</Title>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 24 }}>
          <Avatar size={80} icon={<UserOutlined />} src={user.photo_url} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {user.first_name} {user.last_name}
            </Title>
            <Tag color={roleColors[user.role]} style={{ marginTop: 8 }}>
              {t(`roles.${user.role}`)}
            </Tag>
          </div>
        </div>
        <Descriptions bordered column={1} size="middle">
          <Descriptions.Item label={t("common.email")}>{user.email}</Descriptions.Item>
          <Descriptions.Item label={t("profilePage.firstName")}>{user.first_name}</Descriptions.Item>
          <Descriptions.Item label={t("profilePage.lastName")}>{user.last_name}</Descriptions.Item>
          <Descriptions.Item label={t("profilePage.role")}>
            <Tag color={roleColors[user.role]}>{t(`roles.${user.role}`)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t("common.status")}>
            <Tag color={user.is_active ? "green" : "default"}>
              {user.is_active ? t("common.active") : t("common.inactive")}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t("profilePage.accountCreated")}>
            {formatDateTime(user.created_at)}
          </Descriptions.Item>
        </Descriptions>
        {user.role === "student" && (
          <div style={{ marginTop: 16, color: "#888", fontSize: 13 }}>
            {t("profilePage.contactAdmin")}
          </div>
        )}
      </Card>
    </div>
  );
}
