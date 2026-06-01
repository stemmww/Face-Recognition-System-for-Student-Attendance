import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/presentation/splash_screen.dart';
import 'features/auth/presentation/login_screen.dart';
import 'features/dashboard/presentation/dashboard_screen.dart';
import 'features/profile/presentation/profile_screen.dart';
import 'features/subjects/presentation/subjects_screen.dart';
import 'features/schedule/presentation/schedule_screen.dart';
import 'features/attendance/presentation/attendance_screen.dart';
import 'features/attendance_history/presentation/attendance_history_screen.dart';
import 'features/face_enrollment/presentation/face_enrollment_screen.dart';
import 'features/notifications/presentation/notifications_screen.dart';
import 'features/appeals/presentation/appeals_screen.dart';
import 'shared/providers/auth_provider.dart';

final _router = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(
      path: '/',
      builder: (_, __) => const SplashScreen(),
    ),
    GoRoute(
      path: '/login',
      builder: (_, __) => const LoginScreen(),
    ),
    ShellRoute(
      builder: (_, __, child) => _AppShell(child: child),
      routes: [
        GoRoute(
          path: '/dashboard',
          builder: (_, __) => const DashboardScreen(),
        ),
        GoRoute(
          path: '/dashboard/schedule',
          builder: (_, __) => const ScheduleScreen(),
        ),
        GoRoute(
          path: '/dashboard/attendance',
          builder: (_, __) => const AttendanceScreen(),
        ),
        GoRoute(
          path: '/dashboard/attendance-history',
          builder: (_, __) => const AttendanceHistoryScreen(),
        ),
        GoRoute(
          path: '/dashboard/subjects',
          builder: (_, __) => const SubjectsScreen(),
        ),
        GoRoute(
          path: '/dashboard/profile',
          builder: (_, __) => const ProfileScreen(),
        ),
        GoRoute(
          path: '/dashboard/face-enrollment',
          builder: (_, __) => const FaceEnrollmentScreen(),
        ),
        GoRoute(
          path: '/dashboard/notifications',
          builder: (_, __) => const NotificationsScreen(),
        ),
        GoRoute(
          path: '/dashboard/appeals',
          builder: (_, __) => const AppealsScreen(),
        ),
      ],
    ),
  ],
);

class StudentApp extends ConsumerWidget {
  const StudentApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'Student Attendance',
      theme: AppTheme.light,
      routerConfig: _router,
      localizationsDelegates: context.localizationDelegates,
      supportedLocales: context.supportedLocales,
      locale: context.locale,
      debugShowCheckedModeBanner: false,
    );
  }
}

// Bottom navigation shell — shown on all /dashboard/* routes
class _AppShell extends ConsumerStatefulWidget {
  final Widget child;
  const _AppShell({required this.child});

  @override
  ConsumerState<_AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<_AppShell> {
  int _index = 0;

  static const _routes = [
    '/dashboard',
    '/dashboard/schedule',
    '/dashboard/attendance',
    '/dashboard/subjects',
    '/dashboard/profile',
  ];

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    try {
      final loc = GoRouterState.of(context).uri.toString();
      for (var i = 0; i < _routes.length; i++) {
        if (loc == _routes[i] || loc.startsWith('${_routes[i]}/')) {
          if (_index != i) setState(() => _index = i);
          break;
        }
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: widget.child,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _index,
        onTap: (i) {
          setState(() => _index = i);
          context.go(_routes[i]);
        },
        items: [
          BottomNavigationBarItem(
            icon: const Icon(Icons.home_outlined),
            activeIcon: const Icon(Icons.home),
            label: tr('nav.dashboard'),
          ),
          BottomNavigationBarItem(
            icon: const Icon(Icons.calendar_today_outlined),
            activeIcon: const Icon(Icons.calendar_today),
            label: tr('nav.schedule'),
          ),
          BottomNavigationBarItem(
            icon: const Icon(Icons.check_circle_outline),
            activeIcon: const Icon(Icons.check_circle),
            label: tr('nav.attendance'),
          ),
          BottomNavigationBarItem(
            icon: const Icon(Icons.book_outlined),
            activeIcon: const Icon(Icons.book),
            label: tr('nav.subjects'),
          ),
          BottomNavigationBarItem(
            icon: const Icon(Icons.person_outline),
            activeIcon: const Icon(Icons.person),
            label: tr('nav.profile'),
          ),
        ],
      ),
    );
  }
}
