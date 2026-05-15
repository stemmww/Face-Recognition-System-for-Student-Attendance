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
import { useTranslation } from "react-i18next";
import type { LivenessChallenge, VerifyAttendanceResponse } from "@/types";
import { fetchChallenge, verifyAttendance } from "@/api/attend";
import ChallengeGuide from "@/components/ChallengeGuide";

const { Title, Text } = Typography;

const SCANNER_ELEMENT_ID = "qr-reader";
// 6 frames × 250 ms ≈ 1.25 s of capture is enough for passive liveness
// (which needs ≥3 frames of natural micro-movement) and active challenges
// (which need ~5 frames to trace the gesture's arc). The voting layer is
// ratio-based, so the security budget rescales automatically with N.
const FRAME_COUNT = 6;
const FRAME_DELAY_MS = 250;

type Step = "scan" | "face" | "verifying" | "done";

export default function Attend() {
  const { t } = useTranslation();
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

  const [scannerLoading, setScannerLoading] = useState(false);

  // --- Step 1: QR Scanner ---
  const startScanner = useCallback(async () => {
    setError(null);
    setCameraFailed(false);
    setScannerLoading(true);

    const onSuccess = (decodedText: string) => {
      setQrToken(decodedText);
      // Defer stop() so html5-qrcode finishes its frame processing first
      setTimeout(() => {
        scannerRef.current?.stop().catch(() => {});
        scannerRef.current = null;
      }, 0);
      setStep("face");
    };

    // Try back camera first, then front camera
    const cameraConfigs = [
      { facingMode: "environment" },
      { facingMode: "user" },
    ];

    let started = false;
    for (const config of cameraConfigs) {
      try {
        // Clear any leftover DOM content from previous failed attempt
        const el = document.getElementById(SCANNER_ELEMENT_ID);
        if (el) el.innerHTML = "";

        const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
        await scanner.start(
          config,
          { fps: 10, qrbox: { width: 250, height: 250 } },
          onSuccess,
          () => {},
        );
        scannerRef.current = scanner;
        started = true;
        break;
      } catch {
        // Try next camera config
      }
    }

    if (!started) {
      setCameraFailed(true);
      setError(t("attend.cameraFailed"));
    }
    setScannerLoading(false);
  }, [t]);

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
        .catch((err: unknown) => {
          if (cancelled) return;
          const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "";
          if (detail === "ATTENDANCE_ALREADY_RECORDED") {
            // Skip camera — go straight to success
            setResult({ success: true, status: "present", message: t("attend.alreadyRecorded") });
            setStep("done");
          } else {
            setError(detail || t("attend.challengeLoadFailed"));
          }
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
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        setError(t("attend.cameraPermission"));
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    };
  }, [step, qrToken, t]);

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
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
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
        challenge_token: challenge!.token,
      });
      setResult(res);
      setStep("done");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || t("attend.verifyFailed");
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
      <Title level={4}>{t("attend.title")}</Title>

      <Steps
        current={currentStep}
        style={{ marginBottom: 24 }}
        items={[
          { title: t("attend.scanQR"), icon: <QrcodeOutlined /> },
          { title: t("attend.faceVerify"), icon: <CameraOutlined /> },
          { title: t("common.done"), icon: <CheckCircleOutlined /> },
        ]}
      />

      {/* Step 1: QR scanner */}
      {step === "scan" && (
        <Card>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <ScanOutlined style={{ fontSize: 32, color: "#1677ff" }} />
            <Title level={5} style={{ marginTop: 8 }}>
              {t("attend.pointCamera")}
            </Title>
          </div>
          {scannerLoading && (
            <div style={{ textAlign: "center", padding: 32 }}>
              <Spin indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} />
              <div style={{ marginTop: 12 }}>
                <Text type="secondary">{t("attend.initializingCamera")}</Text>
              </div>
            </div>
          )}
          {!cameraFailed && (
            <div
              id={SCANNER_ELEMENT_ID}
              style={{ maxWidth: 400, margin: "0 auto", minHeight: scannerLoading ? 0 : 300 }}
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
          {/* Always show manual input as fallback */}
          <div style={{ marginTop: 16, maxWidth: 400, margin: "16px auto 0" }}>
            <Text strong>{t("attend.pasteToken")}</Text>
            <Space.Compact style={{ width: "100%", marginTop: 8 }}>
              <Input
                placeholder={t("attend.tokenPlaceholder")}
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                onPressEnter={handleManualSubmit}
              />
              <Button type="primary" onClick={handleManualSubmit} disabled={!manualToken.trim()}>
                {t("common.submit")}
              </Button>
            </Space.Compact>
            <Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12 }}>
              {t("attend.askProfessor")}
            </Text>
          </div>
        </Card>
      )}

      {/* Step 2: Face capture + challenge */}
      {step === "face" && (
        <Card>
          <div style={{ textAlign: "center" }}>
            <Title level={5}>{t("attend.positionFace")}</Title>

            {/* Challenge instruction */}
            {loadingChallenge && (
              <Spin size="small" style={{ marginBottom: 12 }} />
            )}
            {challenge && !loadingChallenge && (
              <ChallengeGuide
                challengeTypes={challenge.challenge_types ?? [challenge.challenge_type]}
                instruction={challenge.instruction}
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
                  {t("attend.capturing", { current: captureProgress, total: FRAME_COUNT })}
                </div>
              )}
            </div>
            <Space direction="vertical" style={{ marginTop: 16 }}>
              <Button
                type="primary"
                size="large"
                icon={<CameraOutlined />}
                onClick={captureAndVerify}
                disabled={captureProgress > 0 || !challenge || loadingChallenge}
              >
                {captureProgress > 0
                  ? t("attend.capturing", { current: captureProgress, total: FRAME_COUNT })
                  : t("attend.captureVerify")}
              </Button>
              <Text type="secondary">
                {challenge
                  ? t("attend.challengeHint")
                  : t("attend.faceHint")}
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
              {t("attend.verifying")}
            </Title>
            <Text type="secondary">
              {t("attend.verifyingChecks")}
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
              title={t("attend.attendanceRecorded")}
              subTitle={result.message}
              extra={
                <Button type="primary" onClick={handleReset}>
                  {t("common.done")}
                </Button>
              }
            />
          ) : (
            <Result
              status="error"
              title={t("attend.verificationFailed")}
              subTitle={error || result?.message || t("attend.somethingWentWrong")}
              extra={
                <Button type="primary" onClick={handleReset}>
                  {t("attend.tryAgain")}
                </Button>
              }
            />
          )}
        </Card>
      )}
    </>
  );
}
