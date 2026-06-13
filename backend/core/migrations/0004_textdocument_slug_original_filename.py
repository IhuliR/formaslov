from django.db import migrations, models
from slugify import slugify


def populate_document_metadata(apps, schema_editor):
    TextDocument = apps.get_model('core', 'TextDocument')
    used_slugs = {}

    for document in TextDocument.objects.order_by('user_id', 'id'):
        title = (document.title or '').strip()
        if not title:
            title = f'Документ {document.id}'

        base_slug = slugify(
            title,
            replacements=(('Я', 'Ya'), ('я', 'ya')),
        )[:255] or 'document'
        user_slugs = used_slugs.setdefault(document.user_id, set())
        document_slug = base_slug
        counter = 2

        while document_slug in user_slugs:
            suffix = f'-{counter}'
            document_slug = f'{base_slug[:255 - len(suffix)]}{suffix}'
            counter += 1

        document.title = title
        document.slug = document_slug
        document.save(update_fields=['title', 'slug'])
        user_slugs.add(document_slug)


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0003_label_user'),
    ]

    operations = [
        migrations.AddField(
            model_name='textdocument',
            name='original_filename',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='textdocument',
            name='slug',
            field=models.SlugField(max_length=255, null=True),
        ),
        migrations.RunPython(
            populate_document_metadata,
            reverse_code=migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name='textdocument',
            name='slug',
            field=models.SlugField(max_length=255),
        ),
        migrations.AddConstraint(
            model_name='textdocument',
            constraint=models.UniqueConstraint(
                fields=('user', 'slug'),
                name='unique_document_slug_per_user',
            ),
        ),
    ]
