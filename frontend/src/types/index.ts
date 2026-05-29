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
  can_self_enroll_face?: boolean;
  face_enrollment_status?: string | null;
  face_enrolled_at?: string | null;
}

export interface Course {
  id: number;
  code: string;
  name: string;
  description: string | null;
  semester: string;
  academic_year: string;
  lesson_type: string | null;
  group_type: string | null;
  created_at: string;
}

export type DayOfWeek =
  | "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY"
  | "FRIDAY" | "SATURDAY" | "SUNDAY";

export type LessonType = "LECTURE" | "PRACTICE";
export type SemesterType = "FALL" | "WINTER" | "SPRING";
export type GroupType = "MAIN" | "ELECTIVE";

export interface ScheduleGroupInfo {
  id: number;
  name: string;
  group_type: string;
}

export interface Schedule {
  id: number;
  course_id: number;
  course_code: string | null;
  course_name: string | null;
  professor_id: number | null;
  professor_name: string | null;
  classroom_id: number | null;
  classroom_name: string | null;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  room: string | null;
  lesson_type: LessonType;
  semester: SemesterType | null;
  academic_year: string | null;
  groups: ScheduleGroupInfo[];
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
  override_reason: string | null;
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

export interface ActiveSession {
  session_id: number;
  course_code: string;
  course_name: string;
  room: string;
  started_at: string;
  seconds_since_start: number;
  present_deadline_seconds: number;
  late_deadline_seconds: number;
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
  current_streak: number;
  longest_streak: number;
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
  override_reason: string | null;
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
  updated_roles: number;
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

// ---------------------------------------------------------------------------
// Academic management: Groups
// ---------------------------------------------------------------------------

export interface Group {
  id: number;
  major: string;
  major_name: string;
  enrollment_year_short: number;
  enrollment_year_full: number;
  group_number: number;
  group_type: GroupType;
  semester: SemesterType | null;
  academic_year: string | null;
  is_active: boolean;
  name: string;
  current_study_year: number;
  student_count: number;
}

// ---------------------------------------------------------------------------
// Academic management: Classrooms
// ---------------------------------------------------------------------------

export interface Classroom {
  id: number;
  name: string;
  block: string | null;
  floor: number | null;
  room_number: string | null;
  room_type: string | null;
  room_type_label: string | null;
  capacity: number | null;
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// Academic management: Professors + Tags
// ---------------------------------------------------------------------------

export interface CourseSummary {
  id: number;
  code: string;
  name: string;
}

export interface Professor {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  courses: CourseSummary[];
}

// ---------------------------------------------------------------------------
// Academic management: Group Subjects
// ---------------------------------------------------------------------------

export interface GroupSubject {
  id: number;
  group_id: number;
  course_id: number;
  course_code: string;
  course_name: string;
  semester: string;
}

// ---------------------------------------------------------------------------
// Academic management: Professor Availability
// ---------------------------------------------------------------------------

export interface ProfessorAvailability {
  id: number;
  professor_id: number;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
}

// ---------------------------------------------------------------------------
// CSV import result
// ---------------------------------------------------------------------------

export interface CsvImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Face self-enrollment
// ---------------------------------------------------------------------------

export type FaceEnrollmentStatus =
  | "NOT_STARTED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "FAILED";

export interface FaceEnrollmentMeResponse {
  can_self_enroll_face: boolean;
  has_face_embedding: boolean;
  embedding_count: number;
  face_enrollment_status: FaceEnrollmentStatus | null;
  face_enrolled_at: string | null;
  max_photos: number;
}

export interface FaceEnrollmentUploadResponse {
  success: boolean;
  status: FaceEnrollmentStatus;
  message: string;
  reason?: string;
  has_face_embedding?: boolean;
  embedding_count?: number;
}
