import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button, Form, Input, Typography, message } from "antd";
import {
  LockOutlined,
  MailOutlined,
  ScanOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useThemeStore } from "@/stores/themeStore";

const { Title, Text, Paragraph } = Typography;

export default function Login() {
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isDark = useThemeStore((s) => s.isDark);
  const { t } = useTranslation();

  if (isAuthenticated) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.email, values.password);
      message.success(t("login.loginSuccess"));
      navigate("/dashboard", { replace: true });
    } catch {
      message.error(t("login.loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: "100vh" }}>
      {/* Left branding panel — full on desktop, compact banner on mobile */}
      <div
        style={{
          ...(isMobile
            ? { padding: "32px 24px 24px" }
            : {
                flex: "0 0 480px",
                padding: "48px 40px",
              }),
          background: "linear-gradient(160deg, #312e81 0%, #4f46e5 50%, #6366f1 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative circles */}
        <div
          style={{
            position: "absolute",
            top: -80,
            left: -80,
            width: 300,
            height: 300,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.05)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -120,
            right: -100,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.04)",
          }}
        />

        <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
          {/* Logo icon */}
          <div
            style={{
              width: isMobile ? 56 : 80,
              height: isMobile ? 56 : 80,
              borderRadius: isMobile ? 14 : 20,
              background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(10px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: `0 auto ${isMobile ? 16 : 32}px`,
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            <ScanOutlined style={{ fontSize: isMobile ? 26 : 36, color: "#e0e7ff" }} />
          </div>

          <Title level={isMobile ? 4 : 2} style={{ color: "#fff", marginBottom: 4, fontWeight: 700 }}>
            {t("login.title")}
          </Title>
          <Text style={{ color: "#c7d2fe", fontSize: isMobile ? 13 : 16 }}>
            {t("login.subtitle")}
          </Text>

          {/* Description box — desktop only */}
          {!isMobile && (
            <div
              style={{
                background: "rgba(255,255,255,0.1)",
                borderRadius: 16,
                padding: "28px 24px",
                marginTop: 32,
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <Paragraph style={{ color: "#e0e7ff", fontSize: 14, lineHeight: 1.8, margin: 0 }}>
                {t("login.description")}
              </Paragraph>
            </div>
          )}

          {/* Feature badges — desktop only */}
          {!isMobile && (
            <div style={{ marginTop: 48, display: "flex", justifyContent: "center", gap: 32 }}>
              {[
                { value: "AI", label: t("login.featureAI") },
                { value: "QR", label: t("login.featureQR") },
                { value: "GPS", label: t("login.featureGPS") },
              ].map((item) => (
                <div key={item.value} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
                    {item.value}
                  </div>
                  <div style={{ color: "#a5b4fc", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right form panel */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: isDark ? "#1f2937" : "#f8fafc",
          padding: isMobile ? "32px 20px" : "48px 24px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 400 }}>
          <div style={{ marginBottom: isMobile ? 28 : 40 }}>
            <Title level={3} style={{ marginBottom: 8, color: isDark ? "#e2e8f0" : "#1e293b" }}>
              {t("login.welcomeBack")}
            </Title>
            <Text style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: 15 }}>
              {t("login.signInSubtitle")}
            </Text>
          </div>

          <Form onFinish={onFinish} layout="vertical" size="large" requiredMark={false}>
            <Form.Item
              name="email"
              label={<span style={{ fontWeight: 500, color: isDark ? "#cbd5e1" : "#334155" }}>{t("login.emailLabel")}</span>}
              rules={[
                { required: true, message: t("login.emailRequired") },
                { type: "email", message: t("login.emailInvalid") },
              ]}
            >
              <Input
                prefix={<MailOutlined style={{ color: "#94a3b8" }} />}
                placeholder={t("login.emailPlaceholder")}
                style={{ height: 48, borderRadius: 10, borderColor: isDark ? "#334155" : "#e2e8f0" }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={<span style={{ fontWeight: 500, color: isDark ? "#cbd5e1" : "#334155" }}>{t("login.passwordLabel")}</span>}
              rules={[{ required: true, message: t("login.passwordRequired") }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: "#94a3b8" }} />}
                placeholder={t("login.passwordPlaceholder")}
                style={{ height: 48, borderRadius: 10, borderColor: isDark ? "#334155" : "#e2e8f0" }}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                style={{
                  height: 48,
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: 15,
                  boxShadow: "0 4px 14px rgba(99,102,241,0.35)",
                }}
              >
                {t("login.signIn")}
              </Button>
            </Form.Item>
          </Form>

          <div
            style={{
              textAlign: "center",
              marginTop: 32,
              padding: "16px 0",
              borderTop: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
            }}
          >
            <Text style={{ color: "#94a3b8", fontSize: 13 }}>
              {t("login.contactAdmin")}
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
}
