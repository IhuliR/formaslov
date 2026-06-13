from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import models
from slugify import slugify

User = get_user_model()


def slugify_document_title(title):
    return slugify(
        title,
        replacements=(('Я', 'Ya'), ('я', 'ya')),
    )


def generate_unique_document_slug(user, title, instance=None):
    base_slug = slugify_document_title(title)[:255] or 'document'
    queryset = TextDocument.objects.filter(user=user)

    if instance is not None and instance.pk:
        queryset = queryset.exclude(pk=instance.pk)

    slug = base_slug
    counter = 2
    while queryset.filter(slug=slug).exists():
        suffix = f'-{counter}'
        slug = f'{base_slug[:255 - len(suffix)]}{suffix}'
        counter += 1

    return slug


class TextDocument(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE,
                             related_name='documents')
    title = models.CharField(max_length=255, blank=True)
    slug = models.SlugField(max_length=255)
    original_filename = models.CharField(max_length=255, blank=True)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'slug'],
                name='unique_document_slug_per_user'
            )
        ]

    def save(self, *args, **kwargs):
        self.title = self.title.strip() or 'Новый документ'
        title_changed = self._state.adding or not self.slug

        if self.pk and not title_changed:
            previous_title = type(self).objects.filter(pk=self.pk).values_list(
                'title',
                flat=True
            ).first()
            title_changed = previous_title != self.title

        if title_changed:
            self.slug = generate_unique_document_slug(
                self.user,
                self.title,
                instance=self
            )
            update_fields = kwargs.get('update_fields')
            if update_fields is not None:
                kwargs['update_fields'] = set(update_fields) | {
                    'title',
                    'slug',
                }

        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class Label(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='labels'
    )
    name = models.CharField(max_length=100)
    color = models.CharField(max_length=7, default='#ffff00')

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'name'],
                name='unique_label_name_per_user'
            )
        ]

    def __str__(self):
        return self.name


class Annotation(models.Model):
    document = models.ForeignKey(TextDocument, on_delete=models.CASCADE,
                                 related_name='annotations')
    label = models.ForeignKey(Label, on_delete=models.PROTECT)
    start = models.PositiveIntegerField()
    end = models.PositiveIntegerField()
    text = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.label.name}: {self.text[:30]}...'
