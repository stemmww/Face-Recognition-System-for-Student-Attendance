class UserModel {
  final int id;
  final String email;
  final String firstName;
  final String lastName;
  final String role;
  final bool isActive;
  final String? photoUrl;
  final bool canSelfEnrollFace;
  final String? faceEnrollmentStatus;
  final bool hasFaceEmbedding;

  const UserModel({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.role,
    required this.isActive,
    this.photoUrl,
    required this.canSelfEnrollFace,
    this.faceEnrollmentStatus,
    required this.hasFaceEmbedding,
  });

  String get fullName => '$firstName $lastName';

  factory UserModel.fromJson(Map<String, dynamic> json) => UserModel(
        id: json['id'] as int,
        email: json['email'] as String,
        firstName: json['first_name'] as String,
        lastName: json['last_name'] as String,
        role: json['role'] as String,
        isActive: json['is_active'] as bool? ?? true,
        photoUrl: json['photo_url'] as String?,
        canSelfEnrollFace: json['can_self_enroll_face'] as bool? ?? false,
        faceEnrollmentStatus: json['face_enrollment_status'] as String?,
        hasFaceEmbedding: json['has_face_embedding'] as bool? ?? false,
      );
}
