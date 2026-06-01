class AttendanceRecord {
  final int id;
  final String status;
  final String? recognizedAt;
  final String? markedBy;
  final String? overrideReason;
  final int sessionId;
  final String? courseName;
  final String? sessionDate;

  const AttendanceRecord({
    required this.id,
    required this.status,
    this.recognizedAt,
    this.markedBy,
    this.overrideReason,
    required this.sessionId,
    this.courseName,
    this.sessionDate,
  });

  factory AttendanceRecord.fromJson(Map<String, dynamic> json) {
    return AttendanceRecord(
      id: json['id'] as int,
      status: json['status'] as String? ?? 'ABSENT',
      recognizedAt: json['recognized_at'] as String?,
      markedBy: json['marked_by'] as String?,
      overrideReason: json['override_reason'] as String?,
      sessionId: json['session_id'] as int? ?? 0,
      courseName: json['course_name'] as String?,
      sessionDate: json['session_date'] as String?,
    );
  }
}

class ActiveSession {
  final int id;
  final String courseName;
  final String courseCode;
  final String room;
  final String startedAt;
  final int secondsSinceStart;
  final int presentDeadlineSeconds;
  final int lateDeadlineSeconds;

  const ActiveSession({
    required this.id,
    required this.courseName,
    required this.courseCode,
    required this.room,
    required this.startedAt,
    required this.secondsSinceStart,
    required this.presentDeadlineSeconds,
    required this.lateDeadlineSeconds,
  });

  factory ActiveSession.fromJson(Map<String, dynamic> json) {
    return ActiveSession(
      id: json['session_id'] as int? ?? 0,
      courseName: json['course_name'] as String? ?? '',
      courseCode: json['course_code'] as String? ?? '',
      room: json['room'] as String? ?? '',
      startedAt: json['started_at'] as String? ?? '',
      secondsSinceStart: json['seconds_since_start'] as int? ?? 0,
      presentDeadlineSeconds: json['present_deadline_seconds'] as int? ?? 0,
      lateDeadlineSeconds: json['late_deadline_seconds'] as int? ?? 0,
    );
  }

  bool get isLate => secondsSinceStart > presentDeadlineSeconds;
  bool get isClosed => secondsSinceStart > lateDeadlineSeconds;
}
