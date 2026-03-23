import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Button,
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import { getCourse } from "@/api/courses";
import type { Course, StudentCourseRecord } from "@/types";
import { getMyCourseAttendance } from "@/api/attendance";

const { Title, Text } = Typography;

export default function AttendanceHistory() {
  const { t } = useTranslation();
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
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
      width: 100,
      render: (_: unknown, r: StudentCourseRecord) => {
        const cfg = statusConfig[r.status] || { color: "default", label: r.status };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
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
    <>
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate("/courses")}
        style={{ padding: 0, marginBottom: 8 }}
      >
        {t("attendance.backToMyCourses")}
      </Button>

      <Title level={4}>
        {course ? `${course.code} — ${course.name}` : t("attendance.attendanceHistory")}
      </Title>

      {/* Summary cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card loading={loading} size="small">
            <Statistic
              title={t("attendance.attendanceRate")}
              value={rate}
              suffix="%"
              valueStyle={{ color: rate >= 75 ? "#52c41a" : rate >= 50 ? "#fa8c16" : "#ff4d4f" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={loading} size="small">
            <Statistic
              title={<><CheckCircleOutlined /> {t("common.present")}</>}
              value={present}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={loading} size="small">
            <Statistic
              title={<><ClockCircleOutlined /> {t("common.late")}</>}
              value={late}
              valueStyle={{ color: "#fa8c16" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={loading} size="small">
            <Statistic
              title={<><CloseCircleOutlined /> {t("common.absent")}</>}
              value={absent}
              valueStyle={{ color: "#ff4d4f" }}
            />
          </Card>
        </Col>
      </Row>

      {total > 0 && (
        <Progress
          percent={rate}
          status={rate >= 75 ? "success" : rate >= 50 ? "normal" : "exception"}
          style={{ marginBottom: 24 }}
        />
      )}

      <Table
        dataSource={records}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, showTotal: (total) => t("attendance.sessionCount", { count: total }) }}
        locale={{ emptyText: <Empty description={t("attendance.noRecordsForCourse")} /> }}
      />
    </>
  );
}
