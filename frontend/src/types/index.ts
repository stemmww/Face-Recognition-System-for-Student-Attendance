// ---------------------------------------------------------------------------
// Core entities
// ---------------------------------------------------------------------------

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
  qr_interval_seconds: number | null;
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

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface QRToken {
  token: string;
  expires_at: string;
  interval_seconds: number;
}

export interface VerifyAttendanceResponse {
  success: boolean;
  status: AttendanceStatus | null;
  message: string;
}

// ---------------------------------------------------------------------------
// Face recognition
// ---------------------------------------------------------------------------

export interface FaceEmbedding {
  id: number;
  user_id: number;
  photo_path: string;
  created_at: string;
}

export interface FaceEnrollResponse {
  id: number;
  user_id: number;
  photo_path: string;
  faces_detected: number;
  message: string;
  quality_warnings: string[];
}

export interface FaceVerifyMatch {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  similarity: number;
}

export interface FaceVerifyResponse {
  faces_detected: number;
  matches: FaceVerifyMatch[];
}

export interface PipelineStatus {
  insightface_loaded: boolean;
  yolo_loaded: boolean;
}

// ---------------------------------------------------------------------------
// Liveness
// ---------------------------------------------------------------------------

export interface LivenessChallenge {
  challenge_type: string;
  challenge_types: string[];
  instruction: string;
  token: string;
}

// ---------------------------------------------------------------------------
// Attendance (summaries, manual entry)
// ---------------------------------------------------------------------------

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

export interface EnrolledStudent {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

export interface ManualAttendanceEntry {
  student_id: number;
  status: string;
}

// ---------------------------------------------------------------------------
// User management
// ---------------------------------------------------------------------------

export interface BulkImportResult {
  created: number;
  skipped: number;
  enrolled: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

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

export interface SessionTrendPoint {
  date: string;
  session_id: number;
  present: number;
  late: number;
  absent: number;
  total: number;
}

export interface StudentTrendPoint {
  date: string;
  course_code: string;
  course_name: string;
  status: string;
}
