import unittest

from app.services.submissions import SubmissionValidationError, validate_submission_data


class SubmissionValidationTests(unittest.TestCase):
    def setUp(self):
        self.config = {
            "fields": [
                {"name": "name", "type": "text", "required": True, "validation": {"minLength": 2, "maxLength": 5}},
                {"name": "email", "type": "email"},
                {"name": "age", "type": "number", "validation": {"min": 18, "max": 80}},
                {"name": "country", "type": "select", "options": ["India", "USA"]},
                {"name": "skills", "type": "multiselect", "options": [{"label": "Python", "value": "py"}, {"label": "React", "value": "react"}]},
                {"name": "consent", "type": "checkbox", "required": True},
                {"name": "inactive", "type": "text", "active": False, "required": True},
                {"name": "section", "type": "heading", "required": True},
                {"name": "attachment", "type": "file", "required": True},
            ]
        }

    def test_accepts_configured_values_and_ignores_unsupported_file_field(self):
        result = validate_submission_data(self.config, {
            "name": "Saee",
            "email": "saee@example.com",
            "age": "28",
            "country": "India",
            "skills": ["py", "react"],
            "consent": True,
            "attachment": "",
        })
        self.assertEqual(result["age"], 28)
        self.assertEqual(result["skills"], ["py", "react"])
        self.assertNotIn("attachment", result)
        self.assertNotIn("inactive", result)

    def test_rejects_missing_required_and_whitespace_only_values(self):
        with self.assertRaisesRegex(SubmissionValidationError, "name is required"):
            validate_submission_data(self.config, {"name": "   ", "consent": True})

    def test_rejects_unknown_fields_and_invalid_options(self):
        with self.assertRaisesRegex(SubmissionValidationError, "Unknown field: admin"):
            validate_submission_data(self.config, {"admin": True})
        with self.assertRaisesRegex(SubmissionValidationError, "Invalid option for country"):
            validate_submission_data(self.config, {"name": "Saee", "consent": True, "country": "Germany"})

    def test_rejects_invalid_type_constraints(self):
        cases = [
            ({"name": "S", "consent": True}, "Minimum length"),
            ({"name": "Longname", "consent": True}, "Maximum length"),
            ({"name": "Saee", "consent": True, "email": "not-an-email"}, "Invalid email"),
            ({"name": "Saee", "consent": True, "age": "17"}, "at least 18"),
            ({"name": "Saee", "consent": True, "skills": ["invalid"]}, "Invalid option for skills"),
            ({"name": "Saee", "consent": False}, "consent is required"),
        ]
        for values, message in cases:
            with self.subTest(message=message), self.assertRaisesRegex(SubmissionValidationError, message):
                validate_submission_data(self.config, values)


if __name__ == "__main__":
    unittest.main()