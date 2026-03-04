import { useCallback, useEffect, useState } from "react";
import { Card, Col, Empty, Row, Space, Tag, Typography, message } from "antd";
import {
  BookOutlined,
  CalendarOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import type { Course, Schedule } from "@/types";
import { listCourses, getCourseStudents } from "@/api/courses";
import { listSchedules } from "@/api/schedules";

const { Title, Text, Paragraph } = Typography;

const classTypeColors: Record<string, string> = {
  lecture: "blue", lab: "green", seminar: "purple",
};

function formatTime(t: string) {
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface CourseDetail {
  course: Course;
  schedules: Schedule[];
  studentCount: number;
}

export default function ProfessorMyCourses() {
  const [details, setDetails] = useState<CourseDetail[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const courses = await listCourses();
      const allSchedules = await listSchedules();

      const result: CourseDetail[] = [];
      for (const course of courses) {
        const schedules = allSchedules.filter((s) => s.course_id === course.id);
        let studentCount = 0;
        try {
          const students = await getCourseStudents(course.id);
          studentCount = students.length;
        } catch {
          // may not have permission for some courses
        }
        result.push({ course, schedules, studentCount });
      }
      setDetails(result);
    } catch {
      message.error("Failed to load courses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!loading && details.length === 0) {
    return (
      <>
        <Title level={4}>My Courses</Title>
        <Empty description="You are not assigned to any courses yet." />
      </>
    );
  }

  return (
    <>
      <Title level={4}>My Courses</Title>
      <Row gutter={[16, 16]}>
        {details.map(({ course, schedules, studentCount }) => (
          <Col xs={24} md={12} xl={8} key={course.id}>
            <Card
              loading={loading}
              title={
                <Space>
                  <BookOutlined />
                  <span>{course.code}</span>
                </Space>
              }
              extra={<Tag>{course.semester} {course.academic_year}</Tag>}
              style={{ borderRadius: 8, height: "100%" }}
            >
              <Title level={5} style={{ marginTop: 0 }}>{course.name}</Title>
              {course.description && (
                <Paragraph type="secondary" ellipsis={{ rows: 2 }}>{course.description}</Paragraph>
              )}

              <Space direction="vertical" style={{ width: "100%", marginTop: 8 }}>
                <Space>
                  <TeamOutlined />
                  <Text>{studentCount} student{studentCount !== 1 ? "s" : ""} enrolled</Text>
                </Space>

                {schedules.length > 0 && (
                  <div>
                    <CalendarOutlined /> <Text strong>Schedule:</Text>
                    {schedules.map((s) => (
                      <div key={s.id} style={{ marginLeft: 20, marginTop: 4 }}>
                        <Tag color={classTypeColors[s.class_type]}>{capitalize(s.class_type)}</Tag>
                        {capitalize(s.day_of_week)} {formatTime(s.start_time)}–{formatTime(s.end_time)}
                        <Text type="secondary"> ({s.room})</Text>
                      </div>
                    ))}
                  </div>
                )}
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </>
  );
}
