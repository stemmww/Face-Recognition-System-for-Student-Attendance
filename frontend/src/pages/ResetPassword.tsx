import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button, Form, Input, Result, Typography, message } from "antd";
import { LockOutlined } from "@ant-design/icons";
import { resetPassword } from "@/api/auth";
import { useThemeStore } from "@/stores/themeStore";
import { authPageStyles, themeColors } from "@/styles/theme";

const { Title, Text } = Typography;

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isDark = useThemeStore((s) => s.isDark);
  const colors = themeColors(isDark);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div style={authPageStyles.centeredPage(isDark)}>
        <Result
          status="error"
          title={t("resetPassword.invalidLink")}
          extra={<Button type="primary" onClick={() => navigate("/login")}>{t("resetPassword.backToLogin")}</Button>}
        />
      </div>
    );
  }

  if (done) {
    return (
      <div style={authPageStyles.centeredPage(isDark)}>
        <Result
          status="success"
          title={t("resetPassword.success")}
          subTitle={t("resetPassword.successSubtitle")}
          extra={<Button type="primary" onClick={() => navigate("/login")}>{t("resetPassword.backToLogin")}</Button>}
        />
      </div>
    );
  }

  const onFinish = async (values: { newPassword: string }) => {
    setLoading(true);
    try {
      await resetPassword(token, values.newPassword);
      setDone(true);
    } catch {
      message.error(t("resetPassword.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ ...authPageStyles.centeredPage(isDark), padding: 24 }}>
      <div style={authPageStyles.formCard}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 16,
          }}>
            <LockOutlined style={{ fontSize: 24, color: "#fff" }} />
          </div>
          <Title level={3} style={{ marginBottom: 4, color: colors.heading }}>
            {t("resetPassword.title")}
          </Title>
          <Text style={{ color: colors.subtitle, fontSize: 14 }}>
            {t("resetPassword.subtitle")}
          </Text>
        </div>

        <Form onFinish={onFinish} layout="vertical" requiredMark={false}>
          <Form.Item
            name="newPassword"
            label={<span style={authPageStyles.formLabel(isDark)}>{t("resetPassword.newPassword")}</span>}
            rules={[
              { required: true, message: t("resetPassword.newPasswordRequired") },
              { min: 6, message: t("profilePage.passwordMinLength") },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: colors.inputIcon }} />}
              placeholder={t("resetPassword.newPasswordPlaceholder")}
              style={authPageStyles.input}
            />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label={<span style={authPageStyles.formLabel(isDark)}>{t("resetPassword.confirmPassword")}</span>}
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: t("resetPassword.confirmPasswordRequired") },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) return Promise.resolve();
                  return Promise.reject(new Error(t("profilePage.passwordMismatch")));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: colors.inputIcon }} />}
              placeholder={t("resetPassword.confirmPasswordPlaceholder")}
              style={authPageStyles.input}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={authPageStyles.primaryButton}
            >
              {t("resetPassword.submit")}
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
