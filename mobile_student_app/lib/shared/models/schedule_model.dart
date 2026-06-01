class ScheduleModel {
  final int id;
  final String courseName;
  final String courseCode;
  final String dayOfWeek;
  final String startTime;
  final String endTime;
  final String lessonType;
  final String semester;
  final String academicYear;
  final String? professorName;
  final String? classroomName;
  final List<String> groupNames;

  const ScheduleModel({
    required this.id,
    required this.courseName,
    required this.courseCode,
    required this.dayOfWeek,
    required this.startTime,
    required this.endTime,
    required this.lessonType,
    required this.semester,
    required this.academicYear,
    this.professorName,
    this.classroomName,
    required this.groupNames,
  });

  factory ScheduleModel.fromJson(Map<String, dynamic> json) {
    final course = json['course'] as Map<String, dynamic>?;
    final professor = json['professor'] as Map<String, dynamic>?;
    final classroom = json['classroom'] as Map<String, dynamic>?;
    final groups = json['groups'] as List<dynamic>?;

    String profName = '';
    if (professor != null) {
      final fn = professor['first_name'] as String? ?? '';
      final ln = professor['last_name'] as String? ?? '';
      profName = '$fn $ln'.trim();
    }

    final groupNames = <String>[];
    if (groups != null) {
      for (final g in groups) {
        final gm = g as Map<String, dynamic>;
        groupNames.add(gm['name'] as String? ?? '');
      }
    }

    return ScheduleModel(
      id: json['id'] as int,
      courseName: course?['name'] as String? ?? json['course_name'] as String? ?? '',
      courseCode: course?['code'] as String? ?? '',
      dayOfWeek: json['day_of_week'] as String? ?? '',
      startTime: json['start_time'] as String? ?? '',
      endTime: json['end_time'] as String? ?? '',
      lessonType: json['lesson_type'] as String? ?? '',
      semester: json['semester'] as String? ?? '',
      academicYear: json['academic_year'] as String? ?? '',
      professorName: profName.isEmpty ? null : profName,
      classroomName: classroom?['name'] as String?,
      groupNames: groupNames,
    );
  }

  static const _dayOrder = {
    'MONDAY': 0,
    'TUESDAY': 1,
    'WEDNESDAY': 2,
    'THURSDAY': 3,
    'FRIDAY': 4,
    'SATURDAY': 5,
    'SUNDAY': 6,
  };

  int get dayIndex => _dayOrder[dayOfWeek.toUpperCase()] ?? 7;
}
