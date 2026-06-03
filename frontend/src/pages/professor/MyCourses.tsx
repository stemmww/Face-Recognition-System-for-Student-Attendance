import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Empty, Space, Tag, Typography, message } from "antd";
import {
  BookOutlined,
  CalendarOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import type { Course, Schedule } from "@/types";
import { listCourses, getCourseStudents } from "@/api/courses";
import { listSchedules } from "@/api/schedules";
import { BRAND_PRIMARY } from "@/styles/theme";
import { getSemesterLabel } from "@/utils/formatters";
import PageHeader from "@/components/dashboard/PageHeader";
import Panel from "@/components/dashboard/Panel";

const { Text, Paragraph } = Typography;

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
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <PageHeader title={t("coursesPage.title")} />
        <Panel><Empty description={t("coursesPage.notAssigned")} /></Panel>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader title={t("coursesPage.title")} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {details.map(({ course, schedules, studentCount }) => (
          <Panel
            key={course.id}
            title={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <BookOutlined />
                {course.code}
              </span>
            }
            extra={<Tag>{getSemesterLabel(course.semester, t)} {course.academic_year}</Tag>}
          >
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{course.name}</div>
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
          </Panel>
        ))}
      </div>
    </div>
  );
}
