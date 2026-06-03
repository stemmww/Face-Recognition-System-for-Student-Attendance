import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Empty,
  Progress,
  Select,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import {
  TeamOutlined,
  CalendarOutlined,
  BarChartOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import type { Course, CourseStatistics, StudentAttendanceStat } from "@/types";
import { listCourses } from "@/api/courses";
import { getCourseStatistics } from "@/api/statistics";
import { exportCourseCSV } from "@/api/attendance";
import { useThemeStore } from "@/stores/themeStore";
import { surfaceColors } from "@/styles/theme";
import PageHeader from "@/components/dashboard/PageHeader";
import Panel from "@/components/dashboard/Panel";
import StatTile from "@/components/dashboard/StatTile";

const { Text } = Typography;

export default function Statistics() {
  const { t } = useTranslation();
  const isDark = useThemeStore((s) => s.isDark);
  const cc = surfaceColors(isDark);

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<number | undefined>(undefined);
  const [stats, setStats] = useState<CourseStatistics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listCourses().then(setCourses).catch(() => message.error(t("stats.loadFailed")));
  }, [t]);

  const fetchStats = useCallback(async (courseId: number) => {
    setLoading(true);
    try {
      setStats(await getCourseStatistics(courseId));
    } catch {
      message.error(t("stats.loadFailed"));
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const handleCourseChange = (courseId: number) => {
    setSelectedCourse(courseId);
    fetchStats(courseId);
  };

  const rateColor = (rate: number) =>
    rate >= 75 ? cc.green : rate >= 50 ? cc.orange : cc.red;

  const columns = [
    {
      title: t("attendance.studentCol"),
      dataIndex: "student_name",
      sorter: (a: StudentAttendanceStat, b: StudentAttendanceStat) =>
        a.student_name.localeCompare(b.student_name),
    },
    {
      title: t("common.present"),
      dataIndex: "present_count",
      width: 90,
      render: (v: number) => <Tag color="green">{v}</Tag>,
      sorter: (a: StudentAttendanceStat, b: StudentAttendanceStat) => a.present_count - b.present_count,
    },
    {
      title: t("common.late"),
      dataIndex: "late_count",
      width: 80,
      render: (v: number) => <Tag color="orange">{v}</Tag>,
      sorter: (a: StudentAttendanceStat, b: StudentAttendanceStat) => a.late_count - b.late_count,
    },
    {
      title: t("common.absent"),
      dataIndex: "absent_count",
      width: 80,
      render: (v: number) => <Tag color="red">{v}</Tag>,
      sorter: (a: StudentAttendanceStat, b: StudentAttendanceStat) => a.absent_count - b.absent_count,
    },
    {
      title: t("stats.sessions"),
      dataIndex: "total_sessions",
      width: 90,
    },
    {
      title: t("stats.rate"),
      dataIndex: "attendance_rate",
      width: 140,
      render: (rate: number) => (
        <Progress
          percent={rate}
          size="small"
          status={rate >= 75 ? "success" : rate >= 50 ? "normal" : "exception"}
          format={(p) => `${p}%`}
        />
      ),
      sorter: (a: StudentAttendanceStat, b: StudentAttendanceStat) => a.attendance_rate - b.attendance_rate,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader
        title={t("stats.title")}
        extra={
          <>
            <Select
              placeholder={t("stats.selectCourse")}
              value={selectedCourse}
              onChange={handleCourseChange}
              style={{ width: 320 }}
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

      {!selectedCourse && (
        <Panel>
          <Empty description={t("stats.selectCourseToView")} />
        </Panel>
      )}

      {stats && (
        <>
          {/* Summary tiles */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            <StatTile label={t("stats.enrolledStudents")} value={stats.total_enrolled} icon={<TeamOutlined />} loading={loading} />
            <StatTile label={t("stats.totalSessions")} value={stats.total_sessions} icon={<CalendarOutlined />} loading={loading} />
            <StatTile
              label={t("stats.avgRate")}
              value={`${stats.avg_attendance_rate}%`}
              icon={<BarChartOutlined />}
              accent={rateColor(stats.avg_attendance_rate)}
              loading={loading}
            />
            <StatTile label={t("stats.course")} value={stats.course_code} loading={loading} />
          </div>

          {/* Attendance distribution */}
          <Panel title={t("stats.distribution")}>
            {(() => {
              const totalP = stats.students.reduce((s, st) => s + st.present_count, 0);
              const totalL = stats.students.reduce((s, st) => s + st.late_count, 0);
              const totalA = stats.students.reduce((s, st) => s + st.absent_count, 0);
              const total = totalP + totalL + totalA;
              if (total === 0) return <Text type="secondary">{t("stats.noDataYet")}</Text>;
              const cell = (label: string, val: number, color: string) => (
                <div>
                  <div style={{ fontSize: 13, color: cc.textMuted, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color }}>
                    {val} <span style={{ fontSize: 14, fontWeight: 500, color: cc.textMuted }}>({Math.round(val / total * 100)}%)</span>
                  </div>
                </div>
              );
              return (
                <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
                  {cell(t("common.present"), totalP, cc.green)}
                  {cell(t("common.late"), totalL, cc.orange)}
                  {cell(t("common.absent"), totalA, cc.red)}
                </div>
              );
            })()}
          </Panel>

          {/* Per-student table */}
          <Panel title={t("stats.perStudent")} flush>
            <Table
              dataSource={stats.students}
              columns={columns}
              rowKey="student_id"
              pagination={false}
              size="middle"
              locale={{ emptyText: <Empty description={t("stats.noStudents")} /> }}
            />
          </Panel>
        </>
      )}
    </div>
  );
}
