import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Form, Input, Typography, message } from "antd";
import {
  LockOutlined,
  MailOutlined,
  ScanOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/useIsMobile";

const { Title, Text, Paragraph } = Typography;

export default function Login() {
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  if (isAuthenticated) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.email, values.password);
      message.success("Login successful");
      navigate("/dashboard", { replace: true });
    } catch {
      message.error("Invalid email or password");
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
            Face Attendance
          </Title>
          <Text style={{ color: "#c7d2fe", fontSize: isMobile ? 13 : 16 }}>
            AI-Powered Attendance Tracking
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
                Automated attendance tracking powered by facial recognition technology.
                Students scan a QR code and verify their identity with a quick face scan.
              </Paragraph>
            </div>
          )}

          {/* Feature badges — desktop only */}
          {!isMobile && (
            <div style={{ marginTop: 48, display: "flex", justifyContent: "center", gap: 32 }}>
              {[
                { value: "AI", label: "Face Recognition" },
                { value: "QR", label: "QR Code Auth" },
                { value: "GPS", label: "Location Check" },
              ].map((item) => (
                <div key={item.label} style={{ textAlign: "center" }}>
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
          background: "#f8fafc",
          padding: isMobile ? "32px 20px" : "48px 24px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 400 }}>
          <div style={{ marginBottom: isMobile ? 28 : 40 }}>
            <Title level={3} style={{ marginBottom: 8, color: "#1e293b" }}>
              Welcome back
            </Title>
            <Text style={{ color: "#64748b", fontSize: 15 }}>
              Sign in to your account to continue
            </Text>
          </div>

          <Form onFinish={onFinish} layout="vertical" size="large" requiredMark={false}>
            <Form.Item
              name="email"
              label={<span style={{ fontWeight: 500, color: "#334155" }}>Email</span>}
              rules={[
                { required: true, message: "Please enter your email" },
                { type: "email", message: "Please enter a valid email" },
              ]}
            >
              <Input
                prefix={<MailOutlined style={{ color: "#94a3b8" }} />}
                placeholder="you@university.edu"
                style={{ height: 48, borderRadius: 10, borderColor: "#e2e8f0" }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={<span style={{ fontWeight: 500, color: "#334155" }}>Password</span>}
              rules={[{ required: true, message: "Please enter your password" }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: "#94a3b8" }} />}
                placeholder="Enter your password"
                style={{ height: 48, borderRadius: 10, borderColor: "#e2e8f0" }}
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
                Sign In
              </Button>
            </Form.Item>
          </Form>

          <div
            style={{
              textAlign: "center",
              marginTop: 32,
              padding: "16px 0",
              borderTop: "1px solid #e2e8f0",
            }}
          >
            <Text style={{ color: "#94a3b8", fontSize: 13 }}>
              Contact your administrator for account access
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
}
