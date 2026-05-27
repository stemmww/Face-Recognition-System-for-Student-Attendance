import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, Col, Empty, Row, Space, Tag, Typography, message } from "antd";
import {
  BookOutlined,
  CalendarOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import type { Course, Schedule } from "@/types";
import { listCourses, getCourseStudents } from "@/api/courses";
import { listSchedules } from "@/api/schedules";
import { BRAND_PRIMARY } from "@/styles/theme";

const { Title, Text, Paragraph } = Typography;

const classTypeColors: Record<string, string> = {
  LECTURE: BRAND_PRIMARY, PRACTICE: "green",
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
  const { t } = useTranslation();

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
      message.error(t("coursesPage.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!loading && details.length === 0) {
    return (
      <>
        <Title level={4}>{t("coursesPage.title")}</Title>
        <Empty description={t("coursesPage.notAssigned")} />
      </>
    );
  }

  return (
    <>
      <Title level={4}>{t("coursesPage.title")}</Title>
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
                  <Text>{t("coursesPage.studentsEnrolled", { count: studentCount })}</Text>
                </Space>

                {schedules.length > 0 && (
                  <div>
                    <CalendarOutlined /> <Text strong>{t("coursesPage.scheduleLabel")}:</Text>
                    {schedules.map((s) => (
                      <div key={s.id} style={{ marginLeft: 20, marginTop: 4 }}>
                        <Tag color={classTypeColors[s.lesson_type]}>{s.lesson_type}</Tag>
                        {capitalize(s.day_of_week)} {formatTime(s.start_time)}–{formatTime(s.end_time)}
                        <Text type="secondary"> ({s.classroom_name ?? s.room})</Text>
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
