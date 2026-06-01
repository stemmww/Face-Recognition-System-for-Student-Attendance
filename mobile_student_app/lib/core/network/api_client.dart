import 'package:dio/dio.dart';
import '../config/app_config.dart';
import 'auth_interceptor.dart';

class ApiClient {
  ApiClient._();

  static final Dio _dio = _createDio();

  static Dio get dio => _dio;

  static Dio _createDio() {
    final dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: AppConfig.connectTimeout,
        receiveTimeout: AppConfig.receiveTimeout,
        headers: {'Content-Type': 'application/json'},
      ),
    );
    dio.interceptors.add(AuthInterceptor(dio));
    return dio;
  }

  // Convenience helpers
  static Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) =>
      _dio.get<T>(path, queryParameters: queryParameters, options: options);

  static Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Options? options,
  }) =>
      _dio.post<T>(path, data: data, options: options);

  static Future<Response<T>> patch<T>(
    String path, {
    dynamic data,
    Options? options,
  }) =>
      _dio.patch<T>(path, data: data, options: options);

  static Future<Response<T>> delete<T>(
    String path, {
    Options? options,
  }) =>
      _dio.delete<T>(path, options: options);
}
