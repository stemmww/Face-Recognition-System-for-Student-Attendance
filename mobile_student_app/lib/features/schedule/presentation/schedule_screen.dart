import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import '../../../shared/models/schedule_model.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/app_theme.dart';

class ScheduleScreen extends StatefulWidget {
  const ScheduleScreen({super.key});

  @override
  State<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends State<ScheduleScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  Map<int, List<ScheduleModel>> _byDay = {};
  bool _loading = true;
  String? _error;

  // 0=Mon … 6=Sun
  static const _dayKeys = [
    'schedule.monday',
    'schedule.tuesday',
    'schedule.wednesday',
    'schedule.thursday',
    'schedule.friday',
    'schedule.saturday',
    'schedule.sunday',
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 7, vsync: this);
    // Jump to today's tab
    final today = DateTime.now().weekday - 1; // 0=Mon
    _tabController.index = today.clamp(0, 6);
    _load();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final resp = await ApiClient.get('/api/schedules/my');
      final items = (resp.data as List<dynamic>)
          .map((e) => ScheduleModel.fromJson(e as Map<String, dynamic>))
          .toList();
      final map = <int, List<ScheduleModel>>{};
      for (var i = 0; i < 7; i++) {
        map[i] = items.where((s) => s.dayIndex == i).toList()
          ..sort((a, b) => a.startTime.compareTo(b.startTime));
      }
      setState(() {
        _byDay = map;
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
      appBar: AppBar(
        title: Text(tr('nav.schedule')),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          indicatorColor: Colors.white,
          tabs: _dayKeys
              .map((k) => Tab(text: tr(k).substring(0, 3).toUpperCase()))
              .toList(),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : TabBarView(
                  controller: _tabController,
                  children: List.generate(7, (i) {
                    final lessons = _byDay[i] ?? [];
                    if (lessons.isEmpty) {
                      return Center(
                        child: Text(
                          tr('schedule.no_classes_today'),
                          style: const TextStyle(color: Colors.grey),
                        ),
                      );
                    }
                    return RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.builder(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        itemCount: lessons.length,
                        itemBuilder: (_, j) =>
                            _LessonCard(lesson: lessons[j]),
                      ),
                    );
                  }),
                ),
    );
  }
}

class _LessonCard extends StatelessWidget {
  final ScheduleModel lesson;
  const _LessonCard({required this.lesson});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Time column
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  _fmt(lesson.startTime),
                  style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                      color: AppTheme.primary),
                ),
                Text(
                  _fmt(lesson.endTime),
                  style:
                      const TextStyle(fontSize: 12, color: Colors.grey),
                ),
              ],
            ),
            const SizedBox(width: 12),
            Container(width: 2, height: 40, color: AppTheme.primary),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    lesson.courseName,
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                  if (lesson.professorName != null)
                    _Detail(Icons.person_outline, lesson.professorName!),
                  if (lesson.classroomName != null)
                    _Detail(Icons.room_outlined, lesson.classroomName!),
                  if (lesson.groupNames.isNotEmpty)
                    _Detail(Icons.group_outlined,
                        lesson.groupNames.join(', ')),
                  _LessonTypeBadge(lesson.lessonType),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _fmt(String t) =>
      t.length >= 5 ? t.substring(0, 5) : t;
}

class _Detail extends StatelessWidget {
  final IconData icon;
  final String text;
  const _Detail(this.icon, this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 3),
      child: Row(
        children: [
          Icon(icon, size: 13, color: Colors.grey),
          const SizedBox(width: 4),
          Expanded(
            child: Text(text,
                style:
                    const TextStyle(fontSize: 12, color: Colors.black87)),
          ),
        ],
      ),
    );
  }
}

class _LessonTypeBadge extends StatelessWidget {
  final String type;
  const _LessonTypeBadge(this.type);

  @override
  Widget build(BuildContext context) {
    final color = type.toUpperCase() == 'LECTURE' ? AppTheme.primary : Colors.teal;
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(
          color: color.withOpacity(0.12),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(
          type,
          style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w600),
        ),
      ),
    );
  }
}
