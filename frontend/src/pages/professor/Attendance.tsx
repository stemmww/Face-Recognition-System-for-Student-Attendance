import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Card,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
  message,
} from "antd";
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
      message.error("Failed to load courses");
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  useEffect(() => {
    if (selectedCourse) {
      listSessions({ course_id: selectedCourse })
        .then(setSessions)
        .catch(() => message.error("Failed to load sessions"));
      setSelectedSession(null);
      setRecords([]);
    } else {
      setSessions([]);
      setRecords([]);
    }
  }, [selectedCourse]);

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
        .catch(() => message.error("Failed to load attendance"))
        .finally(() => setLoading(false));
    } else {
      setRecords([]);
      setSessionDetail(null);
    }
  }, [selectedSession]);

  const handleStatusChange = async (recordId: number, newStatus: string) => {
    try {
      await updateAttendanceStatus(recordId, newStatus);
      message.success("Status updated");
      if (selectedSession) {
        setRecords(await getSessionAttendance(selectedSession));
      }
    } catch {
      message.error("Failed to update status");
    }
  };

  const presentCount = records.filter((r) => r.status === "present").length;
  const lateCount = records.filter((r) => r.status === "late").length;
  const absentCount = records.filter((r) => r.status === "absent").length;

  const columns = [
    {
      title: "Student",
      key: "student",
      render: (_: unknown, r: AttendanceRecord) =>
        r.student_name || `Student #${r.student_id}`,
    },
    {
      title: "Email",
      key: "email",
      render: (_: unknown, r: AttendanceRecord) => (
        <Text type="secondary">{r.student_email}</Text>
      ),
    },
    {
      title: "Status",
      key: "status",
      width: 140,
      render: (_: unknown, r: AttendanceRecord) => (
        <Select
          value={r.status}
          onChange={(v) => handleStatusChange(r.id, v)}
          style={{ width: 120 }}
          options={[
            { value: "present", label: <Tag color="green">Present</Tag> },
            { value: "late", label: <Tag color="orange">Late</Tag> },
            { value: "absent", label: <Tag color="red">Absent</Tag> },
          ]}
        />
      ),
    },
    {
      title: "Recognized At",
      key: "recognized_at",
      width: 120,
      render: (_: unknown, r: AttendanceRecord) =>
        r.recognized_at ? dayjs(r.recognized_at).format("HH:mm:ss") : "—",
    },
    {
      title: "Marked By",
      key: "marked_by",
      width: 100,
      render: (_: unknown, r: AttendanceRecord) => (
        <Tag>{r.marked_by}</Tag>
      ),
    },
  ];

  return (
    <>
      <Title level={4}>Attendance Records</Title>

      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          showSearch
          optionFilterProp="label"
          placeholder="Select course"
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
          placeholder="Select session"
          value={selectedSession}
          onChange={setSelectedSession}
          allowClear
          disabled={!selectedCourse}
          style={{ width: 300 }}
          options={sessions.map((s) => ({
            value: s.id,
            label: `${s.date} (${s.status === "active" ? "Active" : "Completed"})`,
          }))}
        />
      </Space>

      {selectedSession && records.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <Space wrap>
            <Tag color="green">{presentCount} Present</Tag>
            <Tag color="orange">{lateCount} Late</Tag>
            <Tag color="red">{absentCount} Absent</Tag>
            <Text type="secondary">{records.length} total</Text>
          </Space>
          <Space wrap>
            <Segmented
              value={viewMode}
              onChange={(v) => setViewMode(v as string)}
              options={[
                { value: "table", icon: <UnorderedListOutlined />, label: "Table" },
                { value: "timeline", icon: <OrderedListOutlined />, label: "Timeline" },
              ]}
            />
            {selectedSession && (
              <Button
                icon={<DownloadOutlined />}
                onClick={() => exportSessionCSV(selectedSession).catch(() => message.error("Export failed"))}
              >
                Export Session
              </Button>
            )}
            {selectedCourse && (
              <Button
                icon={<DownloadOutlined />}
                onClick={() => exportCourseCSV(selectedCourse).catch(() => message.error("Export failed"))}
              >
                Export Course
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
          pagination={{ pageSize: 20, showTotal: (t) => `${t} records` }}
          locale={{ emptyText: selectedSession ? "No attendance records" : "Select a course and session" }}
        />
      ) : (
        <Card loading={loading}>
          {records.length === 0 ? (
            <Text type="secondary">{selectedSession ? "No attendance records" : "Select a course and session"}</Text>
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

                const items = [];

                if (sessionStart) {
                  items.push({
                    color: "#6366f1" as string,
                    children: (
                      <div>
                        <Text strong>Session Started</Text>
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
                          {r.status}
                        </Tag>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {time ? time.format("HH:mm:ss") : "Not recognized"}
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
                    color: "#6366f1" as string,
                    children: (
                      <div>
                        <Text strong>Session Ended</Text>
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
