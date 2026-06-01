import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../shared/providers/auth_provider.dart';
import '../../../shared/models/attendance_model.dart';
import '../../../shared/models/schedule_model.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/app_theme.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  List<ActiveSession> _activeSessions = [];
  List<ScheduleModel> _todaySchedule = [];
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
      final todayName = _todayDayName();
      final results = await Future.wait([
        ApiClient.get('/api/sessions/student/active'),
        ApiClient.get('/api/schedules/my'),
      ]);

      final sessions = (results[0].data as List<dynamic>)
          .map((e) => ActiveSession.fromJson(e as Map<String, dynamic>))
          .toList();

      final allSchedule = (results[1].data as List<dynamic>)
          .map((e) => ScheduleModel.fromJson(e as Map<String, dynamic>))
          .toList();

      final todaySchedule = allSchedule
          .where((s) => s.dayOfWeek.toUpperCase() == todayName)
          .toList()
        ..sort((a, b) => a.startTime.compareTo(b.startTime));

      setState(() {
        _activeSessions = sessions;
        _todaySchedule = todaySchedule;
        _loading = false;
      });
    } catch (_) {
      setState(() {
        _loading = false;
        _error = tr('error.load_failed');
      });
    }
  }

  String _todayDayName() {
    const days = [
      'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'
    ];
    return days[DateTime.now().weekday - 1];
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;

    return Scaffold(
      appBar: AppBar(
        title: Text(tr('nav.dashboard')),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () => context.go('/dashboard/notifications'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Text(_error!))
                : ListView(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    children: [
                      _WelcomeCard(
                        name: user?.firstName ?? '',
                        canEnroll: user?.canSelfEnrollFace ?? false,
                        hasEmbedding: user?.hasFaceEmbedding ?? false,
                      ),
                      if (_activeSessions.isNotEmpty) ...[
                        _SectionHeader(title: tr('dashboard.active_sessions')),
                        ..._activeSessions.map(
                          (s) => _ActiveSessionCard(session: s),
                        ),
                      ],
                      _SectionHeader(title: tr('dashboard.today_schedule')),
                      if (_todaySchedule.isEmpty)
                        Padding(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 8),
                          child: Text(
                            tr('schedule.no_classes_today'),
                            style: const TextStyle(color: Colors.grey),
                          ),
                        )
                      else
                        ..._todaySchedule.map(
                          (s) => _ScheduleCard(schedule: s),
                        ),
                      const SizedBox(height: 16),
                      _QuickNav(),
                      const SizedBox(height: 24),
                    ],
                  ),
      ),
    );
  }
}

class _WelcomeCard extends StatelessWidget {
  final String name;
  final bool canEnroll;
  final bool hasEmbedding;

  const _WelcomeCard({
    required this.name,
    required this.canEnroll,
    required this.hasEmbedding,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.all(16),
      color: AppTheme.primary,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${tr('dashboard.hello')}, $name!',
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            Text(
              DateFormat('EEEE, d MMMM yyyy').format(DateTime.now()),
              style: const TextStyle(color: Colors.white70),
            ),
            if (canEnroll && !hasEmbedding) ...[
              const SizedBox(height: 12),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.orange.shade700,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.warning_amber, color: Colors.white, size: 16),
                    const SizedBox(width: 6),
                    Text(
                      tr('face_enrollment.not_enrolled'),
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Text(
        title,
        style: const TextStyle(
            fontWeight: FontWeight.bold, fontSize: 16, color: Colors.black87),
      ),
    );
  }
}

class _ActiveSessionCard extends StatelessWidget {
  final ActiveSession session;
  const _ActiveSessionCard({required this.session});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Colors.green.shade100,
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.play_circle, color: Colors.green),
        ),
        title: Text(session.courseName,
            style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(
          [
            if (session.room.isNotEmpty) session.room,
            if (session.courseCode.isNotEmpty) session.courseCode,
          ].join(' · '),
        ),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => context.go('/dashboard/attendance'),
      ),
    );
  }
}

class _ScheduleCard extends StatelessWidget {
  final ScheduleModel schedule;
  const _ScheduleCard({required this.schedule});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: Container(
          width: 48,
          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 2),
          decoration: BoxDecoration(
            color: AppTheme.primary.withOpacity(0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                schedule.startTime.length >= 5
                    ? schedule.startTime.substring(0, 5)
                    : schedule.startTime,
                style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.primary),
              ),
              const Text('|',
                  style: TextStyle(fontSize: 8, color: Colors.grey)),
              Text(
                schedule.endTime.length >= 5
                    ? schedule.endTime.substring(0, 5)
                    : schedule.endTime,
                style: const TextStyle(fontSize: 10, color: Colors.grey),
              ),
            ],
          ),
        ),
        title: Text(schedule.courseName,
            style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(
          [
            if (schedule.professorName != null) schedule.professorName!,
            if (schedule.classroomName != null) schedule.classroomName!,
          ].join(' · '),
        ),
      ),
    );
  }
}

class _QuickNav extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final items = [
      (Icons.book_outlined, 'nav.subjects', '/dashboard/subjects'),
      (Icons.calendar_today_outlined, 'nav.schedule', '/dashboard/schedule'),
      (Icons.history_outlined, 'nav.attendance_history', '/dashboard/attendance-history'),
      (Icons.gavel_outlined, 'nav.appeals', '/dashboard/appeals'),
    ];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: GridView.count(
        crossAxisCount: 2,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 2.5,
        children: items
            .map((e) => _NavCard(icon: e.$1, labelKey: e.$2, route: e.$3))
            .toList(),
      ),
    );
  }
}

class _NavCard extends StatelessWidget {
  final IconData icon;
  final String labelKey;
  final String route;

  const _NavCard(
      {required this.icon, required this.labelKey, required this.route});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => context.go(route),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade200),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 4,
              offset: const Offset(0, 2),
            )
          ],
        ),
        child: Row(
          children: [
            Icon(icon, color: AppTheme.primary, size: 22),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                tr(labelKey),
                style: const TextStyle(
                    fontWeight: FontWeight.w500, fontSize: 13),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
