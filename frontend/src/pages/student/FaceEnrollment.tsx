import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Button,
  Checkbox,
  Descriptions,
  Popconfirm,
  Progress,
  Result,
  Space,
  Spin,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import {
  CameraOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  InboxOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/hooks/useAuth";
import {
  getFaceEnrollmentStatus,
  selfDeleteFaceData,
  submitFaceEnrollment,
} from "@/api/faceEnrollment";
import type { FaceEnrollmentMeResponse, FaceEnrollmentUploadResponse } from "@/types";
import PageHeader from "@/components/dashboard/PageHeader";
import Panel from "@/components/dashboard/Panel";

const { Text } = Typography;

const REJECTION_REASON_KEY: Record<string, string> = {
  NO_FACE_DETECTED: "faceEnrollment.rejectNoFace",
  MULTIPLE_FACES_DETECTED: "faceEnrollment.rejectMultipleFaces",
  FACE_TOO_BLURRY: "faceEnrollment.rejectBlurry",
  FACE_TOO_SMALL: "faceEnrollment.rejectTooSmall",
  LANDMARKS_FAILED: "faceEnrollment.rejectNotFrontal",
  POOR_LIGHTING: "faceEnrollment.rejectLighting",
  QUALITY_TOO_LOW: "faceEnrollment.rejectQuality",
  UNSUPPORTED_FORMAT: "faceEnrollment.rejectFormat",
  FILE_TOO_LARGE: "faceEnrollment.rejectFileSize",
  PIPELINE_ERROR: "faceEnrollment.rejectPipeline",
  EMBEDDING_FAILED: "faceEnrollment.rejectEmbedding",
  SAVE_FAILED: "faceEnrollment.rejectSave",
  MAX_PHOTOS_REACHED: "faceEnrollment.rejectMaxPhotos",
};

export default function FaceEnrollment() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [statusData, setStatusData] = useState<FaceEnrollmentMeResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const [consentChecked, setConsentChecked] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lastResult, setLastResult] = useState<FaceEnrollmentUploadResponse | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);

  const previewBlobRef = useRef<string | null>(null);
  const hasPermission = statusData?.can_self_enroll_face ?? user?.can_self_enroll_face === true;

  const maxPhotos = statusData?.max_photos ?? 5;
  const count = statusData?.embedding_count ?? 0;
  const atMax = count >= maxPhotos;

  async function refreshStatus() {
    try {
      const s = await getFaceEnrollmentStatus();
      setStatusData(s);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    getFaceEnrollmentStatus()
      .then(setStatusData)
      .catch(() => {})
      .finally(() => setStatusLoading(false));
  }, []);

  useEffect(() => {
    return () => {
      if (previewBlobRef.current) URL.revokeObjectURL(previewBlobRef.current);
    };
  }, []);

  function handleFileSelect(file: File): boolean {
    setLastResult(null);
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      message.error(t("faceEnrollment.rejectFormat"));
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      message.error(t("faceEnrollment.rejectFileSize"));
      return false;
    }
    if (previewBlobRef.current) URL.revokeObjectURL(previewBlobRef.current);
    const url = URL.createObjectURL(file);
    previewBlobRef.current = url;
    setSelectedFile(file);
    setPreviewUrl(url);
    return false;
  }

  async function handleSubmit() {
    if (!selectedFile || !consentChecked) return;
    setUploading(true);
    setLastResult(null);
    try {
      const res = await submitFaceEnrollment(selectedFile);
      setLastResult(res);
      if (res.success) {
        clearPreview();
        await refreshStatus();
        message.success(t("faceEnrollment.photoAdded"));
      }
    } catch {
      message.error(t("faceEnrollment.submitFailed"));
    } finally {
      setUploading(false);
    }
  }

  function clearPreview() {
    setSelectedFile(null);
    if (previewBlobRef.current) {
      URL.revokeObjectURL(previewBlobRef.current);
      previewBlobRef.current = null;
    }
    setPreviewUrl(null);
    setLastResult(null);
  }

  async function handleDeleteAll() {
    setDeletingAll(true);
    try {
      await selfDeleteFaceData();
      message.success(t("faceEnrollment.allDeleted"));
      clearPreview();
      await refreshStatus();
    } catch {
      message.error(t("faceEnrollment.deleteFailed"));
    } finally {
      setDeletingAll(false);
    }
  }

  if (statusLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", marginTop: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <Result
        status="403"
        title={t("faceEnrollment.noPermissionTitle")}
        subTitle={t("faceEnrollment.noPermissionDesc")}
      />
    );
  }

  const rejectionI18nKey = lastResult?.reason ? REJECTION_REASON_KEY[lastResult.reason] : undefined;
  const rejectionMsg = rejectionI18nKey ? t(rejectionI18nKey) : lastResult?.message ?? "";

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader title={t("faceEnrollment.pageTitle")} subtitle={t("faceEnrollment.pageDesc")} />

      {/* Status panel */}
      {statusData && (
        <Panel>
          <Descriptions size="small" column={1} title={t("faceEnrollment.statusTitle")}>
            <Descriptions.Item label={t("faceEnrollment.permissionLabel")}>
              <Tag color="green">{t("faceEnrollment.permissionGranted")}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t("faceEnrollment.photosLabel")}>
              <Space>
                {count > 0 ? (
                  <Tag icon={<CheckCircleOutlined />} color="success">
                    {t("faceEnrollment.photosCount", { count, max: maxPhotos })}
                  </Tag>
                ) : (
                  <Tag icon={<CloseCircleOutlined />} color="default">
                    {t("faceEnrollment.enrolledNo")}
                  </Tag>
                )}
                {count > 0 && (
                  <Popconfirm
                    title={t("faceEnrollment.deleteAllTitle")}
                    description={t("faceEnrollment.deleteAllDesc")}
                    onConfirm={handleDeleteAll}
                    okText={t("common.delete")}
                    okButtonProps={{ danger: true }}
                  >
                    <Button
                      type="link"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      loading={deletingAll}
                      style={{ padding: 0, height: "auto" }}
                    >
                      {t("faceEnrollment.deleteAll")}
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            </Descriptions.Item>
            {count > 0 && (
              <Descriptions.Item label={t("faceEnrollment.progressLabel")}>
                <Progress
                  percent={Math.round((count / maxPhotos) * 100)}
                  steps={maxPhotos}
                  size="small"
                  format={() => `${count}/${maxPhotos}`}
                  status={atMax ? "exception" : "active"}
                />
              </Descriptions.Item>
            )}
            {statusData.face_enrolled_at && (
              <Descriptions.Item label={t("faceEnrollment.enrolledAt")}>
                <Text>{new Date(statusData.face_enrolled_at).toLocaleString()}</Text>
              </Descriptions.Item>
            )}
          </Descriptions>
        </Panel>
      )}

      {/* Last upload result */}
      {lastResult && !lastResult.success && (
        <Alert
          type="error"
          showIcon
          message={t("faceEnrollment.rejectedTitle")}
          description={rejectionMsg}
          style={{ marginBottom: 16 }}
          closable
          onClose={() => setLastResult(null)}
        />
      )}

      {/* Upload form — disabled when at cap */}
      {atMax ? (
        <Alert
          type="warning"
          showIcon
          icon={<CameraOutlined />}
          message={t("faceEnrollment.maxReachedTitle")}
          description={t("faceEnrollment.maxReachedDesc", { max: maxPhotos })}
          style={{ marginBottom: 24 }}
        />
      ) : (
        <Panel>
          {/* Consent */}
          <div style={{ marginBottom: 20 }}>
            <Checkbox
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
            >
              {t("faceEnrollment.consentText")}
            </Checkbox>
          </div>

          {/* Upload dragger */}
          <Upload.Dragger
            accept="image/jpeg,image/png"
            showUploadList={false}
            beforeUpload={handleFileSelect}
            disabled={uploading}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">{t("faceEnrollment.uploadHint")}</p>
            <p className="ant-upload-hint">{t("faceEnrollment.uploadFormat")}</p>
          </Upload.Dragger>

          {/* Preview */}
          {previewUrl && (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <img
                src={previewUrl}
                alt="preview"
                style={{
                  maxWidth: "100%",
                  maxHeight: 300,
                  borderRadius: 8,
                  border: "1px solid rgba(0,0,0,0.1)",
                  objectFit: "contain",
                }}
              />
            </div>
          )}

          {/* Actions */}
          <Space style={{ marginTop: 16 }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={!selectedFile || !consentChecked}
              loading={uploading}
              onClick={handleSubmit}
            >
              {uploading ? t("faceEnrollment.submitting") : t("faceEnrollment.addPhotoBtn")}
            </Button>
            {selectedFile && (
              <Button onClick={clearPreview} disabled={uploading}>
                {t("faceEnrollment.clearBtn")}
              </Button>
            )}
          </Space>
        </Panel>
      )}

      {/* Tips */}
      <Alert
        type="info"
        showIcon
        message={t("faceEnrollment.tipsTitle")}
        description={
          <ul style={{ margin: "4px 0", paddingLeft: 20 }}>
            <li>{t("faceEnrollment.tip1")}</li>
            <li>{t("faceEnrollment.tip2")}</li>
            <li>{t("faceEnrollment.tip3")}</li>
            <li>{t("faceEnrollment.tip4")}</li>
            <li>{t("faceEnrollment.tipMultiple")}</li>
          </ul>
        }
        style={{ marginTop: 24 }}
      />
    </div>
  );
}
