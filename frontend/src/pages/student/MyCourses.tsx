import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Col, Empty, Row, Space, Tag, Typography, message } from "antd";
import { BookOutlined, CalendarOutlined, RightOutlined } from "@ant-design/icons";
import type { Course, Schedule } from "@/types";
import { listCourses } from "@/api/courses";
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

interface CourseWithSchedule {
  course: Course;
  schedules: Schedule[];
}

export default function StudentMyCourses() {
  const navigate = useNavigate();
  const [data, setData] = useState<CourseWithSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [courses, allSchedules] = await Promise.all([listCourses(), listSchedules()]);
      const result = courses.map((course) => ({
        course,
        schedules: allSchedules.filter((s) => s.course_id === course.id),
      }));
      setData(result);
    } catch {
      message.error("Failed to load courses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!loading && data.length === 0) {
    return (
      <>
        <Title level={4}>My Courses</Title>
        <Empty description="You are not enrolled in any courses yet." />
      </>
    );
  }

  return (
    <>
      <Title level={4}>My Courses</Title>
      <Paragraph type="secondary">Click on a course to view your attendance history.</Paragraph>
      <Row gutter={[16, 16]}>
        {data.map(({ course, schedules }) => (
          <Col xs={24} md={12} xl={8} key={course.id}>
            <Card
              loading={loading}
              hoverable
              onClick={() => navigate(`/courses/${course.id}/attendance`)}
              title={
                <Space>
                  <BookOutlined />
                  <span>{course.code}</span>
                </Space>
              }
              extra={<RightOutlined />}
              style={{ borderRadius: 8, height: "100%" }}
            >
              <Title level={5} style={{ marginTop: 0 }}>{course.name}</Title>
              <Tag>{course.semester} {course.academic_year}</Tag>
              {course.description && (
                <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ marginTop: 8 }}>
                  {course.description}
                </Paragraph>
              )}

              {schedules.length > 0 && (
                <div style={{ marginTop: 8 }}>
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
            </Card>
          </Col>
        ))}
      </Row>
    </>
  );
}
