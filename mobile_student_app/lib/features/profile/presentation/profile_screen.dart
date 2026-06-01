import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../shared/providers/auth_provider.dart';
import '../../../core/config/app_config.dart';
import '../../../core/theme/app_theme.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    if (user == null) return const SizedBox.shrink();

    final photoUrl = user.photoUrl != null
        ? '${AppConfig.apiBaseUrl}${user.photoUrl}'
        : null;

    return Scaffold(
      appBar: AppBar(title: Text(tr('nav.profile'))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Avatar
          Center(
            child: CircleAvatar(
              radius: 48,
              backgroundColor: AppTheme.primary.withOpacity(0.15),
              backgroundImage:
                  photoUrl != null ? NetworkImage(photoUrl) : null,
              child: photoUrl == null
                  ? const Icon(Icons.person, size: 48, color: AppTheme.primary)
                  : null,
            ),
          ),
          const SizedBox(height: 12),
          Center(
            child: Text(
              user.fullName,
              style: const TextStyle(
                  fontSize: 20, fontWeight: FontWeight.bold),
            ),
          ),
          Center(
            child: Text(
              user.email,
              style: const TextStyle(color: Colors.grey),
            ),
          ),
          const SizedBox(height: 24),
          _InfoCard(children: [
            _InfoRow(
              icon: Icons.badge_outlined,
              label: tr('profile.role'),
              value: user.role.toUpperCase(),
            ),
            _InfoRow(
              icon: Icons.email_outlined,
              label: tr('auth.email'),
              value: user.email,
            ),
          ]),
          const SizedBox(height: 12),
          // Face enrollment status
          _InfoCard(children: [
            _InfoRow(
              icon: Icons.face_outlined,
              label: tr('face_enrollment.status'),
              value: user.faceEnrollmentStatus?.toUpperCase() ??
                  tr('face_enrollment.none'),
            ),
            _InfoRow(
              icon: Icons.fingerprint,
              label: tr('face_enrollment.has_embedding'),
              value: user.hasFaceEmbedding ? tr('yes') : tr('no'),
            ),
          ]),
          if (user.canSelfEnrollFace) ...[
            const SizedBox(height: 12),
            ElevatedButton.icon(
              icon: const Icon(Icons.face_retouching_natural),
              label: Text(tr('nav.face_enrollment')),
              onPressed: () => context.go('/dashboard/face-enrollment'),
            ),
          ],
          const SizedBox(height: 24),
          // Language picker
          _InfoCard(children: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(
                children: [
                  const Icon(Icons.language, color: Colors.grey),
                  const SizedBox(width: 12),
                  Text(tr('profile.language'),
                      style: const TextStyle(fontWeight: FontWeight.w500)),
                  const Spacer(),
                  _LangChip(
                    label: 'EN',
                    locale: const Locale('en'),
                    current: context.locale,
                    onTap: () => context.setLocale(const Locale('en')),
                  ),
                  const SizedBox(width: 6),
                  _LangChip(
                    label: 'RU',
                    locale: const Locale('ru'),
                    current: context.locale,
                    onTap: () => context.setLocale(const Locale('ru')),
                  ),
                  const SizedBox(width: 6),
                  _LangChip(
                    label: 'KK',
                    locale: const Locale('kk'),
                    current: context.locale,
                    onTap: () => context.setLocale(const Locale('kk')),
                  ),
                ],
              ),
            ),
          ]),
          const SizedBox(height: 32),
          OutlinedButton.icon(
            icon: const Icon(Icons.logout, color: Colors.red),
            label: Text(tr('auth.logout'),
                style: const TextStyle(color: Colors.red)),
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: Colors.red),
              minimumSize: const Size(double.infinity, 48),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () async {
              await ref.read(authProvider.notifier).logout();
              if (context.mounted) context.go('/login');
            },
          ),
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final List<Widget> children;
  const _InfoCard({required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 6,
            offset: const Offset(0, 2),
          )
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Column(children: children),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _InfoRow(
      {required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(icon, color: Colors.grey, size: 20),
          const SizedBox(width: 12),
          Text(label,
              style: const TextStyle(
                  color: Colors.grey, fontWeight: FontWeight.w500)),
          const Spacer(),
          Text(value,
              style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _LangChip extends StatelessWidget {
  final String label;
  final Locale locale;
  final Locale current;
  final VoidCallback onTap;

  const _LangChip({
    required this.label,
    required this.locale,
    required this.current,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final selected = current.languageCode == locale.languageCode;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: selected ? AppTheme.primary : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
              color: selected ? AppTheme.primary : Colors.grey.shade300),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? Colors.white : Colors.black87,
            fontWeight: FontWeight.w600,
            fontSize: 12,
          ),
        ),
      ),
    );
  }
}
