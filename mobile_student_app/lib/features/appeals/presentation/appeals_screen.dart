import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import '../../../shared/models/appeal_model.dart';
import '../../../shared/models/attendance_model.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/app_theme.dart';

class AppealsScreen extends StatefulWidget {
  const AppealsScreen({super.key});

  @override
  State<AppealsScreen> createState() => _AppealsScreenState();
}

class _AppealsScreenState extends State<AppealsScreen> {
  List<AppealModel> _appeals = [];
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
      final resp = await ApiClient.get('/api/appeals/me');
      setState(() {
        _appeals = (resp.data as List<dynamic>)
            .map((e) => AppealModel.fromJson(e as Map<String, dynamic>))
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

  void _showCreateDialog() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _CreateAppealSheet(onCreated: _load),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(tr('nav.appeals'))),
      floatingActionButton: FloatingActionButton(
        onPressed: _showCreateDialog,
        child: const Icon(Icons.add),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Text(_error!))
                : _appeals.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.gavel_outlined,
                                size: 64, color: Colors.grey),
                            const SizedBox(height: 12),
                            Text(
                              tr('appeals.no_appeals'),
                              style: const TextStyle(color: Colors.grey),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        itemCount: _appeals.length,
                        itemBuilder: (_, i) =>
                            _AppealCard(appeal: _appeals[i]),
                      ),
      ),
    );
  }
}

class _AppealCard extends StatelessWidget {
  final AppealModel appeal;
  const _AppealCard({required this.appeal});

  @override
  Widget build(BuildContext context) {
    final color = _statusColor(appeal.status);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    appeal.courseName ?? tr('appeals.unknown_course'),
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    appeal.status,
                    style: TextStyle(
                        color: color,
                        fontWeight: FontWeight.w600,
                        fontSize: 12),
                  ),
                ),
              ],
            ),
            if (appeal.sessionDate != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(appeal.sessionDate!,
                    style:
                        const TextStyle(color: Colors.grey, fontSize: 12)),
              ),
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(appeal.reason),
            ),
          ],
        ),
      ),
    );
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'APPROVED':
        return Colors.green;
      case 'REJECTED':
        return Colors.red;
      default:
        return Colors.orange;
    }
  }
}

class _CreateAppealSheet extends StatefulWidget {
  final VoidCallback onCreated;
  const _CreateAppealSheet({required this.onCreated});

  @override
  State<_CreateAppealSheet> createState() => _CreateAppealSheetState();
}

class _CreateAppealSheetState extends State<_CreateAppealSheet> {
  final _reasonCtrl = TextEditingController();
  int? _selectedAttendanceId;
  List<AttendanceRecord> _absents = [];
  bool _loading = false;
  bool _fetching = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadAbsents();
  }

  Future<void> _loadAbsents() async {
    try {
      final resp = await ApiClient.get('/api/attendance/student/me');
      final all = (resp.data as List<dynamic>)
          .map((e) => AttendanceRecord.fromJson(e as Map<String, dynamic>))
          .toList();
      setState(() {
        _absents =
            all.where((r) => r.status == 'ABSENT').toList();
        _fetching = false;
      });
    } catch (_) {
      setState(() => _fetching = false);
    }
  }

  Future<void> _submit() async {
    if (_selectedAttendanceId == null || _reasonCtrl.text.trim().isEmpty) {
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ApiClient.post('/api/appeals', data: {
        'attendance_id': _selectedAttendanceId,
        'reason': _reasonCtrl.text.trim(),
      });
      Navigator.of(context).pop();
      widget.onCreated();
    } catch (_) {
      setState(() {
        _loading = false;
        _error = tr('error.submit_failed');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            tr('appeals.create'),
            style: const TextStyle(
                fontWeight: FontWeight.bold, fontSize: 18),
          ),
          const SizedBox(height: 16),
          if (_fetching)
            const Center(child: CircularProgressIndicator())
          else if (_absents.isEmpty)
            Text(tr('appeals.no_absences'),
                style: const TextStyle(color: Colors.grey))
          else ...[
            DropdownButtonFormField<int>(
              value: _selectedAttendanceId,
              hint: Text(tr('appeals.select_absence')),
              items: _absents
                  .map((r) => DropdownMenuItem(
                        value: r.id,
                        child: Text(
                          '${r.courseName ?? 'Session ${r.sessionId}'} · ${r.sessionDate ?? ''}',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ))
                  .toList(),
              onChanged: (v) =>
                  setState(() => _selectedAttendanceId = v),
              decoration: InputDecoration(
                labelText: tr('appeals.absence'),
              ),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _reasonCtrl,
              maxLines: 3,
              decoration: InputDecoration(
                labelText: tr('appeals.reason'),
                alignLabelWithHint: true,
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loading ? null : _submit,
              child: _loading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2),
                    )
                  : Text(tr('submit')),
            ),
          ],
        ],
      ),
    );
  }
}
