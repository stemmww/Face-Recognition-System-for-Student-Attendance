import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Image,
  Input,
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
  ArrowRightOutlined,
  CameraOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  SearchOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { FaceEmbedding, FaceRegistryCounts, FaceRegistryStudent, FaceVerifyMatch, Group, PipelineStatus } from "@/types";
import { listGroups } from "@/api/groups";
import {
  deleteAllEmbeddings,
  deleteEmbedding,
  enrollFace,
  getPipelineStatus,
  listFaceRegistryStudents,
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
type GroupTypeFilter = "ALL" | Group["group_type"];
type GroupOption = {
  value: number;
  label: string;
  searchText: string;
  group: Group;
};

export default function FaceRegistry() {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const [students, setStudents] = useState<FaceRegistryStudent[]>([]);
  const [studentTotal, setStudentTotal] = useState(0);
  const [filterCounts, setFilterCounts] = useState<FaceRegistryCounts>({
    all: 0,
    missing: 0,
    needs_more: 0,
    complete: 0,
  });
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>();
  const [groupTypeFilter, setGroupTypeFilter] = useState<GroupTypeFilter>("ALL");
  const [groupMajorFilter, setGroupMajorFilter] = useState<string>("ALL");
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);
  const [embeddings, setEmbeddings] = useState<FaceEmbedding[]>([]);
  const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const embeddingsRequestRef = useRef(0);

  // Verify state
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyMatches, setVerifyMatches] = useState<FaceVerifyMatch[]>([]);
  const [verifyFaceCount, setVerifyFaceCount] = useState(0);

  const fetchGroups = useCallback(async () => {
    try {
      const items = await listGroups({ active_only: true });
      setGroups(items);
    } catch {
      message.error(t("faces.groupsLoadFailed"));
    }
  }, [t]);

  const updateCoverageForStudent = useCallback((userId: number, items: FaceEmbedding[]) => {
    setStudents((prev) => prev.map((student) => (
      student.id === userId
        ? {
          ...student,
          embedding_count: items.length,
          latest_embedding_at: items[0]?.created_at ?? null,
        }
        : student
    )));
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
    fetchGroups();
    fetchStatus();
  }, [fetchGroups, fetchStatus]);

  const fetchRegistryStudents = useCallback(async () => {
    setStudentsLoading(true);
    try {
      const result = await listFaceRegistryStudents({
        group_id: selectedGroupId,
        status: coverageFilter,
        search: searchQuery.trim() || undefined,
        limit: 200,
        offset: 0,
      });
      setStudents(result.items);
      setFilterCounts(result.counts);
      setStudentTotal(result.filtered_total);
    } catch {
      message.error(t("faces.loadFailed"));
    } finally {
      setStudentsLoading(false);
    }
  }, [coverageFilter, searchQuery, selectedGroupId, t]);

  useEffect(() => {
    fetchRegistryStudents();
  }, [fetchRegistryStudents]);

  const fetchEmbeddings = useCallback(async (userId: number) => {
    const requestId = ++embeddingsRequestRef.current;
    setLoading(true);
    try {
      const items = await listEmbeddings(userId);
      if (requestId !== embeddingsRequestRef.current) return;
      setEmbeddings(items);
      updateCoverageForStudent(userId, items);
    } catch {
      if (requestId === embeddingsRequestRef.current) {
        message.error(t("faces.embeddingsLoadFailed"));
      }
    } finally {
      if (requestId === embeddingsRequestRef.current) {
        setLoading(false);
      }
    }
  }, [t, updateCoverageForStudent]);

  useEffect(() => {
    if (selectedStudent) fetchEmbeddings(selectedStudent);
    else {
      embeddingsRequestRef.current += 1;
      setEmbeddings([]);
      setLoading(false);
    }
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
      await fetchRegistryStudents();
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
      await fetchRegistryStudents();
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
      await fetchRegistryStudents();
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

  const handleSelectStudent = useCallback((userId: number | null) => {
    embeddingsRequestRef.current += 1;
    setSelectedStudent(userId);
    setEmbeddings([]);
    setLoading(userId !== null);
  }, []);

  const handleGroupChange = useCallback((groupId?: number) => {
    setSelectedGroupId(groupId);
    setSearchQuery("");
  }, []);

  const availableMajorOptions = useMemo(() => {
    const majors = new Map<string, string>();
    for (const group of groups) {
      if (group.major) majors.set(group.major, group.major_name || group.major);
    }
    return [...majors.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, label]) => ({ value, label }));
  }, [groups]);

  const filteredGroups = useMemo(() => (
    groups.filter((group) => {
      if (groupTypeFilter !== "ALL" && group.group_type !== groupTypeFilter) return false;
      if (groupMajorFilter !== "ALL" && group.major !== groupMajorFilter) return false;
      return true;
    })
  ), [groupMajorFilter, groupTypeFilter, groups]);

  useEffect(() => {
    if (!selectedGroupId) return;
    if (!filteredGroups.some((group) => group.id === selectedGroupId)) {
      handleGroupChange(undefined);
    }
  }, [filteredGroups, handleGroupChange, selectedGroupId]);

  useEffect(() => {
    if (studentsLoading || !selectedStudent) return;
    if (!students.some((s) => s.id === selectedStudent)) {
      handleSelectStudent(null);
    }
  }, [handleSelectStudent, selectedStudent, students, studentsLoading]);

  const student = students.find((s) => s.id === selectedStudent);
  const getPhotoCount = useCallback((userId: number) => {
    return students.find((s) => s.id === userId)?.embedding_count ?? 0;
  }, [students]);

  const filteredStudents = students;

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

  const getStatusLabel = useCallback((status: Exclude<CoverageFilter, "all">) => {
    if (status === "missing") return t("faces.filterMissing");
    if (status === "needs_more") return t("faces.filterNeedsMore");
    return t("faces.filterComplete");
  }, [t]);

  const queuedStudents = filteredStudents;

  const incompleteStudents = useMemo(() => (
    queuedStudents.filter((s) => getPhotoCount(s.id) < MIN_RECOMMENDED_PHOTOS)
  ), [getPhotoCount, queuedStudents]);

  const handleSelectNextIncomplete = useCallback(() => {
    if (incompleteStudents.length === 0) {
      message.info(t("faces.noIncompleteStudents"));
      return;
    }

    const currentIndex = selectedStudent
      ? incompleteStudents.findIndex((s) => s.id === selectedStudent)
      : -1;
    const next = incompleteStudents[(currentIndex + 1) % incompleteStudents.length];
    handleSelectStudent(next.id);
  }, [handleSelectStudent, incompleteStudents, selectedStudent, t]);

  const filterOptions = useMemo(() => ([
    { value: "all" as const, label: t("faces.filterAll"), count: filterCounts.all },
    { value: "missing" as const, label: t("faces.filterMissing"), count: filterCounts.missing },
    { value: "needs_more" as const, label: t("faces.filterNeedsMore"), count: filterCounts.needs_more },
    { value: "complete" as const, label: t("faces.filterComplete"), count: filterCounts.complete },
  ]), [filterCounts.all, filterCounts.complete, filterCounts.missing, filterCounts.needs_more, t]);
  const groupOptions = useMemo<GroupOption[]>(() => (
    filteredGroups.map((g) => ({
      value: g.id,
      label: g.name,
      searchText: [
        g.name,
        g.code,
        g.major,
        g.major_name,
        g.group_type,
        g.semester,
        String(g.current_study_year || ""),
      ].filter(Boolean).join(" "),
      group: g,
    }))
  ), [filteredGroups]);

  const selectedPhotoCount = selectedStudent ? getPhotoCount(selectedStudent) : 0;
  const selectedStatus = getCoverageStatus(selectedPhotoCount);
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
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Select
                  value={groupTypeFilter}
                  onChange={setGroupTypeFilter}
                  style={{ flex: "0 0 132px" }}
                  options={[
                    { value: "ALL", label: t("groups.allTypes") },
                    { value: "MAIN", label: t("groups.type_MAIN") },
                    { value: "ELECTIVE", label: t("groups.type_ELECTIVE") },
                  ]}
                />
                <Select
                  value={groupMajorFilter}
                  onChange={setGroupMajorFilter}
                  showSearch
                  optionFilterProp="label"
                  style={{ flex: "1 1 180px", minWidth: 180 }}
                  options={[
                    { value: "ALL", label: t("groups.allMajors") },
                    ...availableMajorOptions,
                  ]}
                />
              </div>
              <Select
                value={selectedGroupId}
                onChange={handleGroupChange}
                allowClear
                showSearch
                optionFilterProp="searchText"
                loading={studentsLoading}
                placeholder={t("faces.allGroups")}
                style={{ width: "100%" }}
                options={groupOptions}
                optionRender={(option) => {
                  const data = option.data as GroupOption;
                  const group = data.group;
                  const isMain = group.group_type === "MAIN";
                  const meta = [
                    isMain ? group.major_name : t("groups.type_ELECTIVE"),
                    isMain && group.current_study_year > 0 ? `${t("groups.year")} ${group.current_study_year}` : undefined,
                    `${group.student_count} ${t("groups.students").toLowerCase()}`,
                  ].filter(Boolean).join(" - ");
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <Text strong>{group.name}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{meta}</Text>
                    </div>
                  );
                }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t("groups.filterResultCount", { shown: filteredGroups.length, total: groups.length })}
              </Text>
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
                  {t("faces.filterResultCount", { shown: filteredStudents.length, total: studentTotal })}
                </Text>
              </div>
              <Input
                prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
                placeholder={t("faces.searchByNameEmail")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                allowClear
              />

              <div
                style={{
                  border: `1px solid ${token.colorBorderSecondary}`,
                  borderRadius: 8,
                  overflow: "hidden",
                  background: token.colorBgContainer,
                }}
              >
                <div
                  style={{
                    minHeight: 42,
                    padding: "10px 12px",
                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <Text strong style={{ display: "block", fontSize: 13 }}>{t("faces.enrollmentQueue")}</Text>
                    <Text type="secondary" style={{ display: "block", fontSize: 12 }}>
                      {t("faces.filterResultCount", { shown: queuedStudents.length, total: studentTotal })}
                    </Text>
                  </div>
                  <Button
                    size="small"
                    icon={<ArrowRightOutlined />}
                    onClick={handleSelectNextIncomplete}
                    disabled={incompleteStudents.length === 0}
                  >
                    {t("faces.nextIncomplete")}
                  </Button>
                </div>
                {queuedStudents.length === 0 ? (
                  <div style={{ padding: 16 }}>
                    <Text type="secondary">{t("faces.noStudentsForFilter")}</Text>
                  </div>
                ) : (
                  <div style={{ maxHeight: 300, overflowY: "auto" }}>
                    {queuedStudents.map((s) => {
                      const count = getPhotoCount(s.id);
                      const status = getCoverageStatus(count);
                      const color = getStatusTone(status);
                      const active = selectedStudent === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleSelectStudent(s.id)}
                          style={{
                            width: "100%",
                            minHeight: 64,
                            padding: "10px 12px",
                            border: 0,
                            borderBottom: `1px solid ${token.colorBorderSecondary}`,
                            background: active ? token.colorFillSecondary : token.colorBgContainer,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            textAlign: "left",
                          }}
                        >
                          <span
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: "50%",
                              background: active ? token.colorBgContainer : token.colorFillQuaternary,
                              border: `1px solid ${color}`,
                              color,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flex: "0 0 auto",
                            }}
                          >
                            {status === "complete" ? (
                              <CheckCircleOutlined />
                            ) : status === "missing" ? (
                              <CloseCircleOutlined />
                            ) : (
                              <CameraOutlined />
                            )}
                          </span>
                          <span style={{ minWidth: 0, flex: 1 }}>
                            <span style={{ display: "block", color: token.colorText, fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {s.first_name} {s.last_name}
                            </span>
                            <span style={{ display: "block", color: token.colorTextTertiary, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {s.email}
                            </span>
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
                            <span
                              style={{
                                borderRadius: 999,
                                background: token.colorFillQuaternary,
                                color,
                                fontSize: 12,
                                fontWeight: 700,
                                lineHeight: "24px",
                                padding: "0 9px",
                              }}
                            >
                              {getStatusLabel(status)}
                            </span>
                            <span style={{ color: token.colorTextSecondary, fontSize: 12, minWidth: 34, textAlign: "right" }}>
                              {count}/{MIN_RECOMMENDED_PHOTOS}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

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
                      {selectedPhotoCount} {t("faces.photos")}
                    </span>
                  </div>
                  {selectedPhotoCount < 3 && (
                    <Alert
                      type="warning"
                      message={t("faces.photosRecommend", { count: selectedPhotoCount })}
                      showIcon
                      style={{ marginTop: 8 }}
                    />
                  )}
                  {selectedPhotoCount >= 3 && selectedPhotoCount <= 5 && (
                    <Alert
                      type="success"
                      message={t("faces.photosGood", { count: selectedPhotoCount })}
                      showIcon
                      style={{ marginTop: 8 }}
                    />
                  )}
                  {selectedPhotoCount > 5 && (
                    <Alert
                      type="info"
                      message={t("faces.photosSufficient", { count: selectedPhotoCount })}
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
