import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Button,
  Empty,
  Progress,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import { getCourse } from "@/api/courses";
import type { Course, StudentCourseRecord } from "@/types";
import { getMyCourseAttendance } from "@/api/attendance";
import { useThemeStore } from "@/stores/themeStore";
import { surfaceColors } from "@/styles/theme";
import PageHeader from "@/components/dashboard/PageHeader";
import Panel from "@/components/dashboard/Panel";
import StatTile from "@/components/dashboard/StatTile";

const { Text } = Typography;

export default function AttendanceHistory() {
  const { t } = useTranslation();
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isDark = useThemeStore((s) => s.isDark);
  const cc = surfaceColors(isDark);
  const studentBasePath = location.pathname.startsWith("/student-app") ? "/student-app" : "";
  const [course, setCourse] = useState<Course | null>(null);
  const [records, setRecords] = useState<StudentCourseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const statusConfig: Record<string, { color: string; label: string }> = {
    present: { color: "green", label: t("common.present") },
    late: { color: "orange", label: t("common.late") },
    absent: { color: "red", label: t("common.absent") },
  };

  const fetchData = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    try {
      const [c, r] = await Promise.all([
        getCourse(Number(courseId)),
        getMyCourseAttendance(Number(courseId)),
      ]);
      setCourse(c);
      setRecords(r);
    } catch {
      message.error(t("attendance.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [courseId, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const present = records.filter((r) => r.status === "present").length;
  const late = records.filter((r) => r.status === "late").length;
  const absent = records.filter((r) => r.status === "absent").length;
  const total = records.length;
  const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 100;

  const columns = [
    {
      title: t("common.date"),
      dataIndex: "session_date",
      width: 120,
      sorter: (a: StudentCourseRecord, b: StudentCourseRecord) =>
        (a.session_date || "").localeCompare(b.session_date || ""),
      defaultSortOrder: "descend" as const,
    },
    {
      title: t("common.status"),
      key: "status",
      width: 130,
      render: (_: unknown, r: StudentCourseRecord) => {
        const cfg = statusConfig[r.status] || { color: "default", label: r.status };
        return (
          <Space size={4}>
            <Tag color={cfg.color}>{cfg.label}</Tag>
            {r.override_reason && (
              <Tooltip title={r.override_reason}>
                <InfoCircleOutlined style={{ color: "#1677ff", cursor: "pointer" }} />
              </Tooltip>
            )}
          </Space>
        );
      },
      filters: [
        { text: t("common.present"), value: "present" },
        { text: t("common.late"), value: "late" },
        { text: t("common.absent"), value: "absent" },
      ],
      onFilter: (value: unknown, record: StudentCourseRecord) => record.status === value,
    },
    {
      title: t("attendance.timeRecognized"),
      key: "recognized_at",
      width: 140,
      render: (_: unknown, r: StudentCourseRecord) =>
        r.recognized_at ? dayjs(r.recognized_at).format("HH:mm:ss") : t("attendance.notRecognized"),
    },
    {
      title: t("attendance.markedBy"),
      key: "marked_by",
      width: 110,
      render: (_: unknown, r: StudentCourseRecord) => (
        <Tag>{r.marked_by === "system" ? t("common.system") : t("common.professor")}</Tag>
      ),
    },
    {
      title: t("attendance.recordId"),
      dataIndex: "id",
      width: 90,
      render: (id: number) => <Text type="secondary">#{id}</Text>,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader
        title={course ? `${course.code} — ${course.name}` : t("attendance.attendanceHistory")}
        extra={
          <Button
            type="link"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(`${studentBasePath}/courses`)}
            style={{ padding: 0 }}
          >
            {t("attendance.backToMyCourses")}
          </Button>
        }
      />

      {/* Summary tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <StatTile
          label={t("attendance.attendanceRate")}
          value={`${rate}%`}
          accent={rate >= 75 ? cc.green : rate >= 50 ? cc.orange : cc.red}
          loading={loading}
        />
        <StatTile label={t("common.present")} value={present} icon={<CheckCircleOutlined />} accent={cc.green} loading={loading} />
        <StatTile label={t("common.late")} value={late} icon={<ClockCircleOutlined />} accent={cc.orange} loading={loading} />
        <StatTile label={t("common.absent")} value={absent} icon={<CloseCircleOutlined />} accent={cc.red} loading={loading} />
      </div>

      {total > 0 && (
        <Progress
          percent={rate}
          status={rate >= 75 ? "success" : rate >= 50 ? "normal" : "exception"}
        />
      )}

      <Panel flush>
        <Table
          dataSource={records}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showTotal: (total) => t("attendance.sessionCount", { count: total }) }}
          locale={{ emptyText: <Empty description={t("attendance.noRecordsForCourse")} /> }}
        />
      </Panel>
    </div>
  );
}
