import { Avatar, Card, Descriptions, Tag, Typography } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/utils/constants";
import { formatDateTime } from "@/utils/formatters";

const { Title } = Typography;

const roleColors: Record<string, string> = {
  admin: "red",
  professor: "blue",
  student: "green",
};

export default function Profile() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div style={{ maxWidth: 700 }}>
      <Title level={4}>My Profile</Title>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 24 }}>
          <Avatar size={80} icon={<UserOutlined />} src={user.photo_url} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {user.first_name} {user.last_name}
            </Title>
            <Tag color={roleColors[user.role]} style={{ marginTop: 8 }}>
              {ROLE_LABELS[user.role]}
            </Tag>
          </div>
        </div>
        <Descriptions bordered column={1} size="middle">
          <Descriptions.Item label="Email">{user.email}</Descriptions.Item>
          <Descriptions.Item label="First Name">{user.first_name}</Descriptions.Item>
          <Descriptions.Item label="Last Name">{user.last_name}</Descriptions.Item>
          <Descriptions.Item label="Role">
            <Tag color={roleColors[user.role]}>{ROLE_LABELS[user.role]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={user.is_active ? "green" : "default"}>
              {user.is_active ? "Active" : "Inactive"}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Account Created">
            {formatDateTime(user.created_at)}
          </Descriptions.Item>
        </Descriptions>
        {user.role === "student" && (
          <div style={{ marginTop: 16, color: "#888", fontSize: 13 }}>
            Contact your administrator to update your profile information or photo.
          </div>
        )}
      </Card>
    </div>
  );
}
