import { useCallback, useEffect, useState } from "react";
import {
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Space,
  Statistic,
  Typography,
  message,
} from "antd";
import {
  BookOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { getMyAttendanceSummary, type CourseAttendanceSummary } from "@/api/attendance";
import { getUnreadCount } from "@/api/notifications";
import { getMyTrends, type StudentTrendPoint } from "@/api/statistics";

const { Title, Text } = Typography;

export default function StudentDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<CourseAttendanceSummary[]>([]);
  const [unread, setUnread] = useState(0);
  const [trends, setTrends] = useState<StudentTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [sum, count, t] = await Promise.all([
        getMyAttendanceSummary(),
        getUnreadCount(),
        getMyTrends(),
      ]);
      setSummary(sum);
      setUnread(count);
      setTrends(t);
    } catch {
      message.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalSessions = summary.reduce((s, c) => s + c.total_sessions, 0);
  const totalPresent = summary.reduce((s, c) => s + c.present_count, 0);
  const totalLate = summary.reduce((s, c) => s + c.late_count, 0);
  const overallRate = totalSessions > 0
    ? Math.round(((totalPresent + totalLate) / totalSessions) * 100)
    : 100;

  return (
    <>
      <Title level={4}>Welcome, {user?.first_name}!</Title>

      {/* Overview cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card loading={loading}>
            <Statistic title="Courses" value={summary.length} prefix={<BookOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={loading}>
            <Statistic
              title="Overall Rate"
              value={overallRate}
              suffix="%"
              valueStyle={{ color: overallRate >= 75 ? "#52c41a" : overallRate >= 50 ? "#fa8c16" : "#ff4d4f" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={loading}>
            <Statistic title="Total Sessions" value={totalSessions} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={loading}>
            <Statistic
              title="Unread Alerts"
              value={unread}
              valueStyle={{ color: unread > 0 ? "#ff4d4f" : undefined }}
            />
          </Card>
        </Col>
      </Row>

      {/* Attendance trend chart */}
      {trends.length > 0 && (
        <Card style={{ marginBottom: 24 }} loading={loading}>
          <Title level={5} style={{ marginTop: 0 }}>Attendance Trend</Title>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart
              data={(() => {
                const grouped: Record<string, { present: number; late: number; absent: number }> = {};
                for (const t of trends) {
                  if (!grouped[t.date]) grouped[t.date] = { present: 0, late: 0, absent: 0 };
                  if (t.status === "present") grouped[t.date].present++;
                  else if (t.status === "late") grouped[t.date].late++;
                  else grouped[t.date].absent++;
                }
                let cumP = 0, cumL = 0, cumA = 0;
                return Object.entries(grouped).sort().map(([date, v]) => {
                  cumP += v.present;
                  cumL += v.late;
                  cumA += v.absent;
                  const total = cumP + cumL + cumA;
                  return {
                    date,
                    rate: total > 0 ? Math.round(((cumP + cumL) / total) * 100) : 100,
                    present: v.present,
                    late: v.late,
                    absent: v.absent,
                  };
                });
              })()}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" fontSize={12} />
              <YAxis domain={[0, 100]} fontSize={12} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(value: number, name: string) => name === "rate" ? `${value}%` : value} />
              <Legend />
              <Area type="monotone" dataKey="rate" name="Cumulative Rate" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Per-course breakdown */}
      <Title level={5}>Course Attendance</Title>
      {!loading && summary.length === 0 ? (
        <Card>
          <Empty description="You are not enrolled in any courses yet, or no attendance has been recorded." />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {summary.map((course) => (
            <Col xs={24} md={12} xl={8} key={course.course_id}>
              <Card
                loading={loading}
                title={
                  <Space>
                    <BookOutlined />
                    <span>{course.course_code}</span>
                  </Space>
                }
                style={{ borderRadius: 8 }}
              >
                <Title level={5} style={{ marginTop: 0 }}>{course.course_name}</Title>

                <Progress
                  percent={course.attendance_rate}
                  status={course.attendance_rate >= 75 ? "success" : course.attendance_rate >= 50 ? "normal" : "exception"}
                  format={(p) => `${p}%`}
                  style={{ marginBottom: 16 }}
                />

                <Row gutter={8}>
                  <Col span={8}>
                    <Statistic
                      title={<Text style={{ fontSize: 12 }}><CheckCircleOutlined /> Present</Text>}
                      value={course.present_count}
                      valueStyle={{ color: "#52c41a", fontSize: 20 }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title={<Text style={{ fontSize: 12 }}><ClockCircleOutlined /> Late</Text>}
                      value={course.late_count}
                      valueStyle={{ color: "#fa8c16", fontSize: 20 }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title={<Text style={{ fontSize: 12 }}><CloseCircleOutlined /> Absent</Text>}
                      value={course.absent_count}
                      valueStyle={{ color: "#ff4d4f", fontSize: 20 }}
                    />
                  </Col>
                </Row>

                <div style={{ marginTop: 12 }}>
                  <Text type="secondary">{course.total_sessions} session(s) recorded</Text>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </>
  );
}
