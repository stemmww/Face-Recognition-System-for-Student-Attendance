import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
  FireOutlined,
  TrophyOutlined,
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
import type { CourseAttendanceSummary, StudentTrendPoint } from "@/types";
import { getMyAttendanceSummary } from "@/api/attendance";
import { getUnreadCount } from "@/api/notifications";
import { getMyTrends } from "@/api/statistics";

const { Title, Text } = Typography;

export default function StudentDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [summary, setSummary] = useState<CourseAttendanceSummary[]>([]);
  const [unread, setUnread] = useState(0);
  const [trends, setTrends] = useState<StudentTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [sum, count, tr] = await Promise.all([
        getMyAttendanceSummary(),
        getUnreadCount(),
        getMyTrends(),
      ]);
      setSummary(sum);
      setUnread(count);
      setTrends(tr);
    } catch {
      message.error(t("dashboard.failedToLoad"));
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
  const bestCurrentStreak = summary.reduce((max, c) => Math.max(max, c.current_streak), 0);

  return (
    <>
      <Title level={4}>{t("dashboard.welcomeUser", { name: user?.first_name })}</Title>

      {/* Overview cards */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <Card loading={loading} style={{ flex: "1 1 0", minWidth: 140 }}>
          <Statistic title={t("nav.courses")} value={summary.length} prefix={<BookOutlined />} />
        </Card>
        <Card loading={loading} style={{ flex: "1 1 0", minWidth: 140 }}>
          <Statistic
            title={t("dashboard.overallRate")}
            value={overallRate}
            suffix="%"
            valueStyle={{ color: overallRate >= 75 ? "#52c41a" : overallRate >= 50 ? "#fa8c16" : "#ff4d4f" }}
          />
        </Card>
        <Card loading={loading} style={{ flex: "1 1 0", minWidth: 140 }}>
          <Statistic title={t("dashboard.totalSessions")} value={totalSessions} />
        </Card>
        <Card loading={loading} style={{ flex: "1 1 0", minWidth: 140 }}>
          <Statistic
            title={t("dashboard.unreadAlerts")}
            value={unread}
            valueStyle={{ color: unread > 0 ? "#ff4d4f" : undefined }}
          />
        </Card>
        <Card loading={loading} style={{ flex: "1 1 0", minWidth: 140 }}>
          <Statistic
            title={t("dashboard.bestStreak")}
            value={bestCurrentStreak}
            prefix={<FireOutlined />}
            valueStyle={{ color: bestCurrentStreak > 0 ? "#fa541c" : undefined }}
          />
        </Card>
      </div>

      {/* Attendance trend chart */}
      {trends.length > 0 && (
        <Card style={{ marginBottom: 24 }} loading={loading}>
          <Title level={5} style={{ marginTop: 0 }}>{t("dashboard.attendanceTrend")}</Title>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart
              data={(() => {
                const grouped: Record<string, { present: number; late: number; absent: number }> = {};
                for (const tr of trends) {
                  if (!grouped[tr.date]) grouped[tr.date] = { present: 0, late: 0, absent: 0 };
                  if (tr.status === "present") grouped[tr.date].present++;
                  else if (tr.status === "late") grouped[tr.date].late++;
                  else grouped[tr.date].absent++;
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
              <Area type="monotone" dataKey="rate" name={t("dashboard.attendanceRate")} stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Per-course breakdown */}
      <Title level={5}>{t("dashboard.courseAttendance")}</Title>
      {!loading && summary.length === 0 ? (
        <Card>
          <Empty description={t("dashboard.notEnrolled")} />
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
                      title={<Text style={{ fontSize: 12 }}><CheckCircleOutlined /> {t("common.present")}</Text>}
                      value={course.present_count}
                      valueStyle={{ color: "#52c41a", fontSize: 20 }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title={<Text style={{ fontSize: 12 }}><ClockCircleOutlined /> {t("common.late")}</Text>}
                      value={course.late_count}
                      valueStyle={{ color: "#fa8c16", fontSize: 20 }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title={<Text style={{ fontSize: 12 }}><CloseCircleOutlined /> {t("common.absent")}</Text>}
                      value={course.absent_count}
                      valueStyle={{ color: "#ff4d4f", fontSize: 20 }}
                    />
                  </Col>
                </Row>

                {course.current_streak > 0 && (
                  <div style={{ marginTop: 12, display: "flex", gap: 16, alignItems: "center" }}>
                    <Text style={{ color: "#fa541c" }}>
                      <FireOutlined /> {t("dashboard.currentStreak", { count: course.current_streak })}
                    </Text>
                    <Text type="secondary">
                      <TrophyOutlined /> {t("dashboard.longestStreak", { count: course.longest_streak })}
                    </Text>
                  </div>
                )}

                <div style={{ marginTop: 12 }}>
                  <Text type="secondary">{t("dashboard.sessionsRecorded", { count: course.total_sessions })}</Text>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </>
  );
}
