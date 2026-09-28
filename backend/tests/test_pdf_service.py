import unittest
from datetime import datetime

from app.services.pdf_service import _format_submission_timestamp


class PdfTimestampTests(unittest.TestCase):
    def test_naive_stored_utc_timestamp_formats_as_admin_ist_time(self):
        stored_utc = datetime(2026, 9, 28, 17, 12)

        self.assertEqual(
            _format_submission_timestamp(stored_utc),
            "Sep 28, 2026, 10:42 PM",
        )


if __name__ == "__main__":
    unittest.main()