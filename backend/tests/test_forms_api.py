import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.session import Base
from app.models.forms import FormSubmission
from app.routers.forms import (
    create_form,
    deactivate_form,
    delete_form,
    download_admin_submission_pdf,
    download_public_submission_pdf,
    get_form,
    get_form_submission,
    get_published_form,
    list_form_submissions,
    list_forms,
    publish_form,
    submit_public_form,
    update_form,
)
from app.schemas.forms import FormCreate, FormUpdate, PublicSubmissionCreate


class FormApiWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.session_factory = sessionmaker(bind=self.engine)
        self.db = self.session_factory()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_public_submission_remains_readable_after_form_edit(self):
        form_config = {
            "fields": [
                {
                    "id": "field_1",
                    "name": "email",
                    "label": "Original email",
                    "type": "email",
                    "required": True,
                    "order": 1,
                    "active": True,
                }
            ]
        }
        form = create_form(FormCreate(form_name="API smoke", form_config=form_config), self.db, "test-admin")
        form_id = form.form_id
        slug = form.form_slug
        self.assertEqual(form.created_by, "test-admin")
        self.assertEqual(len(list_forms(self.db)), 1)
        self.assertEqual(get_form(form_id, self.db).form_id, form_id)
        self.assertEqual(publish_form(form_id, self.db)["status"], "PUBLISHED")
        self.assertEqual(get_published_form(slug, self.db).form_id, form_id)
        with self.assertRaises(HTTPException) as invalid:
            submit_public_form(
                slug,
                PublicSubmissionCreate(submission_data={"email": "invalid"}),
                self.db,
            )
        self.assertEqual(invalid.exception.status_code, 400)

        submitted = submit_public_form(
            slug,
            PublicSubmissionCreate(submission_data={"email": "person@example.com"}),
            self.db,
        )
        submission_id = submitted["submission_id"]

        form_config["fields"][0]["label"] = "Edited email"
        update_form(form_id, FormUpdate(form_config=form_config), self.db)

        detail = get_form_submission(form_id, submission_id, self.db)
        snapshot = detail.form_snapshot
        self.assertEqual(snapshot["form_config"]["fields"][0]["label"], "Original email")
        listing = list_form_submissions(form_id, self.db)
        self.assertIn("Original email", listing[0]["summary"])

        admin_pdf = download_admin_submission_pdf(form_id, submission_id, self.db)
        self.assertTrue(admin_pdf.body.startswith(b"%PDF"))
        self.assertIn(f"submission-{submission_id}.pdf", admin_pdf.headers["Content-Disposition"])
        submission_count = self.db.query(FormSubmission).filter_by(form_id=form_id).count()
        public_pdf = download_public_submission_pdf(slug, submission_id, self.db)
        self.assertTrue(public_pdf.body.startswith(b"%PDF"))
        self.assertIn(f"submission-{submission_id}.pdf", public_pdf.headers["Content-Disposition"])
        self.assertEqual(self.db.query(FormSubmission).filter_by(form_id=form_id).count(), submission_count)

        self.assertEqual(deactivate_form(form_id, self.db)["status"], "INACTIVE")
        with self.assertRaises(HTTPException) as unavailable:
            get_published_form(slug, self.db)
        self.assertEqual(unavailable.exception.status_code, 404)
        delete_form(form_id, self.db)


if __name__ == "__main__":
    unittest.main()