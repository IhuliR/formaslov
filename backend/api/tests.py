from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from core.models import Annotation, Label, TextDocument


class TextDocumentApiTests(TestCase):

    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username='document-owner',
            password='test-password'
        )
        self.other_user = user_model.objects.create_user(
            username='other-document-owner',
            password='test-password'
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_create_document_with_content(self):
        response = self.client.post(
            '/api/v1/documents/',
            {'title': 'Тёзка', 'content': 'Первая\r\nВторая\rТретья'},
            format='multipart'
        )

        self.assertEqual(response.status_code, 201)
        document = TextDocument.objects.get(pk=response.data['id'])
        self.assertEqual(document.user, self.user)
        self.assertEqual(document.title, 'Тёзка')
        self.assertEqual(document.slug, 'tezka')
        self.assertEqual(response.data['slug'], 'tezka')
        self.assertEqual(document.content, 'Первая\nВторая\nТретья')

    def test_create_document_transliterates_cyrillic_title(self):
        response = self.client.post(
            '/api/v1/documents/',
            {'title': 'Явление 2', 'content': 'Текст'},
            format='multipart'
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['slug'], 'yavlenie-2')

    def test_duplicate_titles_get_unique_slugs_for_same_user(self):
        first_response = self.client.post(
            '/api/v1/documents/',
            {'title': 'Тёзка', 'content': 'Первый'},
            format='multipart'
        )
        second_response = self.client.post(
            '/api/v1/documents/',
            {'title': 'Тёзка', 'content': 'Второй'},
            format='multipart'
        )

        self.assertEqual(first_response.status_code, 201)
        self.assertEqual(second_response.status_code, 201)
        self.assertEqual(first_response.data['slug'], 'tezka')
        self.assertEqual(second_response.data['slug'], 'tezka-2')

    def test_different_users_can_have_same_document_slug(self):
        TextDocument.objects.create(
            user=self.other_user,
            title='Тёзка',
            content='Чужой текст'
        )

        response = self.client.post(
            '/api/v1/documents/',
            {'title': 'Тёзка', 'content': 'Свой текст'},
            format='multipart'
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['slug'], 'tezka')

    def test_empty_title_uses_original_filename(self):
        response = self.client.post(
            '/api/v1/documents/',
            {
                'title': '',
                'original_filename': 'Явление 2.txt',
                'content': 'Текст',
            },
            format='multipart'
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['title'], 'Явление 2')
        self.assertEqual(response.data['slug'], 'yavlenie-2')
        self.assertEqual(
            response.data['original_filename'],
            'Явление 2.txt'
        )

    def test_symbol_only_title_uses_fallback_slug(self):
        response = self.client.post(
            '/api/v1/documents/',
            {'title': '!!!', 'content': 'Текст'},
            format='multipart'
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['slug'], 'document')

    def test_title_update_regenerates_slug(self):
        document = TextDocument.objects.create(
            user=self.user,
            title='Старое название',
            content='Текст'
        )

        response = self.client.patch(
            f'/api/v1/documents/{document.id}/',
            {'title': 'Добро и зло'},
            format='multipart'
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['slug'], 'dobro-i-zlo')

    def test_list_contains_only_users_documents(self):
        own_document = TextDocument.objects.create(
            user=self.user,
            title='Own',
            content='Own content'
        )
        TextDocument.objects.create(
            user=self.other_user,
            title='Foreign',
            content='Foreign content'
        )

        response = self.client.get('/api/v1/documents/')

        self.assertEqual(response.status_code, 200)
        document_ids = {
            document['id'] for document in response.data
        }
        self.assertEqual(document_ids, {own_document.id})

    def test_upload_txt_creates_document_from_file_content(self):
        uploaded_file = SimpleUploadedFile(
            'example.txt',
            'Добра\r\nи\rзла'.encode('utf-8'),
            content_type='text/plain'
        )

        response = self.client.post(
            '/api/v1/documents/upload/',
            {'file': uploaded_file},
            format='multipart'
        )

        self.assertEqual(response.status_code, 201)
        document = TextDocument.objects.get(pk=response.data['id'])
        self.assertEqual(document.title, 'example')
        self.assertEqual(document.slug, 'example')
        self.assertEqual(document.original_filename, 'example.txt')
        self.assertEqual(document.content, 'Добра\nи\nзла')

    def test_chunks_use_offsets_from_stored_content_without_normalizing_it(
            self
    ):
        content = 'Первый\r\n\r\nВторой'
        document = TextDocument.objects.create(
            user=self.user,
            title='Legacy CRLF',
            content=content
        )

        response = self.client.get(
            f'/api/v1/documents/{document.id}/chunks/',
            {'page': 2, 'page_size': 1}
        )

        self.assertEqual(response.status_code, 200)
        chunk = response.data['chunk'][0]
        start = response.data['chunk_start']
        end = response.data['chunk_end']
        self.assertEqual(content[start:end], chunk)
        self.assertEqual(start, content.index('Второй'))


class RegistrationApiTests(TestCase):

    def test_registration_creates_user_through_djoser(self):
        response = self.client.post(
            '/api/v1/users/',
            {
                'username': 'new-user',
                'password': 'Strong-demo-password-42',
            },
            format='json'
        )

        self.assertEqual(response.status_code, 201)
        user = get_user_model().objects.get(username='new-user')
        self.assertTrue(user.check_password('Strong-demo-password-42'))


class AccountApiTests(TestCase):

    def setUp(self):
        self.current_password = 'Current-password-42!'
        self.user = get_user_model().objects.create_user(
            username='account-user',
            password=self.current_password
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_current_user_returns_only_public_account_fields(self):
        response = self.client.get('/api/v1/users/me/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data,
            {'id': self.user.id, 'username': self.user.username}
        )
        self.assertNotIn('password', response.data)

    def test_authenticated_user_can_change_password(self):
        new_password = 'Updated-password-84!'

        response = self.client.post(
            '/api/v1/users/set_password/',
            {
                'current_password': self.current_password,
                'new_password': new_password,
                're_new_password': new_password,
            },
            format='json'
        )

        self.assertEqual(response.status_code, 204)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(new_password))
        self.assertFalse(self.user.check_password(self.current_password))

    def test_password_change_rejects_wrong_current_password(self):
        response = self.client.post(
            '/api/v1/users/set_password/',
            {
                'current_password': 'wrong-password',
                'new_password': 'Updated-password-84!',
                're_new_password': 'Updated-password-84!',
            },
            format='json'
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('current_password', response.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.current_password))

    def test_password_change_rejects_mismatched_new_passwords(self):
        response = self.client.post(
            '/api/v1/users/set_password/',
            {
                'current_password': self.current_password,
                'new_password': 'Updated-password-84!',
                're_new_password': 'Different-password-84!',
            },
            format='json'
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('non_field_errors', response.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.current_password))

    def test_password_change_applies_django_password_validators(self):
        response = self.client.post(
            '/api/v1/users/set_password/',
            {
                'current_password': self.current_password,
                'new_password': 'password',
                're_new_password': 'password',
            },
            format='json'
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('new_password', response.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.current_password))

    def test_anonymous_user_cannot_change_password(self):
        anonymous_client = APIClient()

        response = anonymous_client.post(
            '/api/v1/users/set_password/',
            {
                'current_password': self.current_password,
                'new_password': 'Updated-password-84!',
                're_new_password': 'Updated-password-84!',
            },
            format='json'
        )

        self.assertEqual(response.status_code, 401)


class LabelApiTests(TestCase):

    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username='label-user',
            password='test-password'
        )
        self.other_user = user_model.objects.create_user(
            username='other-label-user',
            password='test-password'
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.document = TextDocument.objects.create(
            user=self.user,
            title='Document',
            content='Добро и зло'
        )

    def test_delete_unused_label(self):
        label = Label.objects.create(
            user=self.user,
            name='Не используется'
        )

        response = self.client.delete(f'/api/v1/labels/{label.id}/')

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Label.objects.filter(pk=label.id).exists())

    def test_list_contains_only_users_labels(self):
        own_label = Label.objects.create(user=self.user, name='Своя')
        Label.objects.create(user=self.other_user, name='Чужая')

        response = self.client.get('/api/v1/labels/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            {label['id'] for label in response.data},
            {own_label.id}
        )

    def test_create_label_assigns_authenticated_user(self):
        response = self.client.post(
            '/api/v1/labels/',
            {'name': 'Новая', 'color': '#123456'},
            format='json'
        )

        self.assertEqual(response.status_code, 201)
        label = Label.objects.get(pk=response.data['id'])
        self.assertEqual(label.user, self.user)

    def test_different_users_can_use_the_same_label_name(self):
        Label.objects.create(user=self.other_user, name='важное')

        response = self.client.post(
            '/api/v1/labels/',
            {'name': 'важное', 'color': '#123456'},
            format='json'
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            Label.objects.filter(user=self.user, name='важное').exists()
        )

    def test_user_cannot_create_duplicate_label_name(self):
        Label.objects.create(user=self.user, name='важное')

        response = self.client.post(
            '/api/v1/labels/',
            {'name': 'важное', 'color': '#123456'},
            format='json'
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('name', response.data)
        self.assertEqual(
            Label.objects.filter(user=self.user, name='важное').count(),
            1
        )

    def test_user_cannot_delete_another_users_label(self):
        foreign_label = Label.objects.create(
            user=self.other_user,
            name='Чужая'
        )

        response = self.client.delete(
            f'/api/v1/labels/{foreign_label.id}/'
        )

        self.assertEqual(response.status_code, 404)
        self.assertTrue(Label.objects.filter(pk=foreign_label.id).exists())

    def test_label_in_use_detail_uses_singular_annotation_form(self):
        label = Label.objects.create(user=self.user, name='добро')
        Annotation.objects.create(
            document=self.document,
            label=label,
            start=0,
            end=5,
            text='Добро'
        )

        response = self.client.delete(f'/api/v1/labels/{label.id}/')

        self.assertEqual(response.status_code, 409)
        self.assertIn('используется в 1 аннотации', response.data['detail'])

    def test_cannot_delete_label_used_by_annotations(self):
        label = Label.objects.create(user=self.user, name='зло')
        Annotation.objects.create(
            document=self.document,
            label=label,
            start=0,
            end=5,
            text='Добро'
        )
        Annotation.objects.create(
            document=self.document,
            label=label,
            start=8,
            end=11,
            text='зло'
        )

        response = self.client.delete(f'/api/v1/labels/{label.id}/')

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response['Content-Type'], 'application/json')
        self.assertNotIn(b'Traceback', response.content)
        self.assertEqual(response.data['code'], 'label_in_use')
        self.assertEqual(response.data['annotations_count'], 2)
        self.assertIn('Нельзя удалить метку «зло»', response.data['detail'])
        self.assertIn('используется в 2 аннотациях', response.data['detail'])
        self.assertTrue(Label.objects.filter(pk=label.id).exists())
        self.assertEqual(Annotation.objects.filter(label=label).count(), 2)

        Annotation.objects.filter(label=label).delete()
        retry_response = self.client.delete(f'/api/v1/labels/{label.id}/')

        self.assertEqual(retry_response.status_code, 204)
        self.assertFalse(Label.objects.filter(pk=label.id).exists())


class AnnotationApiTests(TestCase):

    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username='annotation-owner',
            password='test-password'
        )
        self.other_user = user_model.objects.create_user(
            username='other-owner',
            password='test-password'
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.document = TextDocument.objects.create(
            user=self.user,
            title='Document',
            content='Начало\nнужный фрагмент\nконец'
        )
        self.other_document = TextDocument.objects.create(
            user=self.other_user,
            title='Other document',
            content='Чужой документ'
        )
        self.label = Label.objects.create(
            user=self.user,
            name='Метка',
            color='#ff0000'
        )
        self.other_label = Label.objects.create(
            user=self.other_user,
            name='Чужая метка',
            color='#00ff00'
        )

    def create_annotation(self, document=None, label=None, start=0, end=6):
        return self.client.post(
            '/api/v1/annotations/',
            {
                'document': (document or self.document).id,
                'label': (label or self.label).id,
                'start': start,
                'end': end,
                'text': 'Клиентскому тексту нельзя доверять',
            },
            format='json'
        )

    def test_owner_can_create_annotation_and_text_is_computed(self):
        start = self.document.content.index('нужный')
        end = start + len('нужный фрагмент')

        response = self.create_annotation(start=start, end=end)

        self.assertEqual(response.status_code, 201)
        annotation = Annotation.objects.get(pk=response.data['id'])
        self.assertEqual(
            annotation.text,
            self.document.content[start:end]
        )

    def test_cannot_create_annotation_when_start_equals_end(self):
        response = self.create_annotation(start=3, end=3)

        self.assertEqual(response.status_code, 400)
        self.assertIn('end', response.data)
        self.assertFalse(Annotation.objects.exists())

    def test_cannot_create_annotation_with_negative_start(self):
        response = self.create_annotation(start=-1, end=3)

        self.assertEqual(response.status_code, 400)
        self.assertIn('start', response.data)
        self.assertFalse(Annotation.objects.exists())

    def test_cannot_create_annotation_past_document_end(self):
        response = self.create_annotation(
            start=0,
            end=len(self.document.content) + 1
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('end', response.data)
        self.assertFalse(Annotation.objects.exists())

    def test_cannot_create_whitespace_only_annotation(self):
        start = self.document.content.index('\n')

        response = self.create_annotation(start=start, end=start + 1)

        self.assertEqual(response.status_code, 400)
        self.assertIn('start', response.data)
        self.assertFalse(Annotation.objects.exists())

    def test_cannot_create_annotation_for_another_users_document(self):
        response = self.create_annotation(document=self.other_document)

        self.assertEqual(response.status_code, 400)
        self.assertIn('document', response.data)
        self.assertFalse(Annotation.objects.exists())

    def test_cannot_create_annotation_with_another_users_label(self):
        response = self.create_annotation(label=self.other_label)

        self.assertEqual(response.status_code, 400)
        self.assertIn('label', response.data)
        self.assertFalse(Annotation.objects.exists())

    def test_list_contains_only_annotations_for_users_documents(self):
        own_annotation = Annotation.objects.create(
            document=self.document,
            label=self.label,
            start=0,
            end=6,
            text='Начало'
        )
        Annotation.objects.create(
            document=self.other_document,
            label=self.other_label,
            start=0,
            end=5,
            text='Чужой'
        )

        response = self.client.get('/api/v1/annotations/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            {annotation['id'] for annotation in response.data},
            {own_annotation.id}
        )


class ProtectedApiTests(TestCase):

    def setUp(self):
        user = get_user_model().objects.create_user(
            username='protected-owner',
            password='test-password'
        )
        document = TextDocument.objects.create(
            user=user,
            title='Protected document',
            content='Protected content'
        )
        label = Label.objects.create(user=user, name='Protected label')
        annotation = Annotation.objects.create(
            document=document,
            label=label,
            start=0,
            end=9,
            text='Protected'
        )
        self.detail_endpoints = (
            f'/api/v1/documents/{document.id}/',
            f'/api/v1/labels/{label.id}/',
            f'/api/v1/annotations/{annotation.id}/',
        )

    def test_unauthenticated_list_and_create_are_denied(self):
        client = APIClient()

        endpoints = (
            ('/api/v1/documents/', {'title': 'No', 'content': 'Access'}),
            ('/api/v1/labels/', {'name': 'No access'}),
            (
                '/api/v1/annotations/',
                {'document': 1, 'label': 1, 'start': 0, 'end': 1},
            ),
        )
        for endpoint, payload in endpoints:
            for method in ('get', 'post'):
                with self.subTest(endpoint=endpoint, method=method):
                    response = getattr(client, method)(
                        endpoint,
                        payload,
                        format='json'
                    )
                    self.assertEqual(response.status_code, 401)

    def test_unauthenticated_retrieve_update_and_delete_are_denied(self):
        client = APIClient()

        for endpoint in self.detail_endpoints:
            for method in ('get', 'patch', 'delete'):
                with self.subTest(endpoint=endpoint, method=method):
                    response = getattr(client, method)(
                        endpoint,
                        {'name': 'No access'},
                        format='json'
                    )
                    self.assertEqual(response.status_code, 401)

    def test_unauthenticated_document_actions_are_denied(self):
        client = APIClient()
        document_endpoint = self.detail_endpoints[0]
        document_id = document_endpoint.rstrip('/').split('/')[-1]

        for endpoint, method in (
            (f'/api/v1/documents/{document_id}/chunks/', 'get'),
            ('/api/v1/documents/upload/', 'post'),
        ):
            with self.subTest(endpoint=endpoint, method=method):
                response = getattr(client, method)(endpoint)
                self.assertEqual(response.status_code, 401)
