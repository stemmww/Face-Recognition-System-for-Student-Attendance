import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { AttendanceRecord, AttendanceSession, Course } from "@/types";
import { listCourses } from "@/api/courses";
import { listSessions } from "@/api/sessions";
import { exportCourseCSV, exportSessionCSV, getSessionAttendance, updateAttendanceStatus } from "@/api/attendance";

const { Title, Text } = Typography;

export default function ProfessorAttendance() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const [selectedSession, setSelectedSession] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

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
      getSessionAttendance(selectedSession)
        .then(setRecords)
        .catch(() => message.error("Failed to load attendance"))
        .finally(() => setLoading(false));
    } else {
      setRecords([]);
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <Space>
            <Tag color="green">{presentCount} Present</Tag>
            <Tag color="orange">{lateCount} Late</Tag>
            <Tag color="red">{absentCount} Absent</Tag>
            <Text type="secondary">{records.length} total</Text>
          </Space>
          <Space>
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

      <Table
        dataSource={records}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, showTotal: (t) => `${t} records` }}
        locale={{ emptyText: selectedSession ? "No attendance records" : "Select a course and session" }}
      />
    </>
  );
}
