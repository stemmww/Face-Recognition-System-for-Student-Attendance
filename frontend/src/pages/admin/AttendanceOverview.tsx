import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Select,
  Table,
  Tag,
  message,
} from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { AttendanceSession, Course } from "@/types";
import { listCourses } from "@/api/courses";
import { listSessions } from "@/api/sessions";
import { exportCourseCSV } from "@/api/attendance";
import { useThemeStore } from "@/stores/themeStore";
import { surfaceColors } from "@/styles/theme";
import PageHeader from "@/components/dashboard/PageHeader";
import Panel from "@/components/dashboard/Panel";
import StatTile from "@/components/dashboard/StatTile";

export default function AttendanceOverview() {
  const { t } = useTranslation();
  const isDark = useThemeStore((s) => s.isDark);
  const cc = surfaceColors(isDark);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const fetchCourses = useCallback(async () => {
    try {
      setCourses(await listCourses());
    } catch {
      message.error(t("overview.loadFailed"));
    }
  }, [t]);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = selectedCourse ? { course_id: selectedCourse } : {};
      setSessions(await listSessions(params));
    } catch {
      message.error(t("overview.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [selectedCourse, t]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const activeSessions = sessions.filter((s) => s.status === "active");
  const completedSessions = sessions.filter((s) => s.status === "completed");

  const columns = [
    { title: t("common.id"), dataIndex: "id", key: "id", width: 60 },
    {
      title: t("common.date"),
      dataIndex: "date",
      key: "date",
      width: 120,
    },
    {
      title: t("session.started"),
      key: "started_at",
      width: 100,
      render: (_: unknown, r: AttendanceSession) => dayjs(r.started_at).format("HH:mm"),
    },
    {
      title: t("overview.ended"),
      key: "ended_at",
      width: 100,
      render: (_: unknown, r: AttendanceSession) =>
        r.ended_at ? dayjs(r.ended_at).format("HH:mm") : "—",
    },
    {
      title: t("common.status"),
      key: "status",
      width: 100,
      render: (_: unknown, r: AttendanceSession) => (
        <Tag color={r.status === "active" ? "green" : "default"}>
          {r.status === "active" ? t("common.active") : t("common.completed")}
        </Tag>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader
        title={t("overview.title")}
        extra={
          <>
            <Select
              placeholder={t("common.filterByCourse")}
              value={selectedCourse}
              onChange={setSelectedCourse}
              allowClear
              style={{ width: 280 }}
              options={courses.map((c) => ({
                value: c.id,
                label: `${c.code} — ${c.name}`,
              }))}
            />
            {selectedCourse && (
              <Button
                icon={<DownloadOutlined />}
                onClick={() => exportCourseCSV(selectedCourse).catch(() => message.error(t("attendance.exportFailed")))}
              >
                {t("attendance.exportCSV")}
              </Button>
            )}
          </>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <StatTile label={t("overview.totalSessions")} value={sessions.length} loading={loading} />
        <StatTile
          label={t("overview.activeNow")}
          value={activeSessions.length}
          accent={activeSessions.length > 0 ? cc.green : undefined}
          loading={loading}
        />
        <StatTile label={t("overview.completed")} value={completedSessions.length} loading={loading} />
        <StatTile label={t("overview.courses")} value={courses.length} loading={loading} />
      </div>

      <Panel flush>
        <Table
          dataSource={sessions}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15, showTotal: (total) => `${total} ${t("common.sessions")}` }}
        />
      </Panel>
    </div>
  );
}
