import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import Annotation, Label, TextDocument


DEMO_USERNAME = os.getenv('DEMO_USERNAME', 'demo')
DEMO_PASSWORD = os.getenv('DEMO_PASSWORD', 'demo')
DEMO_DOCUMENT_TITLE = 'Демо: путешествие по Петербургу'
DEMO_DOCUMENT_SLUG = 'demo-puteshestvie-po-peterburgu'
DEMO_DOCUMENT_ORIGINAL_FILENAME = ''
DEMO_DOCUMENT_CONTENT = (
    'Анна приехала в Санкт-Петербург ранним утром.\n\n'
    'На Дворцовой площади она почувствовала радость и удивление.\n\n'
    'Вечером Анна записала впечатления и подготовила текст к анализу.'
)
DEMO_LABELS = (
    ('персонаж', '#f59e0b'),
    ('место', '#2563eb'),
    ('эмоция', '#db2777'),
)
DEMO_ANNOTATIONS = (
    ('Анна', 'персонаж'),
    ('Санкт-Петербург', 'место'),
    ('Дворцовой площади', 'место'),
    ('радость', 'эмоция'),
    ('удивление', 'эмоция'),
)


class Command(BaseCommand):
    help = 'Create or restore optional local sample account data.'

    @transaction.atomic
    def handle(self, *args, **options):
        user_model = get_user_model()
        demo_user, _ = user_model.objects.get_or_create(
            username=DEMO_USERNAME
        )
        demo_user.is_active = True
        demo_user.set_password(DEMO_PASSWORD)
        demo_user.save(update_fields=['is_active', 'password'])

        demo_user.documents.all().delete()
        document = TextDocument.objects.create(
            user=demo_user,
            title=DEMO_DOCUMENT_TITLE,
            original_filename=DEMO_DOCUMENT_ORIGINAL_FILENAME,
            content=DEMO_DOCUMENT_CONTENT,
        )

        labels = {}
        for name, color in DEMO_LABELS:
            label, _ = Label.objects.get_or_create(
                user=demo_user,
                name=name,
                defaults={'color': color},
            )
            if label.color != color:
                label.color = color
                label.save(update_fields=['color'])
            labels[name] = label

        for fragment, label_name in DEMO_ANNOTATIONS:
            start = DEMO_DOCUMENT_CONTENT.index(fragment)
            end = start + len(fragment)
            Annotation.objects.create(
                document=document,
                label=labels[label_name],
                start=start,
                end=end,
                text=fragment,
            )

        self.stdout.write(self.style.SUCCESS(
            f'Demo data restored for user "{DEMO_USERNAME}".'
        ))
