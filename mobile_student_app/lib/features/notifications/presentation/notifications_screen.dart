import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import '../../../shared/models/notification_model.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/app_theme.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<NotificationModel> _notifications = [];
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
      final resp = await ApiClient.get('/api/notifications');
      setState(() {
        _notifications = (resp.data as List<dynamic>)
            .map((e) =>
                NotificationModel.fromJson(e as Map<String, dynamic>))
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

  Future<void> _markAllRead() async {
    try {
      await ApiClient.post('/api/notifications/read-all');
      setState(() {
        _notifications = _notifications
            .map((n) => NotificationModel(
                  id: n.id,
                  message: n.message,
                  isRead: true,
                  createdAt: n.createdAt,
                ))
            .toList();
      });
    } catch (_) {}
  }

  Future<void> _markRead(NotificationModel n) async {
    if (n.isRead) return;
    try {
      await ApiClient.patch('/api/notifications/${n.id}/read');
      setState(() {
        final idx = _notifications.indexOf(n);
        if (idx >= 0) {
          _notifications[idx] = NotificationModel(
            id: n.id,
            message: n.message,
            isRead: true,
            createdAt: n.createdAt,
          );
        }
      });
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final unread = _notifications.where((n) => !n.isRead).length;

    return Scaffold(
      appBar: AppBar(
        title: Text(tr('nav.notifications')),
        actions: [
          if (unread > 0)
            TextButton(
              onPressed: _markAllRead,
              child: Text(
                tr('notifications.mark_all_read'),
                style: const TextStyle(color: Colors.white),
              ),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Text(_error!))
                : _notifications.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.notifications_none,
                                size: 64, color: Colors.grey),
                            const SizedBox(height: 12),
                            Text(
                              tr('notifications.empty'),
                              style: const TextStyle(color: Colors.grey),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        itemCount: _notifications.length,
                        itemBuilder: (_, i) {
                          final n = _notifications[i];
                          return _NotifTile(
                            notification: n,
                            onTap: () => _markRead(n),
                          );
                        },
                      ),
      ),
    );
  }
}

class _NotifTile extends StatelessWidget {
  final NotificationModel notification;
  final VoidCallback onTap;
  const _NotifTile({required this.notification, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final unread = !notification.isRead;
    return InkWell(
      onTap: onTap,
      child: Container(
        color: unread
            ? AppTheme.primary.withOpacity(0.05)
            : Colors.transparent,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 8,
              height: 8,
              margin: const EdgeInsets.only(top: 6, right: 12),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: unread ? AppTheme.primary : Colors.transparent,
              ),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    notification.message,
                    style: TextStyle(
                      fontWeight:
                          unread ? FontWeight.w600 : FontWeight.normal,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _formatDate(notification.createdAt),
                    style: const TextStyle(
                        color: Colors.grey, fontSize: 12),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      return DateFormat('d MMM yyyy HH:mm').format(dt);
    } catch (_) {
      return iso;
    }
  }
}
