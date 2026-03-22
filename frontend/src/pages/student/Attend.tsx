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
import { fetchChallenge, verifyAttendance, type LivenessChallenge } from "@/api/attend";
import type { VerifyAttendanceResponse } from "@/types";

const { Title, Text } = Typography;

const SCANNER_ELEMENT_ID = "qr-reader";
const FRAME_COUNT = 5;
const FRAME_DELAY_MS = 400;

type Step = "scan" | "face" | "verifying" | "done";

export default function Attend() {
  const [step, setStep] = useState<Step>("scan");
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [cameraFailed, setCameraFailed] = useState(false);
  const [result, setResult] = useState<VerifyAttendanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Challenge state
  const [challenge, setChallenge] = useState<LivenessChallenge | null>(null);
  const [loadingChallenge, setLoadingChallenge] = useState(false);

  // Capture UX state
  const [captureProgress, setCaptureProgress] = useState(0);
  const [flashActive, setFlashActive] = useState(false);

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

  // --- Step 2: Face capture + challenge ---
  useEffect(() => {
    if (step !== "face") return;
    let cancelled = false;

    // Fetch liveness challenge
    if (qrToken) {
      setLoadingChallenge(true);
      fetchChallenge(qrToken)
        .then((ch) => {
          if (!cancelled) setChallenge(ch);
        })
        .catch(() => {
          // Challenge endpoint unavailable — proceed without
        })
        .finally(() => {
          if (!cancelled) setLoadingChallenge(false);
        });
    }

    // Start front camera
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
  }, [step, qrToken]);

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

    // Capture frames with visual feedback
    const blobs: Blob[] = [];
    setCaptureProgress(0);
    for (let i = 0; i < FRAME_COUNT; i++) {
      blobs.push(await captureFrame());
      setCaptureProgress(i + 1);
      setFlashActive(true);
      setTimeout(() => setFlashActive(false), 150);
      if (i < FRAME_COUNT - 1) await delay(FRAME_DELAY_MS);
    }

    // Switch to verifying UI and stop camera
    setStep("verifying");
    setCaptureProgress(0);
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
      // GPS unavailable — let server decide if mandatory
    }

    try {
      const res = await verifyAttendance({
        token: qrToken,
        frames: blobs,
        latitude,
        longitude,
        challenge_token: challenge?.token ?? null,
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
    setChallenge(null);
    setCaptureProgress(0);
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

      {/* Step 2: Face capture + challenge */}
      {step === "face" && (
        <Card>
          <div style={{ textAlign: "center" }}>
            <Title level={5}>Position your face in the frame</Title>

            {/* Challenge instruction */}
            {loadingChallenge && (
              <Spin size="small" style={{ marginBottom: 12 }} />
            )}
            {challenge && !loadingChallenge && (
              <Alert
                type="info"
                message={challenge.instruction}
                style={{ marginBottom: 16, fontSize: 16, fontWeight: "bold" }}
                showIcon
                banner
              />
            )}

            <div
              style={{
                position: "relative",
                maxWidth: 400,
                margin: "0 auto",
                borderRadius: 12,
                overflow: "hidden",
                background: "#000",
                border: flashActive
                  ? "4px solid rgba(255,255,255,0.8)"
                  : "4px solid transparent",
                transition: "border 0.1s ease",
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
              {/* Capture progress indicator */}
              {captureProgress > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    background: "rgba(0,0,0,0.6)",
                    color: "#fff",
                    padding: "4px 12px",
                    borderRadius: 8,
                    fontSize: 14,
                  }}
                >
                  Capturing {captureProgress}/{FRAME_COUNT}...
                </div>
              )}
            </div>
            <Space direction="vertical" style={{ marginTop: 16 }}>
              <Button
                type="primary"
                size="large"
                icon={<CameraOutlined />}
                onClick={captureAndVerify}
                disabled={captureProgress > 0}
              >
                {captureProgress > 0
                  ? `Capturing ${captureProgress}/${FRAME_COUNT}...`
                  : "Capture & Verify"}
              </Button>
              <Text type="secondary">
                {challenge
                  ? `Perform the action above, then tap Capture & Verify`
                  : "Make sure your face is clearly visible and well-lit"}
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
              Checking QR code, GPS location, liveness, and face recognition
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
