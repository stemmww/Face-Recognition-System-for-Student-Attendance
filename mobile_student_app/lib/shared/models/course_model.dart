class CourseModel {
  final int id;
  final String code;
  final String name;
  final String? description;
  final String semester;
  final String academicYear;
  final String lessonType;
  final String groupType;
  final List<String> professorNames;

  const CourseModel({
    required this.id,
    required this.code,
    required this.name,
    this.description,
    required this.semester,
    required this.academicYear,
    required this.lessonType,
    required this.groupType,
    required this.professorNames,
  });

  factory CourseModel.fromJson(Map<String, dynamic> json) {
    final professors = <String>[];
    final rawProfs = json['professors'] as List<dynamic>?;
    if (rawProfs != null) {
      for (final p in rawProfs) {
        final m = p as Map<String, dynamic>;
        final fn = m['first_name'] as String? ?? '';
        final ln = m['last_name'] as String? ?? '';
        professors.add('$fn $ln'.trim());
      }
    }
    return CourseModel(
      id: json['id'] as int,
      code: json['code'] as String? ?? '',
      name: json['name'] as String,
      description: json['description'] as String?,
      semester: json['semester'] as String? ?? '',
      academicYear: json['academic_year'] as String? ?? '',
      lessonType: json['lesson_type'] as String? ?? '',
      groupType: json['group_type'] as String? ?? '',
      professorNames: professors,
    );
  }
}
