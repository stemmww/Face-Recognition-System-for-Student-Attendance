import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

class AppLogo extends StatelessWidget {
  final double size;
  final bool inverted;

  const AppLogo({
    super.key,
    this.size = 40,
    this.inverted = false,
  });

  @override
  Widget build(BuildContext context) {
    final background = inverted ? Colors.white : AppTheme.primary;
    final foreground = inverted ? AppTheme.primary : Colors.white;

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(size * 0.25),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(inverted ? 0.14 : 0.10),
            blurRadius: size * 0.18,
            offset: Offset(0, size * 0.06),
          ),
        ],
      ),
      child: Icon(
        Icons.center_focus_strong_rounded,
        size: size * 0.52,
        color: foreground,
      ),
    );
  }
}
