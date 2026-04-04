import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button, Dropdown, Form, Input, Modal, Tooltip, Typography, message } from "antd";
import {
  GlobalOutlined,
  LockOutlined,
  MailOutlined,
  MoonOutlined,
  ScanOutlined,
  SunOutlined,
} from "@ant-design/icons";
import { forgotPassword } from "@/api/auth";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useThemeStore } from "@/stores/themeStore";
import { authPageStyles, themeColors } from "@/styles/theme";

const { Title, Text, Paragraph } = Typography;

const LANGS = [
  { key: "en", label: "English" },
  { key: "kk", label: "Қазақша" },
  { key: "ru", label: "Русский" },
] as const;

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotForm] = Form.useForm();
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { isDark, toggle: toggleTheme } = useThemeStore();
  const { t, i18n } = useTranslation();
  const colors = themeColors(isDark);

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem("language", lang);
  };

  const langItems = {
    items: LANGS.map((l) => ({
      key: l.key,
      label: l.label,
      onClick: () => changeLanguage(l.key),
      style: i18n.language === l.key
        ? { fontWeight: 600, color: colors.primary }
        : undefined,
    })),
  };

  const toolbarBtnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: 8,
    fontSize: 16,
    color: isDark ? "#c7d2fe" : "#64748b",
    transition: "all 0.2s",
  };

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

  const onForgotSubmit = async (values: { email: string }) => {
    setForgotLoading(true);
    try {
      await forgotPassword(values.email);
      message.success(t("login.forgotSent"));
      setForgotOpen(false);
      forgotForm.resetFields();
    } catch {
      message.error(t("login.forgotFailed"));
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: "100vh", position: "relative" }}>
      {/* Floating toolbar: language + theme */}
      <div
        style={{
          position: "fixed",
          top: isMobile ? 8 : 16,
          right: isMobile ? 8 : 24,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          gap: 4,
          background: isDark ? "rgba(31,41,55,0.85)" : "rgba(255,255,255,0.85)",
          backdropFilter: "blur(12px)",
          borderRadius: 12,
          padding: "4px 6px",
          boxShadow: isDark
            ? "0 2px 12px rgba(0,0,0,0.3)"
            : "0 2px 12px rgba(0,0,0,0.08)",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
          transition: "all 0.3s ease",
        }}
      >
        <Dropdown menu={langItems} placement="bottomRight" trigger={["click"]}>
          <Button type="text" style={toolbarBtnStyle}>
            <GlobalOutlined />
          </Button>
        </Dropdown>
        <Tooltip title={isDark ? "Light mode" : "Dark mode"} mouseEnterDelay={0.4}>
          <Button
            type="text"
            onClick={toggleTheme}
            style={{
              ...toolbarBtnStyle,
              color: isDark ? "#facc15" : "#64748b",
            }}
          >
            {isDark ? <SunOutlined /> : <MoonOutlined />}
          </Button>
        </Tooltip>
      </div>

      {/* Left branding panel — full on desktop, compact banner on mobile */}
      <div
        style={{
          ...(isMobile
            ? { padding: "32px 24px 24px" }
            : {
                flex: "0 0 480px",
                padding: "48px 40px",
              }),
          background: isDark
            ? "linear-gradient(160deg, #1e1b4b 0%, #312e81 50%, #3730a3 100%)"
            : "linear-gradient(160deg, #312e81 0%, #4f46e5 50%, #6366f1 100%)",
          transition: "background 0.4s ease",
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
          background: colors.pageBg,
          transition: "background 0.4s ease",
          padding: isMobile ? "32px 20px" : "48px 24px",
        }}
      >
        <div style={authPageStyles.formCard}>
          <div style={{ marginBottom: isMobile ? 20 : 24 }}>
            <Title level={3} style={{ marginBottom: 4, color: colors.heading }}>
              {t("login.welcomeBack")}
            </Title>
            <Text style={{ color: colors.subtitle, fontSize: 14 }}>
              {t("login.signInSubtitle")}
            </Text>
          </div>

          <Form onFinish={onFinish} layout="vertical" size="large" requiredMark={false}>
            <Form.Item
              name="email"
              label={<span style={authPageStyles.formLabel(isDark)}>{t("login.emailLabel")}</span>}
              rules={[
                { required: true, message: t("login.emailRequired") },
                { type: "email", message: t("login.emailInvalid") },
              ]}
              style={{ marginBottom: 16 }}
            >
              <Input
                prefix={<MailOutlined style={{ color: colors.inputIcon }} />}
                placeholder={t("login.emailPlaceholder")}
                style={{ ...authPageStyles.input, borderColor: colors.inputBorder }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={<span style={authPageStyles.formLabel(isDark)}>{t("login.passwordLabel")}</span>}
              rules={[{ required: true, message: t("login.passwordRequired") }]}
              style={{ marginBottom: 8 }}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: colors.inputIcon }} />}
                placeholder={t("login.passwordPlaceholder")}
                style={{ ...authPageStyles.input, borderColor: colors.inputBorder }}
              />
            </Form.Item>

            <div style={{ textAlign: "right", marginBottom: 16 }}>
              <Button type="link" style={{ padding: 0, fontSize: 13, color: colors.primary }} onClick={() => setForgotOpen(true)}>
                {t("login.forgotPassword")}
              </Button>
            </div>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                style={authPageStyles.primaryButton}
              >
                {t("login.signIn")}
              </Button>
            </Form.Item>
          </Form>

          <div
            style={{
              textAlign: "center",
              marginTop: 24,
              padding: "12px 0",
              borderTop: `1px solid ${colors.divider}`,
            }}
          >
            <Text style={{ color: colors.inputIcon, fontSize: 13 }}>
              {t("login.contactAdmin")}
            </Text>
          </div>
        </div>
      </div>

      <Modal
        open={forgotOpen}
        title={t("login.forgotPasswordTitle")}
        onCancel={() => { setForgotOpen(false); forgotForm.resetFields(); }}
        footer={null}
        destroyOnClose
      >
        <Text style={{ display: "block", marginBottom: 16, color: colors.subtitle }}>
          {t("login.forgotDescription")}
        </Text>
        <Form form={forgotForm} onFinish={onForgotSubmit} layout="vertical" requiredMark={false}>
          <Form.Item
            name="email"
            label={t("login.emailLabel")}
            rules={[
              { required: true, message: t("login.emailRequired") },
              { type: "email", message: t("login.emailInvalid") },
            ]}
          >
            <Input
              prefix={<MailOutlined style={{ color: colors.inputIcon }} />}
              placeholder={t("login.emailPlaceholder")}
              style={authPageStyles.input}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={forgotLoading} block style={authPageStyles.input}>
              {t("login.sendResetLink")}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
