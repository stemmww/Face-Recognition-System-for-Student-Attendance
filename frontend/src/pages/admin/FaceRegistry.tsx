import { useCallback, useEffect, useState } from "react";
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
      message.error("Failed to load students");
    }
  }, []);

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
      message.error("Failed to load embeddings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedStudent) fetchEmbeddings(selectedStudent);
    else setEmbeddings([]);
  }, [selectedStudent, fetchEmbeddings]);

  const handleEnroll = async (file: File) => {
    if (!selectedStudent) {
      message.warning("Select a student first");
      return;
    }
    setEnrolling(true);
    try {
      const result = await enrollFace(selectedStudent, file);
      message.success(result.message);
      fetchEmbeddings(selectedStudent);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      message.error(detail || "Enrollment failed");
    } finally {
      setEnrolling(false);
    }
  };

  const handleDeleteEmbedding = async (id: number) => {
    try {
      await deleteEmbedding(id);
      message.success("Embedding deleted");
      if (selectedStudent) fetchEmbeddings(selectedStudent);
    } catch {
      message.error("Failed to delete");
    }
  };

  const handleDeleteAll = async () => {
    if (!selectedStudent) return;
    try {
      await deleteAllEmbeddings(selectedStudent);
      message.success("All embeddings deleted");
      setEmbeddings([]);
    } catch {
      message.error("Failed to delete");
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
        message.warning("No face detected in the image");
      }
    } catch (err: any) {
      message.error(err?.response?.data?.detail || "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const student = students.find((s) => s.id === selectedStudent);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Face Registry</Title>
        <Button icon={<SearchOutlined />} onClick={() => { setVerifyModalOpen(true); setVerifyMatches([]); setVerifyFaceCount(0); }}>
          Verify Face
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
              ? "AI pipeline ready — InsightFace model loaded"
              : "AI models not yet loaded — they will initialize on first face enrollment"
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={24}>
        {/* Left: Student selector + upload */}
        <Col xs={24} lg={10}>
          <Card title="Enroll Face" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Text strong>Select Student</Text>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Search by name or email"
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
                      <Tag>photos</Tag>
                    </Badge>
                  </Space>
                  {embeddings.length < 3 && (
                    <Alert
                      type="warning"
                      message={`${embeddings.length} photo(s) enrolled. We recommend at least 3 photos from different angles for reliable recognition.`}
                      showIcon
                      style={{ marginTop: 8 }}
                    />
                  )}
                  {embeddings.length >= 3 && embeddings.length <= 5 && (
                    <Alert
                      type="success"
                      message={`Good coverage: ${embeddings.length} photo(s) enrolled.`}
                      showIcon
                      style={{ marginTop: 8 }}
                    />
                  )}
                  {embeddings.length > 5 && (
                    <Alert
                      type="info"
                      message={`${embeddings.length} photos enrolled. 3–5 is typically sufficient.`}
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
                  {enrolling ? "Processing..." : "Click or drag a student photo to enroll"}
                </p>
                <p className="ant-upload-hint">
                  JPG, PNG, or WebP. Max 10 MB. One clear face per photo.
                </p>
              </Dragger>

              <Paragraph type="secondary" style={{ marginTop: 8, fontSize: 12 }}>
                Tip: Upload 3-5 photos per student from different angles for best accuracy.
              </Paragraph>
            </Space>
          </Card>
        </Col>

        {/* Right: Stored embeddings */}
        <Col xs={24} lg={14}>
          <Card
            title={student ? `Embeddings for ${student.first_name} ${student.last_name}` : "Stored Embeddings"}
            extra={
              embeddings.length > 0 && (
                <Popconfirm title="Delete ALL embeddings for this student?" onConfirm={handleDeleteAll} okButtonProps={{ danger: true }}>
                  <Button size="small" danger icon={<DeleteOutlined />}>Delete All</Button>
                </Popconfirm>
              )
            }
          >
            {!selectedStudent ? (
              <Empty description="Select a student to view their face embeddings" />
            ) : loading ? (
              <div style={{ textAlign: "center", padding: 32 }}><Progress type="circle" percent={-1} /></div>
            ) : embeddings.length === 0 ? (
              <Empty description="No face embeddings registered yet" />
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
                        <Popconfirm key="del" title="Delete?" onConfirm={() => handleDeleteEmbedding(emb.id)}>
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
        title="Verify Face"
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
              {verifying ? "Searching..." : "Drop a photo to identify the person"}
            </p>
          </Dragger>

          {verifyFaceCount > 0 && (
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">{verifyFaceCount} face(s) detected</Text>
              {verifyMatches.length === 0 ? (
                <Alert type="warning" message="No matching students found" style={{ marginTop: 8 }} />
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
                        {(m.similarity * 100).toFixed(1)}% match
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
