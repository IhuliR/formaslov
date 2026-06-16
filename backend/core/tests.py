from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TransactionTestCase

from core.management.commands.seed_demo_data import (
    DEMO_ANNOTATIONS,
    DEMO_DOCUMENT_CONTENT,
    DEMO_DOCUMENT_ORIGINAL_FILENAME,
    DEMO_DOCUMENT_SLUG,
    DEMO_DOCUMENT_TITLE,
    DEMO_LABELS,
    DEMO_PASSWORD,
    DEMO_USERNAME,
)
from core.models import Label, TextDocument


class SeedDemoDataTests(TransactionTestCase):

    def test_command_creates_and_restores_canonical_demo_data(self):
        call_command('seed_demo_data')

        user = get_user_model().objects.get(username=DEMO_USERNAME)
        document = TextDocument.objects.get(user=user)
        self.assertTrue(user.check_password(DEMO_PASSWORD))
        self.assertEqual(document.title, DEMO_DOCUMENT_TITLE)
        self.assertEqual(document.slug, DEMO_DOCUMENT_SLUG)
        self.assertEqual(
            document.original_filename,
            DEMO_DOCUMENT_ORIGINAL_FILENAME
        )
        self.assertEqual(document.content, DEMO_DOCUMENT_CONTENT)
        self.assertEqual(document.annotations.count(), len(DEMO_ANNOTATIONS))
        self.assertEqual(user.labels.count(), len(DEMO_LABELS))
        self.assertFalse(
            document.annotations.exclude(label__user=user).exists()
        )

        document.title = 'Повреждённый документ'
        document.save(update_fields=['title'])
        document.annotations.first().delete()
        TextDocument.objects.create(
            user=user,
            title='Лишний документ',
            content='Лишние данные',
        )

        call_command('seed_demo_data')

        documents = TextDocument.objects.filter(user=user)
        self.assertEqual(documents.count(), 1)
        restored_document = documents.get()
        self.assertEqual(restored_document.title, DEMO_DOCUMENT_TITLE)
        self.assertEqual(restored_document.slug, DEMO_DOCUMENT_SLUG)
        self.assertEqual(
            restored_document.original_filename,
            DEMO_DOCUMENT_ORIGINAL_FILENAME
        )
        self.assertEqual(restored_document.content, DEMO_DOCUMENT_CONTENT)
        self.assertEqual(
            restored_document.annotations.count(),
            len(DEMO_ANNOTATIONS)
        )
        for name, color in DEMO_LABELS:
            self.assertTrue(
                Label.objects.filter(
                    user=user,
                    name=name,
                    color=color
                ).exists()
            )
        self.assertEqual(user.labels.count(), len(DEMO_LABELS))
