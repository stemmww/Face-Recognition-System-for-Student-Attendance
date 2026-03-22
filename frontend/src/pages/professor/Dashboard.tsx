import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  Col,
  Row,
  Select,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import {
  BookOutlined,
  CalendarOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useAuth } from "@/hooks/useAuth";
import type { Course, AttendanceSession } from "@/types";
import { listCourses } from "@/api/courses";
import { listSessions } from "@/api/sessions";
import { listAppeals } from "@/api/appeals";
import { getCourseTrends, type SessionTrendPoint } from "@/api/statistics";

const { Title, Text } = Typography;

export default function ProfessorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [pendingAppeals, setPendingAppeals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [trendCourse, setTrendCourse] = useState<number | undefined>(undefined);
  const [trendData, setTrendData] = useState<SessionTrendPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [c, s, a] = await Promise.all([
        listCourses(),
        listSessions(),
        listAppeals("pending"),
      ]);
      setCourses(c);
      setSessions(s);
      setPendingAppeals(a.length);
    } catch {
      message.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (trendCourse) {
      setTrendLoading(true);
      getCourseTrends(trendCourse)
        .then(setTrendData)
        .catch(() => message.error("Failed to load trends"))
        .finally(() => setTrendLoading(false));
    } else {
      setTrendData([]);
    }
  }, [trendCourse]);

  // Auto-select first course for trends
  useEffect(() => {
    if (courses.length > 0 && !trendCourse) {
      setTrendCourse(courses[0].id);
    }
  }, [courses, trendCourse]);

  const activeSessions = sessions.filter((s) => s.status === "active");
  const recentSessions = sessions.slice(0, 5);

  const sessionColumns = [
    { title: "ID", dataIndex: "id", width: 60 },
    { title: "Date", dataIndex: "date", width: 120 },
    {
      title: "Status",
      dataIndex: "status",
      width: 100,
      render: (s: string) => (
        <Tag color={s === "active" ? "green" : "default"}>
          {s.charAt(0).toUpperCase() + s.slice(1)}
        </Tag>
      ),
    },
  ];

  return (
    <>
      <Title level={4}>Welcome, {user?.first_name}!</Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card loading={loading} hoverable onClick={() => navigate("/courses")}>
            <Statistic title="My Courses" value={courses.length} prefix={<BookOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={loading} hoverable onClick={() => navigate("/sessions")}>
            <Statistic
              title="Active Sessions"
              value={activeSessions.length}
              prefix={<PlayCircleOutlined />}
              valueStyle={{ color: activeSessions.length > 0 ? "#52c41a" : undefined }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={loading} hoverable onClick={() => navigate("/sessions")}>
            <Statistic title="Total Sessions" value={sessions.length} prefix={<CalendarOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={loading} hoverable onClick={() => navigate("/appeals-review")}>
            <Statistic
              title="Pending Appeals"
              value={pendingAppeals}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: pendingAppeals > 0 ? "#ff4d4f" : undefined }}
            />
          </Card>
        </Col>
      </Row>

      {/* Attendance trend chart */}
      <Card
        title="Attendance Trends"
        extra={
          <Select
            value={trendCourse}
            onChange={setTrendCourse}
            style={{ width: 240 }}
            options={courses.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
          />
        }
        loading={trendLoading}
        style={{ marginBottom: 24 }}
      >
        {trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="present" name="Present" fill="#52c41a" stackId="a" />
              <Bar dataKey="late" name="Late" fill="#fa8c16" stackId="a" />
              <Bar dataKey="absent" name="Absent" fill="#ff4d4f" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Text type="secondary">No attendance data for this course yet</Text>
        )}
      </Card>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title="Recent Sessions" loading={loading}>
            {recentSessions.length === 0 ? (
              <Text type="secondary">No sessions yet</Text>
            ) : (
              <Table
                dataSource={recentSessions}
                columns={sessionColumns}
                rowKey="id"
                pagination={false}
                size="small"
              />
            )}
            <Button type="link" onClick={() => navigate("/sessions")} style={{ marginTop: 8 }}>
              View all sessions
            </Button>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Quick Actions" loading={loading}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => navigate("/sessions")}>
                Start Live Session
              </Button>
              <Button icon={<BookOutlined />} onClick={() => navigate("/attendance")}>
                View Attendance Records
              </Button>
              <Button icon={<CalendarOutlined />} onClick={() => navigate("/statistics")}>
                View Statistics
              </Button>
              <Button icon={<FileTextOutlined />} onClick={() => navigate("/appeals-review")}>
                Review Appeals {pendingAppeals > 0 && <Tag color="red" style={{ marginLeft: 8 }}>{pendingAppeals}</Tag>}
              </Button>
            </div>
          </Card>
        </Col>
      </Row>
    </>
  );
}
