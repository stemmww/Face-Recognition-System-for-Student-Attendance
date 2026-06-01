import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import '../../../shared/models/course_model.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/app_theme.dart';

class SubjectsScreen extends StatefulWidget {
  const SubjectsScreen({super.key});

  @override
  State<SubjectsScreen> createState() => _SubjectsScreenState();
}

class _SubjectsScreenState extends State<SubjectsScreen> {
  List<CourseModel> _courses = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final resp = await ApiClient.get('/api/courses');
      final data = resp.data as List<dynamic>;
      setState(() {
        _courses = data
            .map((e) => CourseModel.fromJson(e as Map<String, dynamic>))
            .toList();
        _loading = false;
      });
    } catch (_) {
      setState(() {
        _loading = false;
        _error = tr('error.load_failed');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(tr('nav.subjects'))),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Text(_error!))
                : _courses.isEmpty
                    ? Center(child: Text(tr('subjects.no_subjects')))
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        itemCount: _courses.length,
                        itemBuilder: (_, i) =>
                            _CourseCard(course: _courses[i]),
                      ),
      ),
    );
  }
}

class _CourseCard extends StatelessWidget {
  final CourseModel course;
  const _CourseCard({required this.course});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    course.name,
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: _lessonColor(course.lessonType),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    course.lessonType,
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            _Tag(icon: Icons.tag, text: course.code),
            _Tag(
              icon: Icons.calendar_month_outlined,
              text: '${course.semester} · ${course.academicYear}',
            ),
            if (course.professorNames.isNotEmpty)
              _Tag(
                icon: Icons.person_outline,
                text: course.professorNames.join(', '),
              ),
          ],
        ),
      ),
    );
  }

  Color _lessonColor(String type) {
    switch (type.toUpperCase()) {
      case 'LECTURE':
        return AppTheme.primary;
      case 'PRACTICE':
        return Colors.teal;
      default:
        return Colors.grey;
    }
  }
}

class _Tag extends StatelessWidget {
  final IconData icon;
  final String text;
  const _Tag({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        children: [
          Icon(icon, size: 14, color: Colors.grey),
          const SizedBox(width: 6),
          Expanded(
            child: Text(text,
                style: const TextStyle(color: Colors.black87, fontSize: 13)),
          ),
        ],
      ),
    );
  }
}
