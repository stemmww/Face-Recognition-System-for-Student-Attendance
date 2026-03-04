import apiClient from "./client";

export interface StudentAttendanceStat {
  student_id: number;
  student_name: string;
  present_count: number;
  late_count: number;
  absent_count: number;
  total_sessions: number;
  attendance_rate: number;
}

export interface CourseStatistics {
  course_id: number;
  course_code: string;
  course_name: string;
  total_sessions: number;
  total_enrolled: number;
  avg_attendance_rate: number;
  students: StudentAttendanceStat[];
}

export async function getCourseStatistics(courseId: number): Promise<CourseStatistics> {
  const { data } = await apiClient.get<CourseStatistics>(`/statistics/course/${courseId}`);
  return data;
}
