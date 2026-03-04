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
import dayjs from "dayjs";
import { getCourse } from "@/api/courses";
import { getMyCourseAttendance, type StudentCourseRecord } from "@/api/attendance";
import type { Course } from "@/types";

const { Title, Text } = Typography;

const statusConfig: Record<string, { color: string; label: string }> = {
  present: { color: "green", label: "Present" },
  late: { color: "orange", label: "Late" },
  absent: { color: "red", label: "Absent" },
};

export default function AttendanceHistory() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [records, setRecords] = useState<StudentCourseRecord[]>([]);
  const [loading, setLoading] = useState(true);

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
      message.error("Failed to load attendance data");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

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
      title: "Date",
      dataIndex: "session_date",
      width: 120,
      sorter: (a: StudentCourseRecord, b: StudentCourseRecord) =>
        (a.session_date || "").localeCompare(b.session_date || ""),
      defaultSortOrder: "descend" as const,
    },
    {
      title: "Status",
      key: "status",
      width: 100,
      render: (_: unknown, r: StudentCourseRecord) => {
        const cfg = statusConfig[r.status] || { color: "default", label: r.status };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
      filters: [
        { text: "Present", value: "present" },
        { text: "Late", value: "late" },
        { text: "Absent", value: "absent" },
      ],
      onFilter: (value: unknown, record: StudentCourseRecord) => record.status === value,
    },
    {
      title: "Time Recognized",
      key: "recognized_at",
      width: 140,
      render: (_: unknown, r: StudentCourseRecord) =>
        r.recognized_at ? dayjs(r.recognized_at).format("HH:mm:ss") : "Not recognized",
    },
    {
      title: "Marked By",
      key: "marked_by",
      width: 110,
      render: (_: unknown, r: StudentCourseRecord) => (
        <Tag>{r.marked_by === "system" ? "System" : "Professor"}</Tag>
      ),
    },
    {
      title: "Record ID",
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
        Back to My Courses
      </Button>

      <Title level={4}>
        {course ? `${course.code} — ${course.name}` : "Attendance History"}
      </Title>

      {/* Summary cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card loading={loading} size="small">
            <Statistic
              title="Attendance Rate"
              value={rate}
              suffix="%"
              valueStyle={{ color: rate >= 75 ? "#52c41a" : rate >= 50 ? "#fa8c16" : "#ff4d4f" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={loading} size="small">
            <Statistic
              title={<><CheckCircleOutlined /> Present</>}
              value={present}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={loading} size="small">
            <Statistic
              title={<><ClockCircleOutlined /> Late</>}
              value={late}
              valueStyle={{ color: "#fa8c16" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={loading} size="small">
            <Statistic
              title={<><CloseCircleOutlined /> Absent</>}
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
        pagination={{ pageSize: 20, showTotal: (t) => `${t} session(s)` }}
        locale={{ emptyText: <Empty description="No attendance recorded for this course yet" /> }}
      />
    </>
  );
}
