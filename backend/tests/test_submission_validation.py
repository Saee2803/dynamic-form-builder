import unittest
from types import SimpleNamespace

from app.services.submissions import (
    SubmissionValidationError,
    resolve_submission_form_snapshot,
    validate_submission_data,
)


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

    def test_submission_snapshot_preserves_historical_form_configuration(self):
        historical_snapshot = {
            "form_name": "Original title",
            "form_description": "Original description",
            "form_config": {"fields": [{"name": "full_name", "label": "Full name"}]},
        }
        current_form = SimpleNamespace(
            form_name="Edited title",
            form_description="Edited description",
            form_config={"fields": [{"name": "full_name", "label": "Name"}]},
        )
        submission = SimpleNamespace(form_snapshot=historical_snapshot)

        self.assertEqual(resolve_submission_form_snapshot(current_form, submission), historical_snapshot)

    def test_legacy_submission_without_snapshot_uses_current_form(self):
        current_config = {"fields": [{"name": "full_name", "label": "Name"}]}
        current_form = SimpleNamespace(
            form_name="Current title",
            form_description=None,
            form_config=current_config,
        )
        submission = SimpleNamespace(form_snapshot=None)

        self.assertEqual(
            resolve_submission_form_snapshot(current_form, submission),
            {"form_name": "Current title", "form_description": None, "form_config": current_config},
        )

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