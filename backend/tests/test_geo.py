"""Unit tests for app.utils.geo — haversine distance calculation."""

import pytest

from app.utils.geo import haversine_distance


class TestHaversineDistance:
    def test_same_point_is_zero(self):
        d = haversine_distance(51.5074, -0.1278, 51.5074, -0.1278)
        assert d == pytest.approx(0.0, abs=0.1)

    def test_known_distance_london_to_paris(self):
        # London (51.5074, -0.1278) to Paris (48.8566, 2.3522) ≈ 343 km
        d = haversine_distance(51.5074, -0.1278, 48.8566, 2.3522)
        assert d == pytest.approx(343_500, rel=0.01)  # within 1%

    def test_short_distance_campus_buildings(self):
        # Two points ~100m apart
        lat1, lon1 = 43.2381, 76.9456
        lat2, lon2 = 43.2390, 76.9456
        d = haversine_distance(lat1, lon1, lat2, lon2)
        assert 90 < d < 110  # ~100m

    def test_antipodal_points(self):
        # North pole to south pole ≈ 20,015 km
        d = haversine_distance(90, 0, -90, 0)
        assert d == pytest.approx(20_015_000, rel=0.01)

    def test_symmetry(self):
        d1 = haversine_distance(40.0, -74.0, 35.0, 139.0)
        d2 = haversine_distance(35.0, 139.0, 40.0, -74.0)
        assert d1 == pytest.approx(d2, abs=0.01)

    def test_equator_one_degree_longitude(self):
        # 1 degree of longitude at equator ≈ 111.32 km
        d = haversine_distance(0, 0, 0, 1)
        assert d == pytest.approx(111_320, rel=0.01)

    def test_within_gps_radius(self):
        """Simulate a student within 200m GPS radius."""
        session_lat, session_lon = 43.2381, 76.9456
        student_lat, student_lon = 43.2383, 76.9458  # ~25m away
        d = haversine_distance(session_lat, session_lon, student_lat, student_lon)
        assert d < 200  # within allowed radius
