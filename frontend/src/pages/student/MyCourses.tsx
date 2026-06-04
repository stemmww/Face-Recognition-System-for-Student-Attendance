import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Empty, Tag, Typography, message } from "antd";
import { BookOutlined, CalendarOutlined, RightOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import type { Course, Schedule } from "@/types";
import { listCourses } from "@/api/courses";
import { listSchedules } from "@/api/schedules";
import { getSemesterLabel } from "@/utils/formatters";
import { BRAND_PRIMARY } from "@/styles/theme";
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

interface CourseWithSchedule {
  course: Course;
  schedules: Schedule[];
}

export default function StudentMyCourses() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const studentBasePath = location.pathname.startsWith("/student-app") ? "/student-app" : "";
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
      message.error(t("coursesPage.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!loading && data.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <PageHeader title={t("coursesPage.title")} />
        <Panel><Empty description={t("coursesPage.notEnrolled")} /></Panel>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader title={t("coursesPage.title")} subtitle={t("coursesPage.clickToView")} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {data.map(({ course, schedules }) => (
          <div
            key={course.id}
            onClick={() => navigate(`${studentBasePath}/courses/${course.id}/attendance`)}
            style={{ cursor: "pointer", display: "flex" }}
          >
            <Panel
              style={{ height: "100%", width: "100%" }}
              title={
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <BookOutlined />
                  {course.code}
                </span>
              }
              extra={<RightOutlined />}
            >
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{course.name}</div>
              <Tag>{getSemesterLabel(course.semester, t)} {course.academic_year}</Tag>
              {course.description && (
                <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ marginTop: 8 }}>
                  {course.description}
                </Paragraph>
              )}

              {schedules.length > 0 && (
                <div style={{ marginTop: 8 }}>
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
            </Panel>
          </div>
        ))}
      </div>
    </div>
  );
}
