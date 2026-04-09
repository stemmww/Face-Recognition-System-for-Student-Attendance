import { useRef, useState } from "react";
import { Avatar, Button, Card, Descriptions, Form, Input, Tag, Typography, message, Spin } from "antd";
import { CameraOutlined, DeleteOutlined, LockOutlined, UserOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { changePassword, uploadProfilePhoto, deleteProfilePhoto } from "@/api/users";
import { formatDateTime } from "@/utils/formatters";

const { Title } = Typography;

const roleColors: Record<string, string> = {
  admin: "red",
  professor: "blue",
  student: "green",
};

export default function Profile() {
  const { user, fetchUser } = useAuth();
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const photoSrc = user.photo_url ? `/uploads/${user.photo_url}` : undefined;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      message.error(t("profilePage.photoInvalidType"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      message.error(t("profilePage.photoTooLarge"));
      return;
    }

    setPhotoLoading(true);
    try {
      await uploadProfilePhoto(file);
      await fetchUser();
      message.success(t("profilePage.photoUploaded"));
    } catch {
      message.error(t("profilePage.photoUploadFailed"));
    } finally {
      setPhotoLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePhotoDelete = async () => {
    setPhotoLoading(true);
    try {
      await deleteProfilePhoto();
      await fetchUser();
      message.success(t("profilePage.photoRemoved"));
    } catch {
      message.error(t("profilePage.photoRemoveFailed"));
    } finally {
      setPhotoLoading(false);
    }
  };

  const onChangePassword = async (values: { oldPassword: string; newPassword: string }) => {
    setLoading(true);
    try {
      await changePassword(values.oldPassword, values.newPassword);
      message.success(t("profilePage.passwordChanged"));
      form.resetFields();
    } catch {
      message.error(t("profilePage.passwordChangeFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <Title level={4}>{t("profilePage.title")}</Title>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 24 }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            <Spin spinning={photoLoading}>
              <Avatar size={80} icon={<UserOutlined />} src={photoSrc} />
            </Spin>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: "none" }}
              onChange={handlePhotoUpload}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              title={t("profilePage.changePhoto")}
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "#2323CE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                border: "2px solid #fff",
                boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
              }}
            >
              <CameraOutlined style={{ color: "#fff", fontSize: 14 }} />
            </div>
          </div>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {user.first_name} {user.last_name}
            </Title>
            <Tag color={roleColors[user.role]} style={{ marginTop: 8 }}>
              {t(`roles.${user.role}`)}
            </Tag>
            {user.photo_url && (
              <Button
                type="link"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={handlePhotoDelete}
                style={{ marginTop: 4, padding: 0 }}
              >
                {t("profilePage.removePhoto")}
              </Button>
            )}
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
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Title level={5} style={{ marginBottom: 16 }}>
          <LockOutlined style={{ marginRight: 8 }} />
          {t("profilePage.changePassword")}
        </Title>
        <Form
          form={form}
          layout="vertical"
          onFinish={onChangePassword}
          requiredMark={false}
          style={{ maxWidth: 400 }}
        >
          <Form.Item
            name="oldPassword"
            label={t("profilePage.currentPassword")}
            rules={[{ required: true, message: t("profilePage.currentPasswordRequired") }]}
          >
            <Input.Password placeholder={t("profilePage.currentPasswordPlaceholder")} />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label={t("profilePage.newPassword")}
            rules={[
              { required: true, message: t("profilePage.newPasswordRequired") },
              { min: 6, message: t("profilePage.passwordMinLength") },
            ]}
          >
            <Input.Password placeholder={t("profilePage.newPasswordPlaceholder")} />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label={t("profilePage.confirmPassword")}
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: t("profilePage.confirmPasswordRequired") },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) return Promise.resolve();
                  return Promise.reject(new Error(t("profilePage.passwordMismatch")));
                },
              }),
            ]}
          >
            <Input.Password placeholder={t("profilePage.confirmPasswordPlaceholder")} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={loading}>
              {t("profilePage.updatePassword")}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
