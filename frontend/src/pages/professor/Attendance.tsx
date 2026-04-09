import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Card,
  Input,
  Popover,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  message,
} from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import type { AttendanceRecord, AttendanceSession, Course } from "@/types";
import { listCourses } from "@/api/courses";
import { getSession, listSessions } from "@/api/sessions";
import { exportCourseCSV, exportSessionCSV, getSessionAttendance, updateAttendanceStatus } from "@/api/attendance";

const { Title, Text } = Typography;

export default function ProfessorAttendance() {
  const { t } = useTranslation();

  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const [selectedSession, setSelectedSession] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<string>("table");
  const [sessionDetail, setSessionDetail] = useState<AttendanceSession | null>(null);

  const fetchCourses = useCallback(async () => {
    try {
      setCourses(await listCourses());
    } catch {
      message.error(t("coursesPage.loadFailed"));
    }
  }, [t]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  useEffect(() => {
    if (selectedCourse) {
      listSessions({ course_id: selectedCourse })
        .then(setSessions)
        .catch(() => message.error(t("session.loadFailed")));
      setSelectedSession(null);
      setRecords([]);
    } else {
      setSessions([]);
      setRecords([]);
    }
  }, [selectedCourse, t]);

  useEffect(() => {
    if (selectedSession) {
      setLoading(true);
      Promise.all([
        getSessionAttendance(selectedSession),
        getSession(selectedSession),
      ])
        .then(([recs, sess]) => {
          setRecords(recs);
          setSessionDetail(sess);
        })
        .catch(() => message.error(t("attendance.loadFailed")))
        .finally(() => setLoading(false));
    } else {
      setRecords([]);
      setSessionDetail(null);
    }
  }, [selectedSession, t]);

  const [editingRecord, setEditingRecord] = useState<number | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string>("");
  const [pendingReason, setPendingReason] = useState<string>("");

  const handleStatusSelect = (recordId: number, newStatus: string) => {
    setEditingRecord(recordId);
    setPendingStatus(newStatus);
    setPendingReason("");
  };

  const handleStatusConfirm = async () => {
    if (!editingRecord) return;
    try {
      await updateAttendanceStatus(editingRecord, pendingStatus, pendingReason || undefined);
      message.success(t("attendance.statusUpdated"));
      setEditingRecord(null);
      setPendingReason("");
      if (selectedSession) {
        setRecords(await getSessionAttendance(selectedSession));
      }
    } catch {
      message.error(t("attendance.updateFailed"));
    }
  };

  const presentCount = records.filter((r) => r.status === "present").length;
  const lateCount = records.filter((r) => r.status === "late").length;
  const absentCount = records.filter((r) => r.status === "absent").length;

  const columns = [
    {
      title: t("attendance.studentCol"),
      key: "student",
      render: (_: unknown, r: AttendanceRecord) =>
        r.student_name || `Student #${r.student_id}`,
    },
    {
      title: t("attendance.emailCol"),
      key: "email",
      render: (_: unknown, r: AttendanceRecord) => (
        <Text type="secondary">{r.student_email}</Text>
      ),
    },
    {
      title: t("common.status"),
      key: "status",
      width: 200,
      render: (_: unknown, r: AttendanceRecord) => (
        <Space>
          <Popover
            open={editingRecord === r.id}
            onOpenChange={(open) => { if (!open) setEditingRecord(null); }}
            trigger="click"
            content={
              <div style={{ width: 240 }}>
                <Input.TextArea
                  placeholder={t("attendance.reasonPlaceholder")}
                  value={pendingReason}
                  onChange={(e) => setPendingReason(e.target.value)}
                  rows={2}
                  maxLength={500}
                  style={{ marginBottom: 8 }}
                />
                <Space>
                  <Button size="small" onClick={() => setEditingRecord(null)}>{t("common.cancel")}</Button>
                  <Button size="small" type="primary" onClick={handleStatusConfirm}>{t("common.save")}</Button>
                </Space>
              </div>
            }
            title={t("attendance.reasonTitle")}
          >
            <Select
              value={r.status}
              onChange={(v) => handleStatusSelect(r.id, v)}
              style={{ width: 120 }}
              options={[
                { value: "present", label: <Tag color="green">{t("common.present")}</Tag> },
                { value: "late", label: <Tag color="orange">{t("common.late")}</Tag> },
                { value: "absent", label: <Tag color="red">{t("common.absent")}</Tag> },
              ]}
            />
          </Popover>
          {r.override_reason && (
            <Tooltip title={r.override_reason}>
              <InfoCircleOutlined style={{ color: "#1677ff", cursor: "pointer" }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: t("attendance.recognizedAt"),
      key: "recognized_at",
      width: 120,
      render: (_: unknown, r: AttendanceRecord) =>
        r.recognized_at ? dayjs(r.recognized_at).format("HH:mm:ss") : "—",
    },
    {
      title: t("attendance.markedBy"),
      key: "marked_by",
      width: 100,
      render: (_: unknown, r: AttendanceRecord) => (
        <Tag>{r.marked_by}</Tag>
      ),
    },
  ];

  return (
    <>
      <Title level={4}>{t("attendance.title")}</Title>

      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          showSearch
          optionFilterProp="label"
          placeholder={t("common.selectCourse")}
          value={selectedCourse}
          onChange={(v) => setSelectedCourse(v)}
          allowClear
          style={{ width: 300 }}
          options={courses.map((c) => ({
            value: c.id,
            label: `${c.code} — ${c.name}`,
          }))}
        />
        <Select
          placeholder={t("common.selectSession")}
          value={selectedSession}
          onChange={setSelectedSession}
          allowClear
          disabled={!selectedCourse}
          style={{ width: 300 }}
          options={sessions.map((s) => ({
            value: s.id,
            label: `${s.date} (${s.status === "active" ? t("common.active") : t("common.completed")})`,
          }))}
        />
      </Space>

      {selectedSession && records.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <Space wrap>
            <Tag color="green">{presentCount} {t("common.present")}</Tag>
            <Tag color="orange">{lateCount} {t("common.late")}</Tag>
            <Tag color="red">{absentCount} {t("common.absent")}</Tag>
            <Text type="secondary">{records.length} {t("common.total")}</Text>
          </Space>
          <Space wrap>
            <Segmented
              value={viewMode}
              onChange={(v) => setViewMode(v as string)}
              options={[
                { value: "table", icon: <UnorderedListOutlined />, label: t("attendance.tableView") },
                { value: "timeline", icon: <OrderedListOutlined />, label: t("attendance.timelineView") },
              ]}
            />
            {selectedSession && (
              <Button
                icon={<DownloadOutlined />}
                onClick={() => exportSessionCSV(selectedSession).catch(() => message.error(t("attendance.exportFailed")))}
              >
                {t("attendance.exportSession")}
              </Button>
            )}
            {selectedCourse && (
              <Button
                icon={<DownloadOutlined />}
                onClick={() => exportCourseCSV(selectedCourse).catch(() => message.error(t("attendance.exportFailed")))}
              >
                {t("attendance.exportCourse")}
              </Button>
            )}
          </Space>
        </div>
      )}

      {viewMode === "table" ? (
        <Table
          dataSource={records}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showTotal: (total) => `${total} ${t("common.total")}` }}
          locale={{ emptyText: selectedSession ? t("attendance.noRecords") : t("attendance.selectCourseAndSession") }}
        />
      ) : (
        <Card loading={loading}>
          {records.length === 0 ? (
            <Text type="secondary">{selectedSession ? t("attendance.noRecords") : t("attendance.selectCourseAndSession")}</Text>
          ) : (
            <Timeline
              items={(() => {
                const sessionStart = sessionDetail?.started_at ? dayjs(sessionDetail.started_at) : null;
                const sorted = [...records]
                  .sort((a, b) => {
                    if (!a.recognized_at && !b.recognized_at) return 0;
                    if (!a.recognized_at) return 1;
                    if (!b.recognized_at) return -1;
                    return dayjs(a.recognized_at).diff(dayjs(b.recognized_at));
                  });

                const statusIcon = (status: string) => {
                  if (status === "present") return <CheckCircleOutlined style={{ color: "#52c41a" }} />;
                  if (status === "late") return <ClockCircleOutlined style={{ color: "#fa8c16" }} />;
                  return <CloseCircleOutlined style={{ color: "#ff4d4f" }} />;
                };

                const statusColor = (status: string) => {
                  if (status === "present") return "green";
                  if (status === "late") return "#fa8c16";
                  return "red";
                };

                const statusLabel = (status: string) => {
                  if (status === "present") return t("common.present");
                  if (status === "late") return t("common.late");
                  return t("common.absent");
                };

                const items = [];

                if (sessionStart) {
                  items.push({
                    color: "#2323CE" as string,
                    children: (
                      <div>
                        <Text strong>{t("attendance.sessionStarted")}</Text>
                        <br />
                        <Text type="secondary">{sessionStart.format("HH:mm:ss")}</Text>
                      </div>
                    ),
                  });
                }

                for (const r of sorted) {
                  const time = r.recognized_at ? dayjs(r.recognized_at) : null;
                  const delay = time && sessionStart ? Math.round(time.diff(sessionStart, "second") / 60) : null;

                  items.push({
                    dot: statusIcon(r.status),
                    color: statusColor(r.status),
                    children: (
                      <div>
                        <Text strong>{r.student_name || `Student #${r.student_id}`}</Text>
                        <Tag color={r.status === "present" ? "green" : r.status === "late" ? "orange" : "red"} style={{ marginLeft: 8 }}>
                          {statusLabel(r.status)}
                        </Tag>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {time ? time.format("HH:mm:ss") : t("attendance.notRecognized")}
                          {delay !== null && ` (+${delay} min)`}
                          {" · "}
                          {r.marked_by}
                        </Text>
                      </div>
                    ),
                  });
                }

                if (sessionDetail?.ended_at) {
                  items.push({
                    color: "#2323CE" as string,
                    children: (
                      <div>
                        <Text strong>{t("attendance.sessionEnded")}</Text>
                        <br />
                        <Text type="secondary">{dayjs(sessionDetail.ended_at).format("HH:mm:ss")}</Text>
                      </div>
                    ),
                  });
                }

                return items;
              })()}
            />
          )}
        </Card>
      )}
    </>
  );
}
