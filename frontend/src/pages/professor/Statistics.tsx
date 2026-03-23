import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
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

const { Title, Text } = Typography;

export default function Statistics() {
  const { t } = useTranslation();

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
    rate >= 75 ? "#52c41a" : rate >= 50 ? "#fa8c16" : "#ff4d4f";

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
    <>
      <Title level={4}>{t("stats.title")}</Title>

      <Space style={{ marginBottom: 24 }} wrap>
        <Select
          placeholder={t("stats.selectCourse")}
          value={selectedCourse}
          onChange={handleCourseChange}
          style={{ width: 350 }}
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

      {!selectedCourse && (
        <Card>
          <Empty description={t("stats.selectCourseToView")} />
        </Card>
      )}

      {stats && (
        <>
          {/* Summary cards */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col xs={12} sm={6}>
              <Card loading={loading}>
                <Statistic
                  title={t("stats.enrolledStudents")}
                  value={stats.total_enrolled}
                  prefix={<TeamOutlined />}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card loading={loading}>
                <Statistic
                  title={t("stats.totalSessions")}
                  value={stats.total_sessions}
                  prefix={<CalendarOutlined />}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card loading={loading}>
                <Statistic
                  title={t("stats.avgRate")}
                  value={stats.avg_attendance_rate}
                  suffix="%"
                  prefix={<BarChartOutlined />}
                  valueStyle={{ color: rateColor(stats.avg_attendance_rate) }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card loading={loading}>
                <Statistic
                  title={t("stats.course")}
                  value={stats.course_code}
                />
              </Card>
            </Col>
          </Row>

          {/* Attendance distribution bar */}
          <Card style={{ marginBottom: 24 }} loading={loading}>
            <Title level={5}>{t("stats.distribution")}</Title>
            {(() => {
              const totalP = stats.students.reduce((s, st) => s + st.present_count, 0);
              const totalL = stats.students.reduce((s, st) => s + st.late_count, 0);
              const totalA = stats.students.reduce((s, st) => s + st.absent_count, 0);
              const total = totalP + totalL + totalA;
              if (total === 0) return <Text type="secondary">{t("stats.noDataYet")}</Text>;
              return (
                <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                  <Statistic title={t("common.present")} value={totalP} suffix={`(${Math.round(totalP / total * 100)}%)`} valueStyle={{ color: "#52c41a" }} />
                  <Statistic title={t("common.late")} value={totalL} suffix={`(${Math.round(totalL / total * 100)}%)`} valueStyle={{ color: "#fa8c16" }} />
                  <Statistic title={t("common.absent")} value={totalA} suffix={`(${Math.round(totalA / total * 100)}%)`} valueStyle={{ color: "#ff4d4f" }} />
                </div>
              );
            })()}
          </Card>

          {/* Per-student table */}
          <Card loading={loading}>
            <Title level={5}>{t("stats.perStudent")}</Title>
            <Table
              dataSource={stats.students}
              columns={columns}
              rowKey="student_id"
              pagination={false}
              size="middle"
              locale={{ emptyText: <Empty description={t("stats.noStudents")} /> }}
            />
          </Card>
        </>
      )}
    </>
  );
}
