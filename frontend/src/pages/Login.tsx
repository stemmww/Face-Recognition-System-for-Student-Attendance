import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button, Checkbox, Dropdown, Form, Input, Modal, Tooltip, Typography, message } from "antd";
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

const { Title, Text } = Typography;

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

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
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

  /* ── colour helpers ── */
  const panelBg = isDark ? "rgb(12, 12, 12)" : "#ffffff";
  const formBg = isDark ? "rgb(12, 12, 12)" : "#f8fafc";
  const cardBg = isDark ? "rgb(33, 33, 33)" : "#ffffff";
  const borderCol = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const toolbarBg = isDark ? "rgba(31,41,55,0.85)" : "rgba(255,255,255,0.85)";
  const toolbarIcon = isDark ? colors.primary : "#64748b";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        minHeight: "100vh",
        position: "relative",
      }}
    >
      {/* ═══ Floating toolbar (lang + theme toggle) ═══ */}
      <div
        style={{
          position: "fixed",
          top: isMobile ? 8 : 16,
          right: isMobile ? 8 : 24,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          gap: 4,
          background: toolbarBg,
          backdropFilter: "blur(12px)",
          borderRadius: 12,
          padding: "4px 6px",
          boxShadow: isDark
            ? "0 2px 12px rgba(0,0,0,0.3)"
            : "0 2px 12px rgba(0,0,0,0.08)",
          border: `1px solid ${borderCol}`,
          transition: "all 0.3s ease",
        }}
      >
        <Dropdown menu={langItems} placement="bottomRight" trigger={["click"]}>
          <Button
            type="text"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: 8,
              fontSize: 16,
              color: toolbarIcon,
            }}
          >
            <GlobalOutlined />
          </Button>
        </Dropdown>
        <Tooltip title={isDark ? t("common.lightMode") : t("common.darkMode")} mouseEnterDelay={0.4}>
          <Button
            type="text"
            onClick={toggleTheme}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: 8,
              fontSize: 16,
              color: isDark ? "#facc15" : "#64748b",
            }}
          >
            {isDark ? <SunOutlined /> : <MoonOutlined />}
          </Button>
        </Tooltip>
      </div>

      {/* ═══ LEFT PANEL — Branding / Illustration ═══ */}
      {!isMobile && (
        <div
          style={{
            flex: "0 0 100%",
            background: panelBg,
            position: "relative",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            transition: "background 0.4s ease",
          }}
        >
          <img
            src="/assets/login-attendance-hero.png"
            alt=""
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              zIndex: 0,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              background: isDark
                ? "linear-gradient(90deg, rgba(12,12,12,0.76), rgba(12,12,12,0.3), rgba(12,12,12,0.64))"
                : "linear-gradient(90deg, rgba(15,23,42,0.62), rgba(15,23,42,0.18), rgba(248,250,252,0.62))",
              zIndex: 1,
            }}
          />
          {/* Logo / brand area */}
          <div style={{ padding: "36px 40px", position: "relative", zIndex: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: colors.primary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ScanOutlined style={{ fontSize: 20, color: "#fff" }} />
              </div>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 18,
                  color: "#fff",
                }}
              >
                {t("login.title")}
              </span>
            </div>
          </div>

          {/* Decorative geometric triangle (bottom-left) */}
          <div
            style={{
              position: "absolute",
              bottom: -60,
              left: -60,
              width: 420,
              height: 420,
              background: `linear-gradient(135deg, ${colors.primary}22 0%, ${colors.primary}08 100%)`,
              clipPath: "polygon(0 100%, 0 20%, 80% 100%)",
              zIndex: 0,
              display: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -30,
              left: -30,
              width: 320,
              height: 320,
              background: `linear-gradient(135deg, ${colors.primary}18 0%, ${colors.primary}05 100%)`,
              clipPath: "polygon(0 100%, 0 30%, 70% 100%)",
              zIndex: 0,
              display: "none",
            }}
          />

          {/* Small decorative dots pattern (top-right area) */}
          <div
            style={{
              position: "absolute",
              top: 100,
              right: 60,
              display: "none",
              gridTemplateColumns: "repeat(5, 8px)",
              gap: 12,
              opacity: isDark ? 0.15 : 0.2,
              zIndex: 0,
            }}
          >
            {Array.from({ length: 15 }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: colors.primary,
                }}
              />
            ))}
          </div>

          {/* Centre illustration area */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: "50%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
              padding: "0 40px",
            }}
          >
            {/* Icon circle */}
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: "50%",
                background: `${colors.primary}14`,
                border: `2px solid ${colors.primary}30`,
                display: "none",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 32,
              }}
            >
              <ScanOutlined style={{ fontSize: 42, color: colors.primary }} />
            </div>

            <Title
              level={3}
              style={{
                color: "#fff",
                marginBottom: 8,
                fontWeight: 700,
                textAlign: "center",
              }}
            >
              {t("login.subtitle")}
            </Title>
            <Text
              style={{
                color: "rgba(255,255,255,0.78)",
                fontSize: 15,
                textAlign: "center",
                maxWidth: 340,
                lineHeight: 1.6,
              }}
            >
              {t("login.description")}
            </Text>

            <div
              style={{
                display: "none",
                gap: 12,
                marginTop: 36,
              }}
            >
              {([] as Array<{ value: string; label: string }>).map((item) => (
                <div
                  key={item.value}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 20,
                    background: `${colors.primary}0D`,
                    border: `1px solid ${colors.primary}20`,
                    fontSize: 12,
                    fontWeight: 600,
                    color: colors.primary,
                    letterSpacing: 0.3,
                  }}
                >
                  {item.value} · {item.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ RIGHT PANEL — Login Form ═══ */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: isMobile ? formBg : "transparent",
          marginLeft: isMobile ? 0 : "-42%",
          transition: "background 0.4s ease",
          padding: isMobile ? "80px 24px 32px" : "48px 24px",
          position: "relative",
          zIndex: 3,
        }}
      >
        <div style={{ width: "100%", maxWidth: 420 }}>
          {/* Mobile logo */}
          {isMobile && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 32,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9,
                  background: colors.primary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ScanOutlined style={{ fontSize: 18, color: "#fff" }} />
              </div>
              <span style={{ fontWeight: 700, fontSize: 16, color: colors.heading }}>
                {t("login.title")}
              </span>
            </div>
          )}

          {/* Card wrapper */}
          <div
            style={{
              background: cardBg,
              borderRadius: 16,
              padding: isMobile ? "28px 24px" : "40px 36px",
              boxShadow: isDark
                ? "0 18px 50px rgba(0,0,0,0.38)"
                : "0 18px 50px rgba(15,23,42,0.16)",
              border: `1px solid ${borderCol}`,
              transition: "all 0.4s ease",
            }}
          >
            <div style={{ marginBottom: 28 }}>
              <Title
                level={3}
                style={{
                  marginBottom: 4,
                  color: colors.heading,
                  fontWeight: 700,
                  fontSize: 28,
                }}
              >
                {t("login.signIn")}
              </Title>
              <Text style={{ color: colors.subtitle, fontSize: 15 }}>
                {t("login.signInSubtitle")}
              </Text>
            </div>

            <Form
              onFinish={onFinish}
              layout="vertical"
              size="large"
              requiredMark={false}
            >
              <Form.Item
                name="email"
                label={
                  <span style={{ ...authPageStyles.formLabel(isDark), fontSize: 15 }}>
                    {t("login.emailLabel")}
                  </span>
                }
                rules={[
                  { required: true, message: t("login.emailRequired") },
                  { type: "email", message: t("login.emailInvalid") },
                ]}
                style={{ marginBottom: 16 }}
              >
                <Input
                  className="auth-input"
                  prefix={<MailOutlined style={{ color: colors.inputIcon }} />}
                  placeholder={t("login.emailPlaceholder")}
                  style={{
                    ...authPageStyles.input,
                    borderColor: colors.inputBorder,
                    fontSize: 15,
                  }}
                />
              </Form.Item>

              <Form.Item
                name="password"
                label={
                  <span style={{ ...authPageStyles.formLabel(isDark), fontSize: 15 }}>
                    {t("login.passwordLabel")}
                  </span>
                }
                rules={[{ required: true, message: t("login.passwordRequired") }]}
                style={{ marginBottom: 12 }}
              >
                <Input.Password
                  className="auth-input"
                  prefix={<LockOutlined style={{ color: colors.inputIcon }} />}
                  placeholder={t("login.passwordPlaceholder")}
                  style={{
                    ...authPageStyles.input,
                    borderColor: colors.inputBorder,
                    fontSize: 15,
                  }}
                />
              </Form.Item>

              {/* Remember me + Forgot password row */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 24,
                }}
              >
                <Checkbox>
                  <span
                    style={{
                      fontSize: 14,
                      color: colors.subtitle,
                    }}
                  >
                    {t("login.rememberMe")}
                  </span>
                </Checkbox>
                <Button
                  type="link"
                  style={{
                    padding: 0,
                    fontSize: 14,
                    color: colors.primary,
                    fontWeight: 500,
                  }}
                  onClick={() => setForgotOpen(true)}
                >
                  {t("login.forgotPassword")}
                </Button>
              </div>

              <Form.Item style={{ marginBottom: 0 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  style={{
                    ...authPageStyles.primaryButton,
                    background: colors.primary,
                    borderColor: colors.primary,
                  }}
                >
                  {t("login.signIn")}
                </Button>
              </Form.Item>
            </Form>

            <div
              style={{
                textAlign: "center",
                marginTop: 24,
                paddingTop: 20,
                borderTop: `1px solid ${colors.divider}`,
              }}
            >
              <Text style={{ color: colors.inputIcon, fontSize: 13 }}>
                {t("login.contactAdmin")}
              </Text>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Forgot Password Modal ═══ */}
      <Modal
        open={forgotOpen}
        title={t("login.forgotPasswordTitle")}
        onCancel={() => {
          setForgotOpen(false);
          forgotForm.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Text style={{ display: "block", marginBottom: 16, color: colors.subtitle }}>
          {t("login.forgotDescription")}
        </Text>
        <Form
          form={forgotForm}
          onFinish={onForgotSubmit}
          layout="vertical"
          requiredMark={false}
        >
          <Form.Item
            name="email"
            label={t("login.emailLabel")}
            rules={[
              { required: true, message: t("login.emailRequired") },
              { type: "email", message: t("login.emailInvalid") },
            ]}
          >
            <Input
              className="auth-input"
              prefix={<MailOutlined style={{ color: colors.inputIcon }} />}
              placeholder={t("login.emailPlaceholder")}
              style={authPageStyles.input}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={forgotLoading}
              block
              style={{
                ...authPageStyles.primaryButton,
                background: colors.primary,
                borderColor: colors.primary,
              }}
            >
              {t("login.sendResetLink")}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
