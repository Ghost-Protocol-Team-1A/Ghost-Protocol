def test_ci_catches_failures():
    """Temporary: proves CI turns red on a failing test. Removed in the next commit."""
    assert 2 + 2 == 5, "deliberately broken to turn CI red"
