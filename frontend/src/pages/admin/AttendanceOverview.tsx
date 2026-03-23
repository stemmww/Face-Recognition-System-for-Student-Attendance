import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Card,
  Col,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { AttendanceSession, Course } from "@/types";
import { listCourses } from "@/api/courses";
import { listSessions } from "@/api/sessions";
import { exportCourseCSV } from "@/api/attendance";

const { Title } = Typography;

export default function AttendanceOverview() {
  const { t } = useTranslation();
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
    <>
      <Title level={4}>{t("overview.title")}</Title>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title={t("overview.totalSessions")} value={sessions.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t("overview.activeNow")}
              value={activeSessions.length}
              valueStyle={{ color: activeSessions.length > 0 ? "#52c41a" : undefined }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={t("overview.completed")} value={completedSessions.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={t("overview.courses")} value={courses.length} />
          </Card>
        </Col>
      </Row>

      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          placeholder={t("common.filterByCourse")}
          value={selectedCourse}
          onChange={setSelectedCourse}
          allowClear
          style={{ width: 300 }}
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
      </Space>

      <Table
        dataSource={sessions}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 15, showTotal: (total) => `${total} ${t("common.sessions")}` }}
      />
    </>
  );
}
