import { useCallback, useEffect, useState } from "react";
import {
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
} from "@ant-design/icons";
import type { Course } from "@/types";
import { listCourses } from "@/api/courses";
import { getCourseStatistics, type CourseStatistics, type StudentAttendanceStat } from "@/api/statistics";

const { Title, Text } = Typography;

export default function Statistics() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<number | undefined>(undefined);
  const [stats, setStats] = useState<CourseStatistics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listCourses().then(setCourses).catch(() => message.error("Failed to load courses"));
  }, []);

  const fetchStats = useCallback(async (courseId: number) => {
    setLoading(true);
    try {
      setStats(await getCourseStatistics(courseId));
    } catch {
      message.error("Failed to load statistics");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCourseChange = (courseId: number) => {
    setSelectedCourse(courseId);
    fetchStats(courseId);
  };

  const rateColor = (rate: number) =>
    rate >= 75 ? "#52c41a" : rate >= 50 ? "#fa8c16" : "#ff4d4f";

  const columns = [
    {
      title: "Student",
      dataIndex: "student_name",
      sorter: (a: StudentAttendanceStat, b: StudentAttendanceStat) =>
        a.student_name.localeCompare(b.student_name),
    },
    {
      title: "Present",
      dataIndex: "present_count",
      width: 90,
      render: (v: number) => <Tag color="green">{v}</Tag>,
      sorter: (a: StudentAttendanceStat, b: StudentAttendanceStat) => a.present_count - b.present_count,
    },
    {
      title: "Late",
      dataIndex: "late_count",
      width: 80,
      render: (v: number) => <Tag color="orange">{v}</Tag>,
      sorter: (a: StudentAttendanceStat, b: StudentAttendanceStat) => a.late_count - b.late_count,
    },
    {
      title: "Absent",
      dataIndex: "absent_count",
      width: 80,
      render: (v: number) => <Tag color="red">{v}</Tag>,
      sorter: (a: StudentAttendanceStat, b: StudentAttendanceStat) => a.absent_count - b.absent_count,
    },
    {
      title: "Sessions",
      dataIndex: "total_sessions",
      width: 90,
    },
    {
      title: "Rate",
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
      <Title level={4}>Attendance Statistics</Title>

      <Space style={{ marginBottom: 24 }}>
        <Select
          placeholder="Select a course"
          value={selectedCourse}
          onChange={handleCourseChange}
          style={{ width: 350 }}
          options={courses.map((c) => ({
            value: c.id,
            label: `${c.code} — ${c.name}`,
          }))}
        />
      </Space>

      {!selectedCourse && (
        <Card>
          <Empty description="Select a course to view statistics" />
        </Card>
      )}

      {stats && (
        <>
          {/* Summary cards */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col xs={12} sm={6}>
              <Card loading={loading}>
                <Statistic
                  title="Enrolled Students"
                  value={stats.total_enrolled}
                  prefix={<TeamOutlined />}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card loading={loading}>
                <Statistic
                  title="Total Sessions"
                  value={stats.total_sessions}
                  prefix={<CalendarOutlined />}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card loading={loading}>
                <Statistic
                  title="Avg Attendance Rate"
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
                  title="Course"
                  value={stats.course_code}
                />
              </Card>
            </Col>
          </Row>

          {/* Attendance distribution bar */}
          <Card style={{ marginBottom: 24 }} loading={loading}>
            <Title level={5}>Class Attendance Distribution</Title>
            {(() => {
              const totalP = stats.students.reduce((s, st) => s + st.present_count, 0);
              const totalL = stats.students.reduce((s, st) => s + st.late_count, 0);
              const totalA = stats.students.reduce((s, st) => s + st.absent_count, 0);
              const total = totalP + totalL + totalA;
              if (total === 0) return <Text type="secondary">No attendance data yet</Text>;
              return (
                <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                  <Statistic title="Present" value={totalP} suffix={`(${Math.round(totalP / total * 100)}%)`} valueStyle={{ color: "#52c41a" }} />
                  <Statistic title="Late" value={totalL} suffix={`(${Math.round(totalL / total * 100)}%)`} valueStyle={{ color: "#fa8c16" }} />
                  <Statistic title="Absent" value={totalA} suffix={`(${Math.round(totalA / total * 100)}%)`} valueStyle={{ color: "#ff4d4f" }} />
                </div>
              );
            })()}
          </Card>

          {/* Per-student table */}
          <Card loading={loading}>
            <Title level={5}>Per-Student Breakdown</Title>
            <Table
              dataSource={stats.students}
              columns={columns}
              rowKey="student_id"
              pagination={false}
              size="middle"
              locale={{ emptyText: <Empty description="No students enrolled" /> }}
            />
          </Card>
        </>
      )}
    </>
  );
}
