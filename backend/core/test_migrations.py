from django.db import connection
from django.db.models import F
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class LabelOwnershipMigrationTests(TransactionTestCase):
    migrate_from = [
        ('core', '0002_initial'),
        ('users', '0002_remove_myuser_bio'),
    ]
    migrate_to = [
        ('core', '0003_label_user'),
        ('users', '0002_remove_myuser_bio'),
    ]

    def setUp(self):
        super().setUp()
        self.executor = MigrationExecutor(connection)
        self.executor.migrate(self.migrate_from)
        old_apps = self.executor.loader.project_state(
            self.migrate_from
        ).apps

        User = old_apps.get_model('users', 'MyUser')
        TextDocument = old_apps.get_model('core', 'TextDocument')
        Label = old_apps.get_model('core', 'Label')
        Annotation = old_apps.get_model('core', 'Annotation')

        first_user = User.objects.create(username='first-user')
        second_user = User.objects.create(username='second-user')
        first_document = TextDocument.objects.create(
            user=first_user,
            title='First',
            content='First document',
        )
        second_document = TextDocument.objects.create(
            user=second_user,
            title='Second',
            content='Second document',
        )
        shared_label = Label.objects.create(name='shared', color='#111111')
        duplicate_label = Label.objects.create(
            name='shared',
            color='#222222',
        )
        Label.objects.create(name='unused', color='#333333')

        Annotation.objects.create(
            document=first_document,
            label=shared_label,
            start=0,
            end=5,
            text='First',
        )
        Annotation.objects.create(
            document=second_document,
            label=shared_label,
            start=0,
            end=6,
            text='Second',
        )
        Annotation.objects.create(
            document=first_document,
            label=duplicate_label,
            start=6,
            end=14,
            text='document',
        )

        self.first_user_id = first_user.id
        self.second_user_id = second_user.id

    def tearDown(self):
        self.executor = MigrationExecutor(connection)
        self.executor.migrate(self.executor.loader.graph.leaf_nodes())
        super().tearDown()

    def test_shared_labels_are_split_and_duplicates_are_merged(self):
        self.executor = MigrationExecutor(connection)
        self.executor.migrate(self.migrate_to)
        apps = self.executor.loader.project_state(self.migrate_to).apps

        Label = apps.get_model('core', 'Label')
        Annotation = apps.get_model('core', 'Annotation')

        shared_labels = Label.objects.filter(name='shared')
        self.assertEqual(shared_labels.count(), 2)
        self.assertEqual(
            set(shared_labels.values_list('user_id', flat=True)),
            {self.first_user_id, self.second_user_id},
        )
        self.assertEqual(
            Label.objects.get(name='unused').user_id,
            self.first_user_id,
        )
        self.assertFalse(
            Annotation.objects.exclude(
                label__user_id=F('document__user_id')
            ).exists()
        )


class DocumentMetadataMigrationTests(TransactionTestCase):
    migrate_from = [
        ('core', '0003_label_user'),
        ('users', '0002_remove_myuser_bio'),
    ]
    migrate_to = [
        ('core', '0004_textdocument_slug_original_filename'),
        ('users', '0002_remove_myuser_bio'),
    ]

    def setUp(self):
        super().setUp()
        self.executor = MigrationExecutor(connection)
        self.executor.migrate(self.migrate_from)
        old_apps = self.executor.loader.project_state(
            self.migrate_from
        ).apps

        User = old_apps.get_model('users', 'MyUser')
        TextDocument = old_apps.get_model('core', 'TextDocument')

        first_user = User.objects.create(username='document-user')
        second_user = User.objects.create(username='second-document-user')
        TextDocument.objects.create(
            user=first_user,
            title='Тёзка',
            content='Первый',
        )
        TextDocument.objects.create(
            user=first_user,
            title='Тёзка',
            content='Второй',
        )
        blank_document = TextDocument.objects.create(
            user=first_user,
            title='',
            content='Без названия',
        )
        TextDocument.objects.create(
            user=second_user,
            title='Тёзка',
            content='Другой пользователь',
        )
        self.blank_document_id = blank_document.id

    def tearDown(self):
        self.executor = MigrationExecutor(connection)
        self.executor.migrate(self.executor.loader.graph.leaf_nodes())
        super().tearDown()

    def test_documents_receive_titles_and_unique_per_user_slugs(self):
        self.executor = MigrationExecutor(connection)
        self.executor.migrate(self.migrate_to)
        apps = self.executor.loader.project_state(self.migrate_to).apps

        TextDocument = apps.get_model('core', 'TextDocument')
        first_user_documents = TextDocument.objects.filter(
            user__username='document-user'
        )
        second_user_document = TextDocument.objects.get(
            user__username='second-document-user'
        )

        self.assertEqual(
            set(first_user_documents.values_list('slug', flat=True)),
            {'tezka', 'tezka-2', f'dokument-{self.blank_document_id}'}
        )
        self.assertEqual(second_user_document.slug, 'tezka')
        blank_document = TextDocument.objects.get(pk=self.blank_document_id)
        self.assertEqual(
            blank_document.title,
            f'Документ {self.blank_document_id}'
        )
        self.assertEqual(blank_document.original_filename, '')
