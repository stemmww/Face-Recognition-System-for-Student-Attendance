import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button, Select, Table, Tag, message } from "antd";
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
import type { Course, AttendanceSession, SessionTrendPoint } from "@/types";
import { listCourses } from "@/api/courses";
import { listSessions } from "@/api/sessions";
import { listAppeals } from "@/api/appeals";
import { getCourseTrends } from "@/api/statistics";
import { useThemeStore } from "@/stores/themeStore";
import { surfaceColors } from "@/styles/theme";
import Panel from "@/components/dashboard/Panel";
import StatTile from "@/components/dashboard/StatTile";

export default function ProfessorDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isDark = useThemeStore((s) => s.isDark);
  const c = surfaceColors(isDark);

  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [pendingAppeals, setPendingAppeals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [trendCourse, setTrendCourse] = useState<number | undefined>(undefined);
  const [trendData, setTrendData] = useState<SessionTrendPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [crs, s, a] = await Promise.all([
        listCourses(),
        listSessions(),
        listAppeals("pending"),
      ]);
      setCourses(crs);
      setSessions(s);
      setPendingAppeals(a.length);
    } catch {
      message.error(t("dashboard.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (trendCourse) {
      setTrendLoading(true);
      getCourseTrends(trendCourse)
        .then(setTrendData)
        .catch(() => message.error(t("dashboard.failedToLoadTrends")))
        .finally(() => setTrendLoading(false));
    } else {
      setTrendData([]);
    }
  }, [trendCourse, t]);

  // Auto-select first course for trends
  useEffect(() => {
    if (courses.length > 0 && !trendCourse) {
      setTrendCourse(courses[0].id);
    }
  }, [courses, trendCourse]);

  const activeSessions = sessions.filter((s) => s.status === "active");
  const recentSessions = sessions.slice(0, 5);

  const sessionColumns = [
    { title: t("common.id"), dataIndex: "id", width: 60 },
    { title: t("common.date"), dataIndex: "date", width: 120 },
    {
      title: t("common.status"),
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: c.text, margin: "0 0 4px" }}>
        {t("dashboard.welcomeUser", { name: user?.first_name })}
      </h2>

      {/* ── Stat tiles ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <StatTile
          label={t("dashboard.myCoursesCount")}
          value={courses.length}
          icon={<BookOutlined />}
          loading={loading}
          onClick={() => navigate("/courses")}
        />
        <StatTile
          label={t("dashboard.activeSessions")}
          value={activeSessions.length}
          icon={<PlayCircleOutlined />}
          accent={activeSessions.length > 0 ? c.green : undefined}
          loading={loading}
          onClick={() => navigate("/sessions")}
        />
        <StatTile
          label={t("dashboard.totalSessions")}
          value={sessions.length}
          icon={<CalendarOutlined />}
          loading={loading}
          onClick={() => navigate("/sessions")}
        />
        <StatTile
          label={t("dashboard.pendingAppeals")}
          value={pendingAppeals}
          icon={<FileTextOutlined />}
          accent={pendingAppeals > 0 ? c.red : undefined}
          loading={loading}
          onClick={() => navigate("/appeals-review")}
        />
      </div>

      {/* ── Attendance trend chart ── */}
      <Panel
        title={t("dashboard.attendanceTrends")}
        extra={
          <Select
            value={trendCourse}
            onChange={setTrendCourse}
            size="small"
            style={{ width: 240 }}
            options={courses.map((co) => ({ value: co.id, label: `${co.code} — ${co.name}` }))}
          />
        }
      >
        {trendLoading ? (
          <div style={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center", color: c.textFaint }}>
            {t("common.loading")}
          </div>
        ) : trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={c.border} vertical={false} />
              <XAxis dataKey="date" fontSize={12} tick={{ fill: c.textFaint }} axisLine={false} tickLine={false} />
              <YAxis fontSize={12} tick={{ fill: c.textFaint }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, fontSize: 12 }}
                cursor={{ fill: c.surface3 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="present" name={t("common.present")} fill={c.green} stackId="a" />
              <Bar dataKey="late" name={t("common.late")} fill={c.orange} stackId="a" />
              <Bar dataKey="absent" name={t("common.absent")} fill={c.red} stackId="a" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 13, color: c.textFaint }}>{t("dashboard.noTrendData")}</span>
          </div>
        )}
      </Panel>

      {/* ── Recent sessions + quick actions ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Panel title={t("dashboard.recentSessions")}>
          {loading ? (
            <span style={{ fontSize: 13, color: c.textFaint }}>{t("common.loading")}</span>
          ) : recentSessions.length === 0 ? (
            <span style={{ fontSize: 13, color: c.textFaint }}>{t("dashboard.noSessionsYet")}</span>
          ) : (
            <Table
              dataSource={recentSessions}
              columns={sessionColumns}
              rowKey="id"
              pagination={false}
              size="small"
            />
          )}
          <Button type="link" onClick={() => navigate("/sessions")} style={{ marginTop: 8, paddingLeft: 0 }}>
            {t("dashboard.viewAllSessions")}
          </Button>
        </Panel>

        <Panel title={t("dashboard.quickActions")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => navigate("/sessions")}>
              {t("dashboard.startLiveSession")}
            </Button>
            <Button icon={<BookOutlined />} onClick={() => navigate("/attendance")}>
              {t("dashboard.viewAttendanceRecords")}
            </Button>
            <Button icon={<CalendarOutlined />} onClick={() => navigate("/statistics")}>
              {t("dashboard.viewStatistics")}
            </Button>
            <Button icon={<FileTextOutlined />} onClick={() => navigate("/appeals-review")}>
              {t("dashboard.reviewAppeals")}{" "}
              {pendingAppeals > 0 && <Tag color="red" style={{ marginLeft: 8 }}>{pendingAppeals}</Tag>}
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
