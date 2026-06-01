import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import '../../../shared/models/attendance_model.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/app_theme.dart';

class AttendanceHistoryScreen extends StatefulWidget {
  const AttendanceHistoryScreen({super.key});

  @override
  State<AttendanceHistoryScreen> createState() =>
      _AttendanceHistoryScreenState();
}

class _AttendanceHistoryScreenState extends State<AttendanceHistoryScreen> {
  List<AttendanceRecord> _records = [];
  bool _loading = true;
  String? _error;
  String _filter = 'ALL';

  static const _statuses = ['ALL', 'PRESENT', 'LATE', 'ABSENT'];

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
      final resp = await ApiClient.get('/api/attendance/student/me');
      setState(() {
        _records = (resp.data as List<dynamic>)
            .map((e) =>
                AttendanceRecord.fromJson(e as Map<String, dynamic>))
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

  List<AttendanceRecord> get _filtered => _filter == 'ALL'
      ? _records
      : _records.where((r) => r.status == _filter).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(tr('nav.attendance_history'))),
      body: Column(
        children: [
          // Filter chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: _statuses.map((s) {
                final selected = _filter == s;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(
                      s == 'ALL' ? tr('all') : tr('attendance.status.$s'),
                    ),
                    selected: selected,
                    onSelected: (_) => setState(() => _filter = s),
                    selectedColor: _statusColor(s).withOpacity(0.2),
                    checkmarkColor: _statusColor(s),
                    labelStyle: TextStyle(
                      color: selected ? _statusColor(s) : Colors.black87,
                      fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _load,
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null
                      ? Center(child: Text(_error!))
                      : _filtered.isEmpty
                          ? Center(
                              child: Text(
                                tr('attendance.no_records'),
                                style: const TextStyle(color: Colors.grey),
                              ),
                            )
                          : ListView.builder(
                              padding:
                                  const EdgeInsets.symmetric(vertical: 4),
                              itemCount: _filtered.length,
                              itemBuilder: (_, i) =>
                                  _RecordCard(record: _filtered[i]),
                            ),
            ),
          ),
        ],
      ),
    );
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'PRESENT':
        return Colors.green;
      case 'LATE':
        return Colors.orange;
      case 'ABSENT':
        return Colors.red;
      default:
        return AppTheme.primary;
    }
  }
}

class _RecordCard extends StatelessWidget {
  final AttendanceRecord record;
  const _RecordCard({required this.record});

  @override
  Widget build(BuildContext context) {
    final color = _statusColor(record.status);

    return Card(
      child: ListTile(
        leading: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: color.withOpacity(0.12),
            shape: BoxShape.circle,
          ),
          child: Icon(_statusIcon(record.status), color: color, size: 22),
        ),
        title: Text(
          record.courseName ?? tr('attendance.unknown_course'),
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (record.sessionDate != null)
              Text(record.sessionDate!,
                  style: const TextStyle(fontSize: 12)),
            if (record.recognizedAt != null)
              Text(
                '${tr('attendance.check_in')}: ${_formatTime(record.recognizedAt!)}',
                style: const TextStyle(fontSize: 12, color: Colors.grey),
              ),
          ],
        ),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: color.withOpacity(0.12),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            record.status,
            style: TextStyle(
                color: color,
                fontWeight: FontWeight.w600,
                fontSize: 12),
          ),
        ),
        isThreeLine: record.recognizedAt != null,
      ),
    );
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'PRESENT':
        return Colors.green;
      case 'LATE':
        return Colors.orange;
      case 'ABSENT':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  IconData _statusIcon(String s) {
    switch (s) {
      case 'PRESENT':
        return Icons.check_circle_outline;
      case 'LATE':
        return Icons.schedule;
      case 'ABSENT':
        return Icons.cancel_outlined;
      default:
        return Icons.help_outline;
    }
  }

  String _formatTime(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return iso;
    }
  }
}
