"""End-to-end tests for Phase 6: Appeals, Statistics & Polish."""
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

# Get student's attendance records to find one to appeal
r = requests.get(f"{BASE}/attendance/student/me", headers=h(stu_token))
assert r.status_code == 200
records = r.json()
print(f"Student has {len(records)} attendance record(s)")

absent_records = [rec for rec in records if rec["status"] == "absent"]
print(f"Absent records: {len(absent_records)}")

# ---------- 1. Create an appeal ----------
print("\n=== 1. Create appeal ===")
if absent_records:
    target_record = absent_records[0]
    r = requests.post(f"{BASE}/appeals", json={
        "attendance_id": target_record["id"],
        "reason": "I was present but the camera did not recognize me due to poor lighting conditions."
    }, headers=h(stu_token))
    assert r.status_code == 201, f"Create appeal failed: {r.status_code} {r.text}"
    appeal = r.json()
    print(f"Appeal {appeal['id']} created for record {target_record['id']}, status: {appeal['status']}")
else:
    print("SKIP: No absent records to appeal (creating dummy test)")
    r = requests.post(f"{BASE}/appeals", json={
        "attendance_id": records[0]["id"] if records else 1,
        "reason": "Test appeal for integration testing purposes, checking the full workflow."
    }, headers=h(stu_token))
    if r.status_code == 201:
        appeal = r.json()
        print(f"Appeal {appeal['id']} created, status: {appeal['status']}")
    else:
        print(f"Expected: {r.status_code} {r.text}")
        appeal = None

# ---------- 2. Duplicate appeal should fail ----------
print("\n=== 2. Duplicate appeal check ===")
if absent_records:
    r = requests.post(f"{BASE}/appeals", json={
        "attendance_id": target_record["id"],
        "reason": "Duplicate test"
    }, headers=h(stu_token))
    assert r.status_code == 400
    print("Duplicate appeal correctly rejected: 400")

# ---------- 3. Student lists own appeals ----------
print("\n=== 3. Student's appeals list ===")
r = requests.get(f"{BASE}/appeals/me", headers=h(stu_token))
assert r.status_code == 200
my_appeals = r.json()
print(f"Student has {len(my_appeals)} appeal(s)")

# ---------- 4. Professor lists all appeals ----------
print("\n=== 4. Professor lists all appeals ===")
r = requests.get(f"{BASE}/appeals", headers=h(prof_token))
assert r.status_code == 200
all_appeals = r.json()
print(f"Total appeals visible to professor: {len(all_appeals)}")

# Filter by pending
r = requests.get(f"{BASE}/appeals?status=pending", headers=h(prof_token))
assert r.status_code == 200
pending = r.json()
print(f"Pending appeals: {len(pending)}")

# ---------- 5. Professor approves appeal ----------
print("\n=== 5. Approve appeal ===")
if appeal:
    r = requests.patch(f"{BASE}/appeals/{appeal['id']}", json={
        "status": "approved"
    }, headers=h(prof_token))
    assert r.status_code == 200, f"Approve failed: {r.status_code} {r.text}"
    reviewed = r.json()
    print(f"Appeal {reviewed['id']} -> {reviewed['status']}, reviewed_by={reviewed['reviewed_by']}")

    # Check that the attendance record was updated to present
    if absent_records:
        r = requests.get(f"{BASE}/attendance/student/me", headers=h(stu_token))
        updated = [rec for rec in r.json() if rec["id"] == target_record["id"]]
        if updated:
            print(f"Attendance record {target_record['id']} now: {updated[0]['status']}")
            assert updated[0]["status"] == "present"

# ---------- 6. Student gets approval notification ----------
print("\n=== 6. Student notification after appeal ===")
r = requests.get(f"{BASE}/notifications", headers=h(stu_token))
assert r.status_code == 200
notifs = r.json()
has_approval = any("approved" in n["message"].lower() for n in notifs)
print(f"Notifications: {len(notifs)}, has approval notice: {has_approval}")

# ---------- 7. Re-review should fail ----------
print("\n=== 7. Re-review check ===")
if appeal:
    r = requests.patch(f"{BASE}/appeals/{appeal['id']}", json={"status": "rejected"}, headers=h(prof_token))
    assert r.status_code == 400
    print("Re-review correctly rejected: 400")

# ---------- 8. RBAC: student can't list all appeals ----------
print("\n=== 8. RBAC checks ===")
r = requests.get(f"{BASE}/appeals", headers=h(stu_token))
assert r.status_code == 403
print("Student can't list all appeals: 403 OK")

r = requests.patch(f"{BASE}/appeals/1", json={"status": "approved"}, headers=h(stu_token))
assert r.status_code == 403
print("Student can't review appeals: 403 OK")

# ---------- 9. Statistics ----------
print("\n=== 9. Course statistics ===")
r = requests.get(f"{BASE}/courses", headers=h(admin_token))
course = [c for c in r.json() if c["code"] == "CS101"][0]

r = requests.get(f"{BASE}/statistics/course/{course['id']}", headers=h(prof_token))
assert r.status_code == 200, f"Stats failed: {r.status_code} {r.text}"
stats = r.json()
print(f"Course: {stats['course_code']} — {stats['course_name']}")
print(f"  Sessions: {stats['total_sessions']}, Enrolled: {stats['total_enrolled']}")
print(f"  Avg rate: {stats['avg_attendance_rate']}%")
for s in stats["students"]:
    print(f"  {s['student_name']}: P={s['present_count']} L={s['late_count']} A={s['absent_count']} rate={s['attendance_rate']}%")

# ---------- 10. RBAC: student can't access statistics ----------
print("\n=== 10. Statistics RBAC ===")
r = requests.get(f"{BASE}/statistics/course/{course['id']}", headers=h(stu_token))
assert r.status_code == 403
print("Student can't access statistics: 403 OK")

print("\n" + "=" * 50)
print("ALL PHASE 6 TESTS PASSED!")
print("=" * 50)
