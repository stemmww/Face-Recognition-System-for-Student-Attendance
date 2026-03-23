import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Image,
  List,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Select,
  Space,
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
  SearchOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { User } from "@/types";
import { listUsers } from "@/api/users";
import {
  deleteAllEmbeddings,
  deleteEmbedding,
  enrollFace,
  getPipelineStatus,
  listEmbeddings,
  verifyFace,
  type FaceEmbedding,
  type FaceVerifyMatch,
  type PipelineStatus,
} from "@/api/face";
import { formatDateTime } from "@/utils/formatters";

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

export default function FaceRegistry() {
  const { t } = useTranslation();
  const [students, setStudents] = useState<User[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);
  const [embeddings, setEmbeddings] = useState<FaceEmbedding[]>([]);
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);

  // Verify state
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyMatches, setVerifyMatches] = useState<FaceVerifyMatch[]>([]);
  const [verifyFaceCount, setVerifyFaceCount] = useState(0);

  const fetchStudents = useCallback(async () => {
    try {
      const users = await listUsers("student");
      setStudents(users);
    } catch {
      message.error(t("faces.loadFailed"));
    }
  }, [t]);

  const fetchStatus = useCallback(async () => {
    try {
      const status = await getPipelineStatus();
      setPipelineStatus(status);
    } catch {
      // AI not available — that's fine
    }
  }, []);

  useEffect(() => {
    fetchStudents();
    fetchStatus();
  }, [fetchStudents, fetchStatus]);

  const fetchEmbeddings = useCallback(async (userId: number) => {
    setLoading(true);
    try {
      setEmbeddings(await listEmbeddings(userId));
    } catch {
      message.error(t("faces.embeddingsLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (selectedStudent) fetchEmbeddings(selectedStudent);
    else setEmbeddings([]);
  }, [selectedStudent, fetchEmbeddings]);

  const handleEnroll = async (file: File) => {
    if (!selectedStudent) {
      message.warning(t("faces.selectFirst"));
      return;
    }
    setEnrolling(true);
    try {
      const result = await enrollFace(selectedStudent, file);
      message.success(result.message);
      fetchEmbeddings(selectedStudent);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      message.error(detail || t("faces.enrollFailed"));
    } finally {
      setEnrolling(false);
    }
  };

  const handleDeleteEmbedding = async (id: number) => {
    try {
      await deleteEmbedding(id);
      message.success(t("faces.embeddingDeleted"));
      if (selectedStudent) fetchEmbeddings(selectedStudent);
    } catch {
      message.error(t("faces.deleteFailed"));
    }
  };

  const handleDeleteAll = async () => {
    if (!selectedStudent) return;
    try {
      await deleteAllEmbeddings(selectedStudent);
      message.success(t("faces.allDeleted"));
      setEmbeddings([]);
    } catch {
      message.error(t("faces.deleteFailed"));
    }
  };

  const handleVerify = async (file: File) => {
    setVerifying(true);
    setVerifyMatches([]);
    try {
      const result = await verifyFace(file);
      setVerifyFaceCount(result.faces_detected);
      setVerifyMatches(result.matches);
      if (result.faces_detected === 0) {
        message.warning(t("faces.noFaceDetected"));
      }
    } catch (err: any) {
      message.error(err?.response?.data?.detail || t("faces.verifyFailed"));
    } finally {
      setVerifying(false);
    }
  };

  const student = students.find((s) => s.id === selectedStudent);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{t("faces.title")}</Title>
        <Button icon={<SearchOutlined />} onClick={() => { setVerifyModalOpen(true); setVerifyMatches([]); setVerifyFaceCount(0); }}>
          {t("faces.verifyFace")}
        </Button>
      </div>

      {/* Pipeline status */}
      {pipelineStatus && (
        <Alert
          type={pipelineStatus.insightface_loaded ? "success" : "warning"}
          showIcon
          icon={pipelineStatus.insightface_loaded ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          message={
            pipelineStatus.insightface_loaded
              ? t("faces.pipelineReady")
              : t("faces.pipelineNotReady")
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={24}>
        {/* Left: Student selector + upload */}
        <Col xs={24} lg={10}>
          <Card title={t("faces.enrollFace")} style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Text strong>{t("faces.selectStudent")}</Text>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder={t("faces.searchByNameEmail")}
                value={selectedStudent}
                onChange={setSelectedStudent}
                style={{ width: "100%" }}
                allowClear
                options={students.map((s) => ({
                  value: s.id,
                  label: `${s.first_name} ${s.last_name} (${s.email})`,
                }))}
              />

              {student && (
                <Card size="small" style={{ marginTop: 8 }}>
                  <Space>
                    <UserOutlined />
                    <Text strong>{student.first_name} {student.last_name}</Text>
                    <Text type="secondary">{student.email}</Text>
                    <Badge
                      count={embeddings.length}
                      showZero
                      style={{
                        backgroundColor:
                          embeddings.length === 0 ? "#ff4d4f" :
                          embeddings.length < 3 ? "#fa8c16" :
                          "#52c41a"
                      }}
                    >
                      <Tag>{t("faces.photos")}</Tag>
                    </Badge>
                  </Space>
                  {embeddings.length < 3 && (
                    <Alert
                      type="warning"
                      message={t("faces.photosRecommend", { count: embeddings.length })}
                      showIcon
                      style={{ marginTop: 8 }}
                    />
                  )}
                  {embeddings.length >= 3 && embeddings.length <= 5 && (
                    <Alert
                      type="success"
                      message={t("faces.photosGood", { count: embeddings.length })}
                      showIcon
                      style={{ marginTop: 8 }}
                    />
                  )}
                  {embeddings.length > 5 && (
                    <Alert
                      type="info"
                      message={t("faces.photosSufficient", { count: embeddings.length })}
                      showIcon
                      style={{ marginTop: 8 }}
                    />
                  )}
                </Card>
              )}

              <Divider />

              <Dragger
                accept="image/jpeg,image/png,image/webp"
                showUploadList={false}
                disabled={!selectedStudent || enrolling}
                beforeUpload={(file) => {
                  handleEnroll(file);
                  return false;
                }}
              >
                <p className="ant-upload-drag-icon">
                  <CameraOutlined style={{ fontSize: 40, color: "#1677ff" }} />
                </p>
                <p className="ant-upload-text">
                  {enrolling ? t("faces.processing") : t("faces.uploadHint")}
                </p>
                <p className="ant-upload-hint">
                  {t("faces.uploadFormat")}
                </p>
              </Dragger>

              <Paragraph type="secondary" style={{ marginTop: 8, fontSize: 12 }}>
                {t("faces.uploadTip")}
              </Paragraph>
            </Space>
          </Card>
        </Col>

        {/* Right: Stored embeddings */}
        <Col xs={24} lg={14}>
          <Card
            title={student ? t("faces.embeddingsFor", { name: `${student.first_name} ${student.last_name}` }) : t("faces.storedEmbeddings")}
            extra={
              embeddings.length > 0 && (
                <Popconfirm title={t("faces.deleteAllConfirm")} onConfirm={handleDeleteAll} okButtonProps={{ danger: true }}>
                  <Button size="small" danger icon={<DeleteOutlined />}>{t("faces.deleteAll")}</Button>
                </Popconfirm>
              )
            }
          >
            {!selectedStudent ? (
              <Empty description={t("faces.selectStudentView")} />
            ) : loading ? (
              <div style={{ textAlign: "center", padding: 32 }}><Progress type="circle" percent={-1} /></div>
            ) : embeddings.length === 0 ? (
              <Empty description={t("faces.noEmbeddings")} />
            ) : (
              <List
                grid={{ gutter: 16, xs: 1, sm: 2, md: 2, lg: 3 }}
                dataSource={embeddings}
                renderItem={(emb) => (
                  <List.Item>
                    <Card
                      size="small"
                      cover={
                        <Image
                          src={`/uploads/${emb.photo_path}`}
                          alt="Face"
                          style={{ height: 150, objectFit: "cover" }}
                          fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNjY2MiIGZvbnQtc2l6ZT0iMTQiPk5vIGltYWdlPC90ZXh0Pjwvc3ZnPg=="
                        />
                      }
                      actions={[
                        <Popconfirm key="del" title={`${t("common.delete")}?`} onConfirm={() => handleDeleteEmbedding(emb.id)}>
                          <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                        </Popconfirm>,
                      ]}
                    >
                      <Card.Meta description={formatDateTime(emb.created_at)} />
                    </Card>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Verify Face Modal */}
      <Modal
        title={t("faces.verifyFace")}
        open={verifyModalOpen}
        onCancel={() => setVerifyModalOpen(false)}
        footer={null}
        width={600}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Dragger
            accept="image/jpeg,image/png,image/webp"
            showUploadList={false}
            disabled={verifying}
            beforeUpload={(file) => {
              handleVerify(file);
              return false;
            }}
          >
            <p className="ant-upload-drag-icon">
              <SearchOutlined style={{ fontSize: 32, color: "#1677ff" }} />
            </p>
            <p className="ant-upload-text">
              {verifying ? t("faces.searching") : t("faces.dropToIdentify")}
            </p>
          </Dragger>

          {verifyFaceCount > 0 && (
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">{t("faces.facesDetected", { count: verifyFaceCount })}</Text>
              {verifyMatches.length === 0 ? (
                <Alert type="warning" message={t("faces.noMatchFound")} style={{ marginTop: 8 }} />
              ) : (
                <List
                  style={{ marginTop: 8 }}
                  bordered
                  dataSource={verifyMatches}
                  renderItem={(m) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<UserOutlined style={{ fontSize: 20 }} />}
                        title={`${m.first_name} ${m.last_name}`}
                        description={m.email}
                      />
                      <Tag color={m.similarity > 0.6 ? "green" : m.similarity > 0.4 ? "orange" : "red"}>
                        {(m.similarity * 100).toFixed(1)}% {t("faces.match")}
                      </Tag>
                    </List.Item>
                  )}
                />
              )}
            </div>
          )}
        </Space>
      </Modal>
    </>
  );
}
