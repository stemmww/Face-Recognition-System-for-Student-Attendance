import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Alert,
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
import type { ActiveSession, CourseAttendanceSummary, StudentTrendPoint } from "@/types";
import { getMyAttendanceSummary } from "@/api/attendance";
import { getUnreadCount } from "@/api/notifications";
import { getMyTrends } from "@/api/statistics";
import { getStudentActiveSessions } from "@/api/sessions";

const { Title, Text } = Typography;

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function StudentDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<CourseAttendanceSummary[]>([]);
  const [unread, setUnread] = useState(0);
  const [trends, setTrends] = useState<StudentTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [tick, setTick] = useState(0);
  const sessionsRef = useRef(activeSessions);
  sessionsRef.current = activeSessions;

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
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll active sessions every 30 seconds
  useEffect(() => {
    const fetchActive = () => {
      getStudentActiveSessions().then(setActiveSessions).catch(() => {});
    };
    fetchActive();
    const interval = setInterval(fetchActive, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Tick every second for countdown
  useEffect(() => {
    if (activeSessions.length === 0) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [activeSessions.length]);

  const totalSessions = summary.reduce((s, c) => s + c.total_sessions, 0);
  const totalPresent = summary.reduce((s, c) => s + c.present_count, 0);
  const totalLate = summary.reduce((s, c) => s + c.late_count, 0);
  const overallRate = totalSessions > 0
    ? Math.round(((totalPresent + totalLate) / totalSessions) * 100)
    : 100;
  const bestStreakCourse = summary.reduce<CourseAttendanceSummary | null>(
    (best, c) => (!best || c.current_streak > best.current_streak) ? c : best,
    null,
  );

  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <Title level={4} style={{ marginBottom: 0 }}>{t("dashboard.welcomeUser", { name: user?.first_name })}</Title>
        {bestStreakCourse && bestStreakCourse.current_streak > 0 && (
          <Text style={{ color: "#fa541c", fontSize: 15 }}>
            <FireOutlined /> {t("dashboard.streakWithCourse", { count: bestStreakCourse.current_streak, course: bestStreakCourse.course_code })}
          </Text>
        )}
      </div>

      {/* Active session banners */}
      {activeSessions.map((s) => {
        // Use tick to force re-render every second
        void tick;
        const elapsed = s.seconds_since_start + tick;
        const presentLeft = s.present_deadline_seconds - elapsed;
        const lateLeft = s.late_deadline_seconds - elapsed;
        const isPresent = presentLeft > 0;
        const isLate = !isPresent && lateLeft > 0;

        let type: "success" | "warning" | "error";
        let msg: string;
        if (isPresent) {
          type = "success";
          msg = t("dashboard.activeSessionPresent", { course: s.course_code, room: s.room, time: formatCountdown(presentLeft) });
        } else if (isLate) {
          type = "warning";
          msg = t("dashboard.activeSessionLate", { course: s.course_code, room: s.room, time: formatCountdown(lateLeft) });
        } else {
          type = "error";
          msg = t("dashboard.activeSessionAbsent", { course: s.course_code, room: s.room });
        }

        return (
          <Alert
            key={s.session_id}
            type={type}
            showIcon
            banner
            message={msg}
            style={{ marginBottom: 12, cursor: "pointer", borderRadius: 8 }}
            onClick={() => navigate("/attend")}
          />
        );
      })}

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
              <Area type="monotone" dataKey="rate" name={t("dashboard.attendanceRate")} stroke="#2323CE" fill="#2323CE" fillOpacity={0.15} strokeWidth={2} />
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Space>
                      <BookOutlined />
                      <span>{course.course_code}</span>
                    </Space>
                    {(course.current_streak > 0 || course.longest_streak > 0) && (
                      <Space size={12}>
                        {course.current_streak > 0 && (
                          <Text style={{ color: "#fa541c", fontSize: 13, fontWeight: "normal" }}>
                            <FireOutlined /> {t("dashboard.currentStreak", { count: course.current_streak })}
                          </Text>
                        )}
                        {course.longest_streak > 0 && (
                          <Text style={{ color: "#faad14", fontSize: 13, fontWeight: "normal" }}>
                            <TrophyOutlined /> {t("dashboard.longestStreak", { count: course.longest_streak })}
                          </Text>
                        )}
                      </Space>
                    )}
                  </div>
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
