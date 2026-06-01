import 'dart:async';
import 'dart:io';

import 'package:camera/camera.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

class LivenessCaptureResult {
  final List<File> frames;
  LivenessCaptureResult(this.frames);
}

/// Captures [frameCount] frames automatically with a countdown.
/// Shows the liveness challenge instruction to the user.
class LivenessCaptureScreen extends StatefulWidget {
  final String instruction;
  final int frameCount;
  final int countdownSeconds;

  const LivenessCaptureScreen({
    super.key,
    required this.instruction,
    this.frameCount = 12,
    this.countdownSeconds = 5,
  });

  @override
  State<LivenessCaptureScreen> createState() => _LivenessCaptureScreenState();
}

class _LivenessCaptureScreenState extends State<LivenessCaptureScreen> {
  CameraController? _ctrl;
  List<CameraDescription> _cameras = [];
  bool _ready = false;
  bool _capturing = false;
  bool _done = false;
  int _countdown = 0;
  int _capturedCount = 0;
  String? _error;
  final List<File> _frames = [];

  @override
  void initState() {
    super.initState();
    _initCamera();
  }

  Future<void> _initCamera() async {
    try {
      _cameras = await availableCameras();
      // Prefer front camera
      final cam = _cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => _cameras.first,
      );
      _ctrl = CameraController(cam, ResolutionPreset.medium,
          enableAudio: false);
      await _ctrl!.initialize();
      if (mounted) setState(() => _ready = true);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  @override
  void dispose() {
    _ctrl?.dispose();
    super.dispose();
  }

  Future<void> _startCapture() async {
    if (_capturing || _ctrl == null || !_ctrl!.value.isInitialized) return;
    setState(() {
      _capturing = true;
      _countdown = widget.countdownSeconds;
      _frames.clear();
      _capturedCount = 0;
    });

    // Countdown
    for (int i = widget.countdownSeconds; i > 0; i--) {
      if (!mounted) return;
      setState(() => _countdown = i);
      await Future.delayed(const Duration(milliseconds: 900));
    }

    // Capture frames evenly spread over 3 seconds
    final intervalMs = (3000 / widget.frameCount).round();
    for (int i = 0; i < widget.frameCount; i++) {
      if (!mounted) return;
      try {
        final xFile = await _ctrl!.takePicture();
        _frames.add(File(xFile.path));
        setState(() => _capturedCount = _frames.length);
      } catch (_) {}
      await Future.delayed(Duration(milliseconds: intervalMs));
    }

    setState(() {
      _capturing = false;
      _done = true;
    });

    // Return frames after short delay so user sees "done" state
    await Future.delayed(const Duration(milliseconds: 400));
    if (mounted) {
      Navigator.of(context)
          .pop(LivenessCaptureResult(_frames));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(tr('attendance.verify_attendance')),
      ),
      body: _error != null
          ? Center(
              child: Text(_error!,
                  style: const TextStyle(color: Colors.white)))
          : !_ready
              ? const Center(
                  child: CircularProgressIndicator(color: Colors.white))
              : Stack(
                  children: [
                    // Camera preview (circular)
                    Center(
                      child: ClipOval(
                        child: SizedBox(
                          width: 280,
                          height: 280,
                          child: CameraPreview(_ctrl!),
                        ),
                      ),
                    ),
                    // Oval guide border
                    Center(
                      child: Container(
                        width: 290,
                        height: 290,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: _done
                                ? Colors.green
                                : _capturing
                                    ? AppTheme.primary
                                    : Colors.white54,
                            width: 4,
                          ),
                        ),
                      ),
                    ),
                    // Challenge instruction
                    Positioned(
                      top: 60,
                      left: 24,
                      right: 24,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 12),
                        decoration: BoxDecoration(
                          color: Colors.black54,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          widget.instruction,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                    // Status / countdown
                    Positioned(
                      bottom: 120,
                      left: 0,
                      right: 0,
                      child: Center(
                        child: _done
                            ? const Icon(Icons.check_circle,
                                color: Colors.green, size: 48)
                            : _capturing
                                ? Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      if (_countdown > 0)
                                        Text(
                                          '$_countdown',
                                          style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 56,
                                              fontWeight: FontWeight.bold),
                                        )
                                      else
                                        Text(
                                          '$_capturedCount / ${widget.frameCount}',
                                          style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 22),
                                        ),
                                    ],
                                  )
                                : const SizedBox.shrink(),
                      ),
                    ),
                    // Start button
                    if (!_capturing && !_done)
                      Positioned(
                        bottom: 48,
                        left: 32,
                        right: 32,
                        child: ElevatedButton.icon(
                          icon: const Icon(Icons.videocam),
                          label:
                              Text(tr('attendance.start_capture')),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.primary,
                            foregroundColor: Colors.white,
                            minimumSize: const Size(double.infinity, 52),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          onPressed: _startCapture,
                        ),
                      ),
                    // Progress bar during capture
                    if (_capturing && _countdown == 0)
                      Positioned(
                        bottom: 48,
                        left: 32,
                        right: 32,
                        child: LinearProgressIndicator(
                          value: _capturedCount / widget.frameCount,
                          backgroundColor: Colors.white24,
                          valueColor: const AlwaysStoppedAnimation(
                              AppTheme.primary),
                          minHeight: 6,
                        ),
                      ),
                  ],
                ),
    );
  }
}
