import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/user_model.dart';
import '../../core/storage/token_storage.dart';
import '../../core/network/api_client.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthState {
  final AuthStatus status;
  final UserModel? user;
  final String? error;

  const AuthState({
    required this.status,
    this.user,
    this.error,
  });

  bool get isStudent => user?.role == 'student';
}

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier()
      : super(const AuthState(status: AuthStatus.unknown));

  Future<void> checkAuth() async {
    final token = await TokenStorage.getAccessToken();
    if (token == null) {
      state = const AuthState(status: AuthStatus.unauthenticated);
      return;
    }
    try {
      final resp = await ApiClient.get('/api/users/me');
      final user = UserModel.fromJson(resp.data as Map<String, dynamic>);
      if (user.role != 'student') {
        await TokenStorage.clear();
        state = const AuthState(
          status: AuthStatus.unauthenticated,
          error: 'not_student',
        );
        return;
      }
      state = AuthState(status: AuthStatus.authenticated, user: user);
    } catch (_) {
      await TokenStorage.clear();
      state = const AuthState(status: AuthStatus.unauthenticated);
    }
  }

  Future<String?> login(String email, String password) async {
    try {
      final resp = await ApiClient.post(
        '/api/auth/login',
        data: {'email': email, 'password': password},
      );
      final data = resp.data as Map<String, dynamic>;
      await TokenStorage.saveTokens(
        accessToken: data['access_token'] as String,
        refreshToken: data['refresh_token'] as String?,
      );
      final userResp = await ApiClient.get('/api/users/me');
      final user = UserModel.fromJson(userResp.data as Map<String, dynamic>);
      if (user.role != 'student') {
        await TokenStorage.clear();
        return 'not_student';
      }
      state = AuthState(status: AuthStatus.authenticated, user: user);
      return null;
    } catch (e) {
      return _extractError(e);
    }
  }

  Future<void> logout() async {
    await TokenStorage.clear();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }

  Future<void> refreshUser() async {
    try {
      final resp = await ApiClient.get('/api/users/me');
      final user = UserModel.fromJson(resp.data as Map<String, dynamic>);
      state = AuthState(status: AuthStatus.authenticated, user: user);
    } catch (_) {}
  }

  String _extractError(Object e) {
    try {
      final dioError = e as dynamic;
      final data = dioError.response?.data;
      if (data is Map) {
        return data['detail']?.toString() ?? 'login_failed';
      }
    } catch (_) {}
    return 'login_failed';
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>(
  (ref) => AuthNotifier(),
);
