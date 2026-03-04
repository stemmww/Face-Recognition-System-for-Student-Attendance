export type Role = "admin" | "professor" | "student";

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  photo_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Course {
  id: number;
  code: string;
  name: string;
  description: string | null;
  semester: string;
  academic_year: string;
  created_at: string;
}

export interface Schedule {
  id: number;
  course_id: number;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room: string;
  class_type: "lecture" | "lab" | "seminar";
}

export type AttendanceStatus = "present" | "late" | "absent";

export interface AttendanceRecord {
  id: number;
  student_id: number;
  session_id: number;
  status: AttendanceStatus;
  recognized_at: string | null;
  marked_by: "system" | "professor";
  updated_at: string;
  student_name: string | null;
  student_email: string | null;
}

export interface AttendanceSession {
  id: number;
  schedule_id: number;
  date: string;
  started_at: string;
  ended_at: string | null;
  started_by: number;
  status: "active" | "completed";
}

export interface Notification {
  id: number;
  user_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface Appeal {
  id: number;
  student_id: number;
  attendance_id: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  reviewed_by: number | null;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}
