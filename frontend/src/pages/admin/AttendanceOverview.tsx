import { useCallback, useEffect, useState } from "react";
import {
  Card,
  Col,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import dayjs from "dayjs";
import type { AttendanceSession, Course } from "@/types";
import { listCourses } from "@/api/courses";
import { listSessions } from "@/api/sessions";

const { Title } = Typography;

export default function AttendanceOverview() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const fetchCourses = useCallback(async () => {
    try {
      setCourses(await listCourses());
    } catch {
      message.error("Failed to load courses");
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = selectedCourse ? { course_id: selectedCourse } : {};
      setSessions(await listSessions(params));
    } catch {
      message.error("Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, [selectedCourse]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const activeSessions = sessions.filter((s) => s.status === "active");
  const completedSessions = sessions.filter((s) => s.status === "completed");

  const columns = [
    { title: "ID", dataIndex: "id", key: "id", width: 60 },
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 120,
    },
    {
      title: "Started",
      key: "started_at",
      width: 100,
      render: (_: unknown, r: AttendanceSession) => dayjs(r.started_at).format("HH:mm"),
    },
    {
      title: "Ended",
      key: "ended_at",
      width: 100,
      render: (_: unknown, r: AttendanceSession) =>
        r.ended_at ? dayjs(r.ended_at).format("HH:mm") : "—",
    },
    {
      title: "Status",
      key: "status",
      width: 100,
      render: (_: unknown, r: AttendanceSession) => (
        <Tag color={r.status === "active" ? "green" : "default"}>
          {r.status === "active" ? "Active" : "Completed"}
        </Tag>
      ),
    },
  ];

  return (
    <>
      <Title level={4}>Attendance Overview</Title>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Total Sessions" value={sessions.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active Now"
              value={activeSessions.length}
              valueStyle={{ color: activeSessions.length > 0 ? "#52c41a" : undefined }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Completed" value={completedSessions.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Courses" value={courses.length} />
          </Card>
        </Col>
      </Row>

      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder="Filter by course"
          value={selectedCourse}
          onChange={setSelectedCourse}
          allowClear
          style={{ width: 300 }}
          options={courses.map((c) => ({
            value: c.id,
            label: `${c.code} — ${c.name}`,
          }))}
        />
      </Space>

      <Table
        dataSource={sessions}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 15, showTotal: (t) => `${t} sessions` }}
      />
    </>
  );
}
