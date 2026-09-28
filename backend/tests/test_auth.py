import unittest

from app.auth import create_session_token, hash_password, read_session_token, verify_password


class AdminAuthTests(unittest.TestCase):
    def test_password_hash_verifies_without_storing_plaintext(self):
        password = "test-only-password"
        password_hash = hash_password(password, iterations=100_000)
        self.assertNotEqual(password_hash, password)
        self.assertTrue(verify_password(password, password_hash))
        self.assertFalse(verify_password("incorrect-password", password_hash))

    def test_session_token_checks_signature_secret_and_expiry(self):
        token = create_session_token("admin", "test-secret-key-with-more-than-32-characters", 60, now=1_000)
        self.assertEqual(read_session_token(token, "test-secret-key-with-more-than-32-characters", now=1_030), "admin")
        self.assertIsNone(read_session_token(token, "another-test-secret-key-with-more-than-32-chars", now=1_030))
        self.assertIsNone(read_session_token(token, "test-secret-key-with-more-than-32-characters", now=1_060))


if __name__ == "__main__":
    unittest.main()