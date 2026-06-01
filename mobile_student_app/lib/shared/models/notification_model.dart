class NotificationModel {
  final int id;
  final String message;
  final bool isRead;
  final String createdAt;

  const NotificationModel({
    required this.id,
    required this.message,
    required this.isRead,
    required this.createdAt,
  });

  factory NotificationModel.fromJson(Map<String, dynamic> json) =>
      NotificationModel(
        id: json['id'] as int,
        message: json['message'] as String? ?? '',
        isRead: json['is_read'] as bool? ?? false,
        createdAt: json['created_at'] as String? ?? '',
      );
}
