import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Input,
  Result,
  Space,
  Spin,
  Steps,
  Typography,
} from "antd";
import {
  CameraOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  QrcodeOutlined,
  ScanOutlined,
} from "@ant-design/icons";
import { Html5Qrcode } from "html5-qrcode";
import { verifyAttendance } from "@/api/attend";
import type { VerifyAttendanceResponse } from "@/types";

const { Title, Text } = Typography;

const SCANNER_ELEMENT_ID = "qr-reader";

type Step = "scan" | "face" | "verifying" | "done";

export default function Attend() {
  const [step, setStep] = useState<Step>("scan");
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [cameraFailed, setCameraFailed] = useState(false);
  const [result, setResult] = useState<VerifyAttendanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // --- Step 1: QR Scanner ---
  const startScanner = useCallback(async () => {
    setError(null);
    setCameraFailed(false);
    try {
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          setQrToken(decodedText);
          scanner.stop().catch(() => {});
          scannerRef.current = null;
          setStep("face");
        },
        () => {},
      );
    } catch {
      setCameraFailed(true);
      setError(
        "Could not access camera. On mobile, camera requires HTTPS. " +
        "You can use the manual token input below instead."
      );
    }
  }, []);

  useEffect(() => {
    if (step === "scan") {
      const timeout = setTimeout(startScanner, 300);
      return () => {
        clearTimeout(timeout);
        if (scannerRef.current) {
          scannerRef.current.stop().catch(() => {});
          scannerRef.current = null;
        }
      };
    }
  }, [step, startScanner]);

  const handleManualSubmit = () => {
    if (!manualToken.trim()) return;
    setQrToken(manualToken.trim());
    setStep("face");
  };

  // --- Step 2: Face capture ---
  useEffect(() => {
    if (step !== "face") return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        setError("Could not access front camera. Please allow camera permissions.");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [step]);

  const captureAndVerify = async () => {
    if (!videoRef.current || !qrToken) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d")!;

    const captureFrame = () =>
      new Promise<Blob>((resolve) => {
        ctx.drawImage(videoRef.current!, 0, 0);
        canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.85);
      });

    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // Capture 3 frames ~500ms apart while video is still mounted
    const blobs: Blob[] = [];
    for (let i = 0; i < 3; i++) {
      blobs.push(await captureFrame());
      if (i < 2) await delay(500);
    }

    // Only NOW switch to the verifying UI and stop the camera
    setStep("verifying");
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    let latitude: number | null = null;
    let longitude: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        }),
      );
      latitude = pos.coords.latitude;
      longitude = pos.coords.longitude;
    } catch {
      // GPS unavailable — silently skip, backend handles missing coords
    }

    try {
      const res = await verifyAttendance({
        token: qrToken,
        frames: blobs,
        latitude,
        longitude,
      });
      setResult(res);
      setStep("done");
    } catch (err: any) {
      const detail = err?.response?.data?.detail || "Verification failed. Please try again.";
      setError(detail);
      setStep("done");
    }
  };

  const handleReset = () => {
    setStep("scan");
    setQrToken(null);
    setResult(null);
    setError(null);
  };

  const currentStep = step === "scan" ? 0 : step === "face" ? 1 : 2;

  return (
    <>
      <Title level={4}>Attend Class</Title>

      <Steps
        current={currentStep}
        style={{ marginBottom: 24 }}
        items={[
          { title: "Scan QR", icon: <QrcodeOutlined /> },
          { title: "Face Verify", icon: <CameraOutlined /> },
          { title: "Done", icon: <CheckCircleOutlined /> },
        ]}
      />

      {/* Step 1: QR scanner */}
      {step === "scan" && (
        <Card>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <ScanOutlined style={{ fontSize: 32, color: "#1677ff" }} />
            <Title level={5} style={{ marginTop: 8 }}>
              Point your camera at the QR code on screen
            </Title>
          </div>
          {!cameraFailed && (
            <div
              id={SCANNER_ELEMENT_ID}
              style={{ maxWidth: 400, margin: "0 auto" }}
            />
          )}
          {error && (
            <Alert
              type="warning"
              message={error}
              style={{ marginTop: 16 }}
              showIcon
            />
          )}
          {cameraFailed && (
            <div style={{ marginTop: 16, maxWidth: 400, margin: "16px auto 0" }}>
              <Text strong>Paste QR token manually:</Text>
              <Space.Compact style={{ width: "100%", marginTop: 8 }}>
                <Input
                  placeholder="Paste the QR token here..."
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  onPressEnter={handleManualSubmit}
                />
                <Button type="primary" onClick={handleManualSubmit} disabled={!manualToken.trim()}>
                  Submit
                </Button>
              </Space.Compact>
              <Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12 }}>
                Ask your professor for the current token, or scan from a device with camera access.
              </Text>
            </div>
          )}
        </Card>
      )}

      {/* Step 2: Face capture */}
      {step === "face" && (
        <Card>
          <div style={{ textAlign: "center" }}>
            <Title level={5}>Position your face in the frame</Title>
            <div
              style={{
                position: "relative",
                maxWidth: 400,
                margin: "0 auto",
                borderRadius: 12,
                overflow: "hidden",
                background: "#000",
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%",
                  display: "block",
                  transform: "scaleX(-1)",
                }}
              />
              {/* Oval face guide overlay */}
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 180,
                  height: 240,
                  border: "3px dashed rgba(255,255,255,0.6)",
                  borderRadius: "50%",
                  pointerEvents: "none",
                }}
              />
            </div>
            <Space direction="vertical" style={{ marginTop: 16 }}>
              <Button
                type="primary"
                size="large"
                icon={<CameraOutlined />}
                onClick={captureAndVerify}
              >
                Capture & Verify
              </Button>
              <Text type="secondary">
                Make sure your face is clearly visible and well-lit
              </Text>
            </Space>
            {error && (
              <Alert type="error" message={error} style={{ marginTop: 16 }} showIcon />
            )}
          </div>
        </Card>
      )}

      {/* Step 3: Verifying */}
      {step === "verifying" && (
        <Card>
          <div style={{ textAlign: "center", padding: 48 }}>
            <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
            <Title level={5} style={{ marginTop: 16 }}>
              Verifying your identity...
            </Title>
            <Text type="secondary">
              Checking QR code, GPS location, and face recognition
            </Text>
          </div>
        </Card>
      )}

      {/* Step 4: Result */}
      {step === "done" && (
        <Card>
          {result?.success ? (
            <Result
              status="success"
              title="Attendance Recorded!"
              subTitle={result.message}
              extra={
                <Button type="primary" onClick={handleReset}>
                  Done
                </Button>
              }
            />
          ) : (
            <Result
              status="error"
              title="Verification Failed"
              subTitle={error || result?.message || "Something went wrong."}
              extra={
                <Button type="primary" onClick={handleReset}>
                  Try Again
                </Button>
              }
            />
          )}
        </Card>
      )}
    </>
  );
}
