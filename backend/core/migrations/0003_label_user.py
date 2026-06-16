import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


FALLBACK_USERNAME = 'legacy-label-owner'


def assign_label_owners(apps, schema_editor):
    Label = apps.get_model('core', 'Label')
    Annotation = apps.get_model('core', 'Annotation')
    User = apps.get_model(*settings.AUTH_USER_MODEL.split('.'))

    fallback_user = (
        User.objects.filter(is_superuser=True).order_by('id').first()
        or User.objects.order_by('id').first()
    )

    for label in Label.objects.order_by('id'):
        user_ids = list(
            Annotation.objects.filter(label_id=label.id)
            .order_by('document__user_id')
            .values_list('document__user_id', flat=True)
            .distinct()
        )

        if not user_ids:
            if fallback_user is None:
                fallback_user = User.objects.create(
                    username=FALLBACK_USERNAME,
                    password='!',
                    is_active=False,
                )
            label.user_id = fallback_user.id
            label.save(update_fields=['user'])
            continue

        label.user_id = user_ids[0]
        label.save(update_fields=['user'])

        for user_id in user_ids[1:]:
            copied_label = Label.objects.create(
                user_id=user_id,
                name=label.name,
                color=label.color,
            )
            Annotation.objects.filter(
                label_id=label.id,
                document__user_id=user_id,
            ).update(label_id=copied_label.id)

    labels_by_owner_and_name = {}
    for label in Label.objects.order_by('id'):
        key = (label.user_id, label.name)
        existing_label_id = labels_by_owner_and_name.get(key)
        if existing_label_id is None:
            labels_by_owner_and_name[key] = label.id
            continue

        Annotation.objects.filter(label_id=label.id).update(
            label_id=existing_label_id
        )
        label.delete()


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('core', '0002_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='label',
            name='user',
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='labels',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(
            assign_label_owners,
            reverse_code=migrations.RunPython.noop,
            atomic=True,
        ),
        migrations.AlterField(
            model_name='label',
            name='user',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='labels',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddConstraint(
            model_name='label',
            constraint=models.UniqueConstraint(
                fields=('user', 'name'),
                name='unique_label_name_per_user',
            ),
        ),
    ]
