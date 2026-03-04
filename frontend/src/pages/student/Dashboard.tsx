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
import { useAuth } from "@/hooks/useAuth";
import { getMyAttendanceSummary, type CourseAttendanceSummary } from "@/api/attendance";
import { getUnreadCount } from "@/api/notifications";

const { Title, Text } = Typography;

export default function StudentDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<CourseAttendanceSummary[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [sum, count] = await Promise.all([getMyAttendanceSummary(), getUnreadCount()]);
      setSummary(sum);
      setUnread(count);
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
