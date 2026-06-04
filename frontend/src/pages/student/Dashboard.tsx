import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Empty, Progress, message } from "antd";
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
import { useThemeStore } from "@/stores/themeStore";
import { BRAND_PRIMARY, surfaceColors } from "@/styles/theme";
import Panel from "@/components/dashboard/Panel";
import StatTile from "@/components/dashboard/StatTile";

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function StudentDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isDark = useThemeStore((s) => s.isDark);
  const c = surfaceColors(isDark);
  const studentBasePath = location.pathname.startsWith("/student-app") ? "/student-app" : "";
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

  const rateColor = (rate: number) => (rate >= 75 ? c.green : rate >= 50 ? c.orange : c.red);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: c.text, margin: 0 }}>
          {t("dashboard.welcomeUser", { name: user?.first_name })}
        </h2>
        {bestStreakCourse && bestStreakCourse.current_streak > 0 && (
          <span style={{ color: "#fa541c", fontSize: 15 }}>
            <FireOutlined /> {t("dashboard.streakWithCourse", { count: bestStreakCourse.current_streak, course: bestStreakCourse.course_code })}
          </span>
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
            style={{ cursor: "pointer", borderRadius: 12 }}
            onClick={() => navigate(`${studentBasePath}/attend`)}
          />
        );
      })}

      {/* Overview tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <StatTile label={t("nav.courses")} value={summary.length} icon={<BookOutlined />} loading={loading} />
        <StatTile
          label={t("dashboard.overallRate")}
          value={`${overallRate}%`}
          accent={rateColor(overallRate)}
          loading={loading}
        />
        <StatTile label={t("dashboard.totalSessions")} value={totalSessions} loading={loading} />
        <StatTile
          label={t("dashboard.unreadAlerts")}
          value={unread}
          accent={unread > 0 ? c.red : undefined}
          loading={loading}
        />
      </div>

      {/* Attendance trend chart */}
      {trends.length > 0 && (
        <Panel title={t("dashboard.attendanceTrend")}>
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
              <CartesianGrid strokeDasharray="3 3" stroke={c.border} vertical={false} />
              <XAxis dataKey="date" fontSize={12} tick={{ fill: c.textFaint }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} fontSize={12} tick={{ fill: c.textFaint }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, fontSize: 12 }}
                cursor={{ fill: c.surface3 }}
                formatter={(value: number, name: string) => name === "rate" ? `${value}%` : value}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="rate" name={t("dashboard.attendanceRate")} stroke={BRAND_PRIMARY} fill={BRAND_PRIMARY} fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
      )}

      {/* Per-course breakdown */}
      <h3 style={{ fontSize: 16, fontWeight: 700, color: c.text, margin: "4px 0 0" }}>{t("dashboard.courseAttendance")}</h3>
      {!loading && summary.length === 0 ? (
        <Panel>
          <Empty description={t("dashboard.notEnrolled")} />
        </Panel>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {summary.map((course) => (
            <Panel
              key={course.course_id}
              style={{ height: "100%" }}
              title={
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <BookOutlined />
                  {course.course_code}
                </span>
              }
              extra={
                (course.current_streak > 0 || course.longest_streak > 0) ? (
                  <span style={{ display: "inline-flex", gap: 12 }}>
                    {course.current_streak > 0 && (
                      <span style={{ color: "#fa541c", fontSize: 13 }}>
                        <FireOutlined /> {t("dashboard.currentStreak", { count: course.current_streak })}
                      </span>
                    )}
                    {course.longest_streak > 0 && (
                      <span style={{ color: "#faad14", fontSize: 13 }}>
                        <TrophyOutlined /> {t("dashboard.longestStreak", { count: course.longest_streak })}
                      </span>
                    )}
                  </span>
                ) : undefined
              }
            >
              <div style={{ fontSize: 15, fontWeight: 600, color: c.text, marginBottom: 12 }}>{course.course_name}</div>

              <Progress
                percent={course.attendance_rate}
                status={course.attendance_rate >= 75 ? "success" : course.attendance_rate >= 50 ? "normal" : "exception"}
                format={(p) => `${p}%`}
                style={{ marginBottom: 16 }}
              />

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 2 }}>
                    <CheckCircleOutlined /> {t("common.present")}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: c.green }}>{course.present_count}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 2 }}>
                    <ClockCircleOutlined /> {t("common.late")}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: c.orange }}>{course.late_count}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 2 }}>
                    <CloseCircleOutlined /> {t("common.absent")}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: c.red }}>{course.absent_count}</div>
                </div>
              </div>

              <span style={{ fontSize: 12, color: c.textMuted }}>
                {t("dashboard.sessionsRecorded", { count: course.total_sessions })}
              </span>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
