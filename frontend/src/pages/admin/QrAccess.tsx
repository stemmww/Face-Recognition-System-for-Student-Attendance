import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button, Input, Space, Typography, Tooltip, message } from "antd";
import {
  QrcodeOutlined,
  CopyOutlined,
  FullscreenOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import PageHeader from "@/components/dashboard/PageHeader";
import Panel from "@/components/dashboard/Panel";

const { Text } = Typography;

export default function QrAccess() {
  const { t } = useTranslation();

  // Auto-fill with the current site origin
  const [url, setUrl] = useState(() => window.location.origin);
  const [fullscreen, setFullscreen] = useState(false);

  const isValid = (() => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  })();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      message.success(t("qrAccess.copied"));
    } catch {
      message.error(t("qrAccess.copyFailed"));
    }
  };

  const handleReset = () => {
    setUrl(window.location.origin);
  };

  if (fullscreen) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          zIndex: 9999,
          cursor: "pointer",
        }}
        onClick={() => setFullscreen(false)}
      >
        <QRCodeSVG
          value={isValid ? url : "https://example.com"}
          size={Math.min(window.innerWidth, window.innerHeight) * 0.65}
          level="H"
          includeMargin
        />
        <Text style={{ fontSize: 18, color: "#555", wordBreak: "break-all", maxWidth: 600, textAlign: "center" }}>
          {url}
        </Text>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {t("qrAccess.clickToClose")}
        </Text>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <QrcodeOutlined />
            {t("qrAccess.title")}
          </span>
        }
        subtitle={t("qrAccess.description")}
      />
      <Panel>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          {/* URL input */}
          <div>
            <Text strong style={{ display: "block", marginBottom: 6 }}>
              {t("qrAccess.urlLabel")}
            </Text>
            <Space.Compact style={{ width: "100%" }}>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://xxxx.ngrok-free.app"
                status={!isValid && url ? "error" : undefined}
                size="large"
              />
              <Tooltip title={t("qrAccess.resetTooltip")}>
                <Button size="large" icon={<ReloadOutlined />} onClick={handleReset} />
              </Tooltip>
              <Tooltip title={t("qrAccess.copyTooltip")}>
                <Button size="large" icon={<CopyOutlined />} onClick={handleCopy} disabled={!isValid} />
              </Tooltip>
            </Space.Compact>
            {!isValid && url && (
              <Text type="danger" style={{ fontSize: 12 }}>
                {t("qrAccess.invalidUrl")}
              </Text>
            )}
          </div>

          {/* QR Code */}
          <div style={{ textAlign: "center" }}>
            {isValid ? (
              <>
                <div
                  style={{
                    display: "inline-block",
                    padding: 16,
                    background: "#fff",
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  }}
                >
                  <QRCodeSVG
                    value={url}
                    size={260}
                    level="H"
                    includeMargin={false}
                  />
                </div>
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary" copyable style={{ wordBreak: "break-all" }}>
                    {url}
                  </Text>
                </div>
              </>
            ) : (
              <div
                style={{
                  width: 260,
                  height: 260,
                  margin: "0 auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#f8fafc",
                  borderRadius: 12,
                  border: "1px dashed #cbd5e1",
                }}
              >
                <Text type="secondary">{t("qrAccess.enterValidUrl")}</Text>
              </div>
            )}
          </div>

          {/* Fullscreen button */}
          <Button
            type="primary"
            icon={<FullscreenOutlined />}
            size="large"
            block
            disabled={!isValid}
            onClick={() => setFullscreen(true)}
          >
            {t("qrAccess.showFullscreen")}
          </Button>

          <Text type="secondary" style={{ fontSize: 12, textAlign: "center", display: "block" }}>
            {t("qrAccess.hint")}
          </Text>
        </Space>
      </Panel>
    </div>
  );
}
