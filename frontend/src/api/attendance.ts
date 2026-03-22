import type { AttendanceRecord } from "@/types";
import apiClient from "./client";

export async function getSessionAttendance(sessionId: number): Promise<AttendanceRecord[]> {
  const { data } = await apiClient.get<AttendanceRecord[]>(`/attendance/session/${sessionId}`);
  return data;
}

export async function getCourseAttendance(courseId: number): Promise<AttendanceRecord[]> {
  const { data } = await apiClient.get<AttendanceRecord[]>(`/attendance/course/${courseId}`);
  return data;
}

export async function getMyAttendance(): Promise<AttendanceRecord[]> {
  const { data } = await apiClient.get<AttendanceRecord[]>("/attendance/student/me");
  return data;
}

export interface CourseAttendanceSummary {
  course_id: number;
  course_code: string;
  course_name: string;
  total_sessions: number;
  present_count: number;
  late_count: number;
  absent_count: number;
  attendance_rate: number;
}

export async function getMyAttendanceSummary(): Promise<CourseAttendanceSummary[]> {
  const { data } = await apiClient.get<CourseAttendanceSummary[]>("/attendance/student/me/summary");
  return data;
}

export interface StudentCourseRecord {
  id: number;
  student_id: number;
  session_id: number;
  status: string;
  recognized_at: string | null;
  marked_by: string;
  updated_at: string;
  session_date: string | null;
}

export async function getMyCourseAttendance(courseId: number): Promise<StudentCourseRecord[]> {
  const { data } = await apiClient.get<StudentCourseRecord[]>(`/attendance/student/me/course/${courseId}`);
  return data;
}

export async function updateAttendanceStatus(
  recordId: number,
  status: string
): Promise<AttendanceRecord> {
  const { data } = await apiClient.patch<AttendanceRecord>(`/attendance/${recordId}`, { status });
  return data;
}

export interface EnrolledStudent {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

export async function getEnrolledStudentsForSession(
  sessionId: number,
): Promise<EnrolledStudent[]> {
  const { data } = await apiClient.get<EnrolledStudent[]>(
    `/attendance/session/${sessionId}/enrolled-students`,
  );
  return data;
}

export interface ManualAttendanceEntry {
  student_id: number;
  status: string;
}

export async function batchManualAttendance(
  sessionId: number,
  entries: ManualAttendanceEntry[],
): Promise<AttendanceRecord[]> {
  const { data } = await apiClient.post<AttendanceRecord[]>(
    `/attendance/session/${sessionId}/manual-batch`,
    { entries },
  );
  return data;
}

export async function exportSessionCSV(sessionId: number): Promise<void> {
  const response = await apiClient.get(`/attendance/session/${sessionId}/export`, {
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const a = document.createElement("a");
  a.href = url;
  const disposition = response.headers["content-disposition"] || "";
  const match = disposition.match(/filename=(.+)/);
  a.download = match ? match[1] : `attendance_session_${sessionId}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

export async function exportCourseCSV(courseId: number): Promise<void> {
  const response = await apiClient.get(`/attendance/course/${courseId}/export`, {
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const a = document.createElement("a");
  a.href = url;
  const disposition = response.headers["content-disposition"] || "";
  const match = disposition.match(/filename=(.+)/);
  a.download = match ? match[1] : `attendance_course_${courseId}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}
