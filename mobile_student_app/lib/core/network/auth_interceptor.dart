import 'package:dio/dio.dart';
import '../storage/token_storage.dart';

class AuthInterceptor extends Interceptor {
  final Dio _dio;
  bool _isRefreshing = false;

  AuthInterceptor(this._dio);

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await TokenStorage.getAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (err.response?.statusCode == 401 && !_isRefreshing) {
      _isRefreshing = true;
      try {
        final refreshToken = await TokenStorage.getRefreshToken();
        if (refreshToken != null) {
          final response = await _dio.post(
            '/api/auth/refresh',
            data: {'refresh_token': refreshToken},
            options: Options(headers: {'Authorization': null}),
          );
          final newAccess = response.data['access_token'] as String;
          final newRefresh = response.data['refresh_token'] as String?;
          await TokenStorage.saveTokens(
            accessToken: newAccess,
            refreshToken: newRefresh,
          );
          // Retry original request with new token
          final opts = err.requestOptions;
          opts.headers['Authorization'] = 'Bearer $newAccess';
          final retried = await _dio.fetch(opts);
          handler.resolve(retried);
          return;
        }
      } catch (_) {
        // Refresh failed — clear tokens and let the error propagate
      } finally {
        _isRefreshing = false;
      }
      await TokenStorage.clear();
    }
    handler.next(err);
  }
}
