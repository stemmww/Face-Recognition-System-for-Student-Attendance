import 'dart:io';

import 'package:dio/dio.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../../shared/providers/auth_provider.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/token_storage.dart';
import '../../../core/theme/app_theme.dart';

class FaceEnrollmentScreen extends ConsumerStatefulWidget {
  const FaceEnrollmentScreen({super.key});

  @override
  ConsumerState<FaceEnrollmentScreen> createState() =>
      _FaceEnrollmentScreenState();
}

class _FaceEnrollmentScreenState
    extends ConsumerState<FaceEnrollmentScreen> {
  final _picker = ImagePicker();
  File? _selectedImage;
  bool _consent = false;
  bool _uploading = false;
  String? _resultStatus;
  String? _resultMessage;
  int _embeddingCount = 0;
  bool _hasEmbedding = false;
  bool? _canSelfEnrollFace;

  @override
  void initState() {
    super.initState();
    _loadStatus();
  }

  Future<void> _loadStatus() async {
    try {
      final resp = await ApiClient.get('/api/face-enrollment/me');
      final data = resp.data as Map<String, dynamic>;
      setState(() {
        _canSelfEnrollFace = data['can_self_enroll_face'] as bool? ?? false;
        _hasEmbedding = data['has_face_embedding'] as bool? ?? false;
        _embeddingCount = data['embedding_count'] as int? ?? 0;
      });
    } catch (_) {}
  }

  Future<void> _pickImage(ImageSource source) async {
    final picked = await _picker.pickImage(
      source: source,
      imageQuality: 90,
      maxWidth: 1280,
      maxHeight: 1280,
    );
    if (picked != null) {
      setState(() {
        _selectedImage = File(picked.path);
        _resultStatus = null;
        _resultMessage = null;
      });
    }
  }

  Future<void> _upload() async {
    if (_selectedImage == null || !_consent) return;
    setState(() {
      _uploading = true;
      _resultStatus = null;
      _resultMessage = null;
    });

    try {
      final token = await TokenStorage.getAccessToken();
      final formData = FormData.fromMap({
        'photo': await MultipartFile.fromFile(
          _selectedImage!.path,
          filename: 'face.jpg',
        ),
      });

      final resp = await ApiClient.dio.post(
        '/api/face-enrollment/me',
        data: formData,
        options: Options(
          headers: {'Authorization': 'Bearer $token'},
          // Do NOT set contentType here — Dio sets it automatically
          // with the correct multipart boundary when data is FormData
        ),
      );

      final data = resp.data as Map<String, dynamic>;
      final success = data['success'] as bool? ?? false;
      final status = data['status'] as String? ?? '';
      final reason = data['reason'] as String?;

      setState(() {
        _uploading = false;
        _resultStatus = success ? 'success' : 'failed';
        _resultMessage = _mapMessage(status, reason);
        if (success) {
          _hasEmbedding = data['has_face_embedding'] as bool? ?? true;
          _embeddingCount = data['embedding_count'] as int? ?? _embeddingCount + 1;
          _selectedImage = null;
        }
      });

      if (success) {
        await ref.read(authProvider.notifier).refreshUser();
      }
    } catch (e) {
      setState(() {
        _uploading = false;
        _resultStatus = 'failed';
        _resultMessage = tr('error.upload_failed');
      });
    }
  }

  String _mapMessage(String status, String? reason) {
    if (status == 'APPROVED') return tr('face_enrollment.success');
    switch (reason) {
      case 'NO_FACE_DETECTED':
        return tr('face_enrollment.no_face');
      case 'MULTIPLE_FACES':
      case 'MULTIPLE_FACES_DETECTED':
        return tr('face_enrollment.multiple_faces');
      case 'FACE_TOO_BLURRY':
        return tr('face_enrollment.too_blurry');
      case 'LIVENESS_FAILED':
        return tr('face_enrollment.liveness_failed');
      case 'MAX_PHOTOS_REACHED':
        return tr('face_enrollment.max_reached');
      default:
        return reason ?? tr('face_enrollment.failed');
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final canEnroll = _canSelfEnrollFace ?? user?.canSelfEnrollFace ?? false;
    if (user == null || !canEnroll) {
      return Scaffold(
        appBar: AppBar(title: Text(tr('nav.face_enrollment'))),
        body: Center(
          child: Text(tr('face_enrollment.no_permission')),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(tr('nav.face_enrollment'))),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Status banner
            _StatusBanner(
              hasEmbedding: _hasEmbedding,
              embeddingCount: _embeddingCount,
            ),
            const SizedBox(height: 20),
            // Preview
            AspectRatio(
              aspectRatio: 1,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: _selectedImage != null
                    ? Image.file(_selectedImage!, fit: BoxFit.cover)
                    : Container(
                        color: Colors.grey.shade100,
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.add_photo_alternate_outlined,
                                size: 64, color: Colors.grey),
                            const SizedBox(height: 8),
                            Text(
                              tr('face_enrollment.select_photo'),
                              style: const TextStyle(color: Colors.grey),
                            ),
                          ],
                        ),
                      ),
              ),
            ),
            const SizedBox(height: 16),
            // Pick buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.photo_library_outlined),
                    label: Text(tr('face_enrollment.upload_photo')),
                    onPressed: () => _pickImage(ImageSource.gallery),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.camera_alt_outlined),
                    label: Text(tr('face_enrollment.take_photo')),
                    onPressed: () => _pickImage(ImageSource.camera),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            // Consent
            CheckboxListTile(
              value: _consent,
              onChanged: (v) => setState(() => _consent = v ?? false),
              title: Text(
                tr('face_enrollment.consent'),
                style: const TextStyle(fontSize: 13),
              ),
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
            ),
            const SizedBox(height: 12),
            // Result
            if (_resultStatus != null)
              _ResultCard(
                  success: _resultStatus == 'success',
                  message: _resultMessage ?? ''),
            const SizedBox(height: 12),
            // Submit
            ElevatedButton.icon(
              icon: _uploading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2),
                    )
                  : const Icon(Icons.upload),
              label: Text(tr('face_enrollment.submit')),
              onPressed:
                  (_uploading || _selectedImage == null || !_consent)
                      ? null
                      : _upload,
            ),
            const SizedBox(height: 8),
            Text(
              tr('face_enrollment.hints'),
              style: const TextStyle(color: Colors.grey, fontSize: 12),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusBanner extends StatelessWidget {
  final bool hasEmbedding;
  final int embeddingCount;
  const _StatusBanner(
      {required this.hasEmbedding, required this.embeddingCount});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: hasEmbedding
            ? Colors.green.shade50
            : Colors.orange.shade50,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: hasEmbedding ? Colors.green.shade200 : Colors.orange.shade200,
        ),
      ),
      child: Row(
        children: [
          Icon(
            hasEmbedding ? Icons.verified_user : Icons.warning_amber,
            color: hasEmbedding ? Colors.green : Colors.orange,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  hasEmbedding
                      ? tr('face_enrollment.enrolled')
                      : tr('face_enrollment.not_enrolled'),
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: hasEmbedding ? Colors.green : Colors.orange,
                  ),
                ),
                if (embeddingCount > 0)
                  Text(
                    tr('face_enrollment.photo_count',
                        args: [embeddingCount.toString(), '5']),
                    style: const TextStyle(fontSize: 12, color: Colors.grey),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ResultCard extends StatelessWidget {
  final bool success;
  final String message;
  const _ResultCard({required this.success, required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: success ? Colors.green.shade50 : Colors.red.shade50,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
            color: success ? Colors.green.shade300 : Colors.red.shade300),
      ),
      child: Row(
        children: [
          Icon(
            success ? Icons.check_circle : Icons.error_outline,
            color: success ? Colors.green : Colors.red,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                color: success ? Colors.green.shade800 : Colors.red.shade800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
