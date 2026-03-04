from datetime import datetime, time

from app.models.attendance import AttendanceStatus


def compute_attendance_status(recognized_at: datetime, class_start: time) -> AttendanceStatus:
    """Determine attendance status based on arrival time relative to class start.

    Rules:
        - Arrived within 5 minutes of start → PRESENT
        - Arrived 5–15 minutes after start  → LATE
        - Arrived more than 15 minutes late  → ABSENT
    """
    arrival = recognized_at.time()
    start_seconds = class_start.hour * 3600 + class_start.minute * 60 + class_start.second
    arrival_seconds = arrival.hour * 3600 + arrival.minute * 60 + arrival.second
    minutes_late = (arrival_seconds - start_seconds) / 60

    if minutes_late <= 5:
        return AttendanceStatus.PRESENT
    elif minutes_late <= 15:
        return AttendanceStatus.LATE
    else:
        return AttendanceStatus.ABSENT
