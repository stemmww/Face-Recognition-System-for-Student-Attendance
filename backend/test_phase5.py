"""End-to-end tests for Phase 5: Student Dashboard & Notifications."""
from datetime import date
import requests

BASE = "http://localhost:8000/api"


def login(email, password):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["access_token"]


def h(token):
    return {"Authorization": f"Bearer {token}"}


admin_token = login("admin@attendance.edu", "admin123")
prof_token = login("prof1@attendance.edu", "pass123")
stu_token = login("student1@attendance.edu", "pass123")
print("All logins OK")

# Get schedule
r = requests.get(f"{BASE}/courses", headers=h(admin_token))
course = [c for c in r.json() if c["code"] == "CS101"][0]
r = requests.get(f"{BASE}/schedules?course_id={course['id']}", headers=h(admin_token))
schedule = r.json()[0]
print(f"Course: {course['code']}, Schedule: {schedule['id']}")

# ---------- 1. Start a new session + stop to trigger auto-absent ----------
print("\n=== 1. Start + stop session (generate absent notifications) ===")
test_date = "2026-03-10"
r = requests.post(f"{BASE}/sessions", json={
    "schedule_id": schedule["id"],
    "date": test_date,
}, headers=h(prof_token))
assert r.status_code == 201, f"Start failed: {r.status_code} {r.text}"
session = r.json()
print(f"Session {session['id']} started for {test_date}")

r = requests.post(f"{BASE}/sessions/{session['id']}/stop", headers=h(prof_token))
assert r.status_code == 200
print("Session stopped — absent students should get notifications")

# ---------- 2. Check notifications for student ----------
print("\n=== 2. Student notifications ===")
r = requests.get(f"{BASE}/notifications", headers=h(stu_token))
assert r.status_code == 200
notifications = r.json()
print(f"Student has {len(notifications)} notification(s)")
has_absent_notification = any("absent" in n["message"].lower() for n in notifications)
print(f"Has absence notification: {has_absent_notification}")

# ---------- 3. Unread count ----------
print("\n=== 3. Unread count ===")
r = requests.get(f"{BASE}/notifications/unread-count", headers=h(stu_token))
assert r.status_code == 200
count = r.json()["count"]
print(f"Unread count: {count}")
assert count >= 1

# ---------- 4. Mark one as read ----------
print("\n=== 4. Mark notification as read ===")
if notifications:
    nid = notifications[0]["id"]
    r = requests.patch(f"{BASE}/notifications/{nid}/read", headers=h(stu_token))
    assert r.status_code == 200
    assert r.json()["is_read"] is True
    print(f"Marked notification {nid} as read")

# ---------- 5. Mark all as read ----------
print("\n=== 5. Mark all as read ===")
r = requests.post(f"{BASE}/notifications/read-all", headers=h(stu_token))
assert r.status_code == 204
r = requests.get(f"{BASE}/notifications/unread-count", headers=h(stu_token))
assert r.json()["count"] == 0
print("All notifications marked as read")

# ---------- 6. Student attendance summary ----------
print("\n=== 6. Student attendance summary ===")
r = requests.get(f"{BASE}/attendance/student/me/summary", headers=h(stu_token))
assert r.status_code == 200
summary = r.json()
print(f"Courses in summary: {len(summary)}")
for s in summary:
    print(f"  {s['course_code']}: {s['total_sessions']} sessions, "
          f"P={s['present_count']} L={s['late_count']} A={s['absent_count']} "
          f"rate={s['attendance_rate']}%")

# ---------- 7. Student attendance records ----------
print("\n=== 7. Student attendance records ===")
r = requests.get(f"{BASE}/attendance/student/me", headers=h(stu_token))
assert r.status_code == 200
records = r.json()
print(f"Student has {len(records)} attendance record(s)")

# ---------- 8. RBAC: professor can't see student summary ----------
print("\n=== 8. RBAC checks ===")
r = requests.get(f"{BASE}/attendance/student/me/summary", headers=h(prof_token))
assert r.status_code == 403
print("Professor can't access student summary: 403 OK")

r = requests.get(f"{BASE}/attendance/student/me", headers=h(prof_token))
assert r.status_code == 403
print("Professor can't access student records: 403 OK")

# ---------- 9. Notification ownership ===
print("\n=== 9. Notification ownership ===")
r = requests.get(f"{BASE}/notifications", headers=h(prof_token))
assert r.status_code == 200
prof_notifications = r.json()
print(f"Professor notifications: {len(prof_notifications)} (should be 0 or prof's own)")

print("\n" + "=" * 50)
print("ALL PHASE 5 TESTS PASSED!")
print("=" * 50)
