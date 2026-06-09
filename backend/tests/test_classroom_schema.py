from app.schemas.classroom import parse_classroom_name


class TestClassroomSchema:
    def test_parse_classroom_name_without_room_type(self):
        parsed = parse_classroom_name("C1.1.368")

        assert parsed == {
            "block": "C1.1",
            "floor": 3,
            "room_number": "368",
            "room_type": None,
        }

    def test_parse_classroom_name_with_room_type(self):
        parsed = parse_classroom_name("c1.2.349k")

        assert parsed == {
            "block": "C1.2",
            "floor": 3,
            "room_number": "349",
            "room_type": "K",
        }

    def test_parse_classroom_name_rejects_unknown_room_type(self):
        assert parse_classroom_name("C1.1.349X") is None
