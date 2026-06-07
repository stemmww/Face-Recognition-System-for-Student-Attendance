import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
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
  theme,
} from "antd";
import {
  CameraOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  SearchOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { User, FaceCoverage, FaceEmbedding, FaceVerifyMatch, PipelineStatus } from "@/types";
import { listUsers } from "@/api/users";
import {
  deleteAllEmbeddings,
  deleteEmbedding,
  enrollFace,
  getFaceCoverage,
  getPipelineStatus,
  listEmbeddings,
  verifyFace,
} from "@/api/face";
import { formatDateTime } from "@/utils/formatters";
import PageHeader from "@/components/dashboard/PageHeader";
import Panel from "@/components/dashboard/Panel";

const { Text, Paragraph } = Typography;
const { Dragger } = Upload;
const MIN_RECOMMENDED_PHOTOS = 3;

type CoverageFilter = "all" | "missing" | "needs_more" | "complete";

export default function FaceRegistry() {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const [students, setStudents] = useState<User[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);
  const [embeddings, setEmbeddings] = useState<FaceEmbedding[]>([]);
  const [coverage, setCoverage] = useState<Record<number, FaceCoverage>>({});
  const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>("all");
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

  const fetchCoverage = useCallback(async () => {
    try {
      const items = await getFaceCoverage();
      setCoverage(Object.fromEntries(items.map((item) => [item.user_id, item])));
    } catch {
      message.error(t("faces.coverageLoadFailed"));
    }
  }, [t]);

  const updateCoverageForStudent = useCallback((userId: number, items: FaceEmbedding[]) => {
    setCoverage((prev) => ({
      ...prev,
      [userId]: {
        user_id: userId,
        embedding_count: items.length,
        latest_embedding_at: items[0]?.created_at ?? prev[userId]?.latest_embedding_at ?? null,
      },
    }));
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
    fetchCoverage();
    fetchStatus();
  }, [fetchCoverage, fetchStudents, fetchStatus]);

  const fetchEmbeddings = useCallback(async (userId: number) => {
    setLoading(true);
    try {
      const items = await listEmbeddings(userId);
      setEmbeddings(items);
      updateCoverageForStudent(userId, items);
    } catch {
      message.error(t("faces.embeddingsLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t, updateCoverageForStudent]);

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
      await fetchEmbeddings(selectedStudent);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      message.error(detail || t("faces.enrollFailed"));
    } finally {
      setEnrolling(false);
    }
  };

  const handleDeleteEmbedding = async (id: number) => {
    try {
      await deleteEmbedding(id);
      message.success(t("faces.embeddingDeleted"));
      if (selectedStudent) await fetchEmbeddings(selectedStudent);
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
      updateCoverageForStudent(selectedStudent, []);
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
    } catch (err: unknown) {
      message.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || t("faces.verifyFailed"));
    } finally {
      setVerifying(false);
    }
  };

  const student = students.find((s) => s.id === selectedStudent);
  const getPhotoCount = useCallback((userId: number) => {
    if (selectedStudent === userId) return embeddings.length;
    return coverage[userId]?.embedding_count ?? 0;
  }, [coverage, embeddings.length, selectedStudent]);

  const filterCounts = useMemo(() => {
    return students.reduce(
      (acc, s) => {
        const count = getPhotoCount(s.id);
        acc.all += 1;
        if (count === 0) acc.missing += 1;
        else if (count < MIN_RECOMMENDED_PHOTOS) acc.needs_more += 1;
        else acc.complete += 1;
        return acc;
      },
      { all: 0, missing: 0, needs_more: 0, complete: 0 }
    );
  }, [getPhotoCount, students]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const count = getPhotoCount(s.id);
      if (coverageFilter === "missing") return count === 0;
      if (coverageFilter === "needs_more") return count > 0 && count < MIN_RECOMMENDED_PHOTOS;
      if (coverageFilter === "complete") return count >= MIN_RECOMMENDED_PHOTOS;
      return true;
    });
  }, [coverageFilter, getPhotoCount, students]);

  const selectStudents = useMemo(() => {
    if (!student || filteredStudents.some((s) => s.id === student.id)) return filteredStudents;
    return [student, ...filteredStudents];
  }, [filteredStudents, student]);

  const getCoverageStatus = useCallback((count: number): Exclude<CoverageFilter, "all"> => {
    if (count === 0) return "missing";
    if (count < MIN_RECOMMENDED_PHOTOS) return "needs_more";
    return "complete";
  }, []);

  const getStatusTone = useCallback((status: CoverageFilter) => {
    if (status === "missing") return token.colorError;
    if (status === "needs_more") return token.colorWarning;
    if (status === "complete") return token.colorSuccess;
    return token.colorPrimary;
  }, [token.colorError, token.colorPrimary, token.colorSuccess, token.colorWarning]);

  const filterOptions = useMemo(() => ([
    { value: "all" as const, label: t("faces.filterAll"), count: filterCounts.all },
    { value: "missing" as const, label: t("faces.filterMissing"), count: filterCounts.missing },
    { value: "needs_more" as const, label: t("faces.filterNeedsMore"), count: filterCounts.needs_more },
    { value: "complete" as const, label: t("faces.filterComplete"), count: filterCounts.complete },
  ]), [filterCounts.all, filterCounts.complete, filterCounts.missing, filterCounts.needs_more, t]);

  const studentOptions = useMemo(() => selectStudents.map((s) => {
    const count = getPhotoCount(s.id);
    const status = getCoverageStatus(count);
    const color = getStatusTone(status);
    return {
      value: s.id,
      searchText: `${s.first_name} ${s.last_name} ${s.email}`,
      label: (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.first_name} {s.last_name}
            </span>
            <span style={{ display: "block", color: token.colorTextTertiary, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.email}
            </span>
          </span>
          <span
            style={{
              flex: "0 0 auto",
              border: `1px solid ${color}`,
              borderRadius: 999,
              color,
              fontSize: 12,
              fontWeight: 700,
              lineHeight: "22px",
              padding: "0 9px",
            }}
          >
            {count}
          </span>
        </div>
      ),
    };
  }), [getCoverageStatus, getPhotoCount, getStatusTone, selectStudents, token.colorTextTertiary]);
  const selectedStatus = getCoverageStatus(embeddings.length);
  const selectedStatusColor = getStatusTone(selectedStatus);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader
        title={t("faces.title")}
        extra={
          <Button icon={<SearchOutlined />} onClick={() => { setVerifyModalOpen(true); setVerifyMatches([]); setVerifyFaceCount(0); }}>
            {t("faces.verifyFace")}
          </Button>
        }
      />

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
          <Panel title={t("faces.enrollFace")}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Text strong>{t("faces.selectStudent")}</Text>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(124px, 1fr))",
                    gap: 8,
                  }}
                >
                  {filterOptions.map((option) => {
                    const active = coverageFilter === option.value;
                    const color = getStatusTone(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setCoverageFilter(option.value)}
                        style={{
                          minHeight: 58,
                          padding: "9px 11px",
                          borderRadius: 8,
                          border: `1px solid ${active ? color : token.colorBorderSecondary}`,
                          background: active ? token.colorFillSecondary : token.colorBgContainer,
                          boxShadow: active ? `inset 0 0 0 1px ${color}` : "none",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "border-color 120ms ease, box-shadow 120ms ease, background 120ms ease",
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ color: token.colorTextSecondary, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {option.label}
                          </span>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flex: "0 0 auto" }} />
                        </span>
                        <span style={{ display: "block", marginTop: 4, color: token.colorText, fontSize: 20, fontWeight: 750, lineHeight: 1 }}>
                          {option.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t("faces.filterResultCount", { shown: filteredStudents.length, total: students.length })}
                </Text>
              </div>
              <Select
                showSearch
                optionFilterProp="searchText"
                optionLabelProp="searchText"
                placeholder={t("faces.searchByNameEmail")}
                value={selectedStudent}
                onChange={setSelectedStudent}
                style={{ width: "100%" }}
                allowClear
                options={studentOptions}
              />

              {student && (
                <div
                  style={{
                    marginTop: 8,
                    padding: 14,
                    border: `1px solid ${token.colorBorderSecondary}`,
                    borderRadius: 8,
                    background: token.colorFillQuaternary,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        background: token.colorBgContainer,
                        border: `1px solid ${token.colorBorderSecondary}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flex: "0 0 auto",
                      }}
                    >
                      <UserOutlined style={{ color: token.colorTextSecondary }} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <Text strong style={{ display: "block" }}>{student.first_name} {student.last_name}</Text>
                      <Text type="secondary" style={{ display: "block", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {student.email}
                      </Text>
                    </div>
                    <span
                      style={{
                        flex: "0 0 auto",
                        border: `1px solid ${selectedStatusColor}`,
                        borderRadius: 999,
                        color: selectedStatusColor,
                        fontSize: 12,
                        fontWeight: 700,
                        lineHeight: "24px",
                        padding: "0 10px",
                      }}
                    >
                      {embeddings.length} {t("faces.photos")}
                    </span>
                  </div>
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
                </div>
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
          </Panel>
        </Col>

        {/* Right: Stored embeddings */}
        <Col xs={24} lg={14}>
          <Panel
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
          </Panel>
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
    </div>
  );
}
