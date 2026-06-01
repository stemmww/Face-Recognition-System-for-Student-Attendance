import 'package:dio/dio.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/token_storage.dart';
import '../../../shared/models/attendance_model.dart';
import 'liveness_capture_screen.dart';
import 'qr_scan_screen.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  List<ActiveSession> _sessions = [];
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
      final resp = await ApiClient.get('/api/sessions/student/active');
      setState(() {
        _sessions = (resp.data as List<dynamic>)
            .map((e) => ActiveSession.fromJson(e as Map<String, dynamic>))
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
      appBar: AppBar(
        title: Text(tr('nav.attendance')),
        actions: [
          IconButton(
            icon: const Icon(Icons.history),
            tooltip: tr('nav.attendance_history'),
            onPressed: () => context.go('/dashboard/attendance-history'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Text(_error!))
                : _sessions.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.event_available_outlined,
                                size: 64, color: Colors.grey),
                            const SizedBox(height: 12),
                            Text(
                              tr('attendance.no_active_sessions'),
                              style: const TextStyle(color: Colors.grey),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        itemCount: _sessions.length,
                        itemBuilder: (_, i) => _SessionCard(
                          session: _sessions[i],
                          onSuccess: _load,
                        ),
                      ),
      ),
    );
  }
}

class _SessionCard extends StatefulWidget {
  final ActiveSession session;
  final VoidCallback onSuccess;
  const _SessionCard({required this.session, required this.onSuccess});

  @override
  State<_SessionCard> createState() => _SessionCardState();
}

class _SessionCardState extends State<_SessionCard> {
  bool _loading = false;
  bool? _resultSuccess;
  String _resultMessage = '';

  Future<void> _startVerify() async {
    // Step 1: Scan QR
    final qrToken = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const QrScanScreen()),
    );
    if (qrToken == null || !mounted) return;

    // Step 2: Get challenge token + instruction
    String challengeToken;
    String instruction;
    try {
      final resp = await ApiClient.post(
        '/api/attend/challenge',
        data: FormData.fromMap({'token': qrToken}),
        options: Options(contentType: 'multipart/form-data'),
      );
      challengeToken = resp.data['token'] as String;
      instruction = resp.data['instruction'] as String?
          ?? tr('attendance.look_at_camera');
    } catch (e) {
      if (!mounted) return;
      _showResult(false, _extractError(e) ?? tr('attendance.challenge_failed'));
      return;
    }

    if (!mounted) return;

    // Step 3: Capture 12 frames
    final captureResult = await Navigator.of(context).push<LivenessCaptureResult>(
      MaterialPageRoute(
        builder: (_) => LivenessCaptureScreen(
          instruction: instruction,
          frameCount: 12,
          countdownSeconds: 3,
        ),
      ),
    );
    if (captureResult == null || captureResult.frames.isEmpty || !mounted) return;

    // Step 4: Submit frames
    setState(() => _loading = true);
    try {
      final token = await TokenStorage.getAccessToken();
      final fields = <String, dynamic>{
        'token': qrToken,
        'challenge_token': challengeToken,
        'frames': await Future.wait(
          captureResult.frames.asMap().entries.map((e) =>
              MultipartFile.fromFile(e.value.path,
                  filename: 'frame_${e.key}.jpg')),
        ),
      };
      final resp = await ApiClient.dio.post(
        '/api/attend/verify',
        data: FormData.fromMap(fields),
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
      if (!mounted) return;
      final data = resp.data as Map<String, dynamic>;
      final success = data['success'] as bool? ?? false;
      final status = data['status'] as String?;
      final message = data['message'] as String? ?? '';
      setState(() => _loading = false);
      _showResult(
        success,
        success
            ? '${tr('attendance.status.${status ?? 'PRESENT'}')}\n$message'
            : message,
      );
      if (success) widget.onSuccess();
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      _showResult(false, _extractError(e) ?? tr('error.generic'));
    }
  }

  void _showResult(bool success, String message) {
    setState(() {
      _resultSuccess = success;
      _resultMessage = message;
    });
  }

  String? _extractError(Object e) {
    try {
      final data = (e as dynamic).response?.data;
      if (data is Map) return data['detail']?.toString();
    } catch (_) {}
    return null;
  }

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
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.green.shade100,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.circle, color: Colors.green, size: 8),
                      const SizedBox(width: 4),
                      Text(tr('attendance.active'),
                          style: const TextStyle(
                              color: Colors.green,
                              fontWeight: FontWeight.w600,
                              fontSize: 12)),
                    ],
                  ),
                ),
                const Spacer(),
                if (widget.session.isLate)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.orange.shade100,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(tr('attendance.late'),
                        style: TextStyle(
                            color: Colors.orange.shade800,
                            fontWeight: FontWeight.w600,
                            fontSize: 12)),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            Text(widget.session.courseName,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
            if (widget.session.room.isNotEmpty)
              _Row(Icons.room_outlined, widget.session.room),
            if (widget.session.courseCode.isNotEmpty)
              _Row(Icons.tag, widget.session.courseCode),
            // Result banner
            if (_resultSuccess != null) ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _resultSuccess!
                      ? Colors.green.shade50
                      : Colors.red.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                      color: _resultSuccess!
                          ? Colors.green.shade300
                          : Colors.red.shade300),
                ),
                child: Row(
                  children: [
                    Icon(
                      _resultSuccess! ? Icons.check_circle : Icons.error_outline,
                      color: _resultSuccess! ? Colors.green : Colors.red,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(_resultMessage,
                          style: TextStyle(
                              color: _resultSuccess!
                                  ? Colors.green.shade800
                                  : Colors.red.shade800)),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 14),
            ElevatedButton.icon(
              icon: _loading
                  ? const SizedBox(
                      width: 18, height: 18,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2))
                  : const Icon(Icons.qr_code_scanner),
              label: Text(_loading
                  ? tr('attendance.verifying')
                  : tr('attendance.scan_and_verify')),
              onPressed: _loading ? null : _startVerify,
            ),
          ],
        ),
      ),
    );
  }

}

class _Row extends StatelessWidget {
  final IconData icon;
  final String text;
  const _Row(this.icon, this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        children: [
          Icon(icon, size: 14, color: Colors.grey),
          const SizedBox(width: 6),
          Text(text,
              style: const TextStyle(fontSize: 13, color: Colors.black87)),
        ],
      ),
    );
  }
}
