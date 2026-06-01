class AppealModel {
  final int id;
  final int attendanceId;
  final String reason;
  final String status;
  final String createdAt;
  final String? courseName;
  final String? sessionDate;

  const AppealModel({
    required this.id,
    required this.attendanceId,
    required this.reason,
    required this.status,
    required this.createdAt,
    this.courseName,
    this.sessionDate,
  });

  factory AppealModel.fromJson(Map<String, dynamic> json) {
    final attendance = json['attendance'] as Map<String, dynamic>?;
    final session = attendance?['session'] as Map<String, dynamic>?;
    final schedule = session?['schedule'] as Map<String, dynamic>?;
    final course = schedule?['course'] as Map<String, dynamic>?;

    return AppealModel(
      id: json['id'] as int,
      attendanceId: json['attendance_id'] as int? ?? 0,
      reason: json['reason'] as String? ?? '',
      status: json['status'] as String? ?? 'PENDING',
      createdAt: json['created_at'] as String? ?? '',
      courseName: course?['name'] as String?,
      sessionDate: session?['date'] as String?,
    );
  }
}
