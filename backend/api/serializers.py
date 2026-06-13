from pathlib import Path

from django.contrib.auth import get_user_model
from rest_framework import serializers

from core.models import TextDocument, Label, Annotation


class CurrentUserSerializer(serializers.ModelSerializer):

    class Meta:
        model = get_user_model()
        fields = ('id', 'username')
        read_only_fields = ('id', 'username')


class TextDocumentSerializer(serializers.ModelSerializer):

    class Meta:
        model = TextDocument
        fields = (
            'id',
            'user',
            'title',
            'slug',
            'original_filename',
            'content',
            'created_at',
        )
        read_only_fields = ('user', 'slug', 'created_at')

    def validate_content(self, value):
        return value.replace('\r\n', '\n').replace('\r', '\n')

    def create(self, validated_data):
        validated_data['title'] = self._resolve_title(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'title' in validated_data:
            validated_data['title'] = self._resolve_title(
                validated_data,
                instance=instance
            )
        return super().update(instance, validated_data)

    @staticmethod
    def _resolve_title(validated_data, instance=None):
        title = validated_data.get('title', '')
        if title and title.strip():
            return title.strip()

        original_filename = validated_data.get(
            'original_filename',
            instance.original_filename if instance else ''
        )
        filename_title = Path(original_filename).stem.strip()
        return filename_title or 'Новый документ'


class LabelSerializer(serializers.ModelSerializer):

    class Meta:
        model = Label
        fields = ('id', 'name', 'color')

    def validate_name(self, value):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return value

        labels = Label.objects.filter(user=request.user, name=value)
        if self.instance:
            labels = labels.exclude(pk=self.instance.pk)

        if labels.exists():
            raise serializers.ValidationError(
                'У вас уже есть метка с таким названием.'
            )

        return value


class AnnotationSerializer(serializers.ModelSerializer):

    class Meta:
        model = Annotation
        fields = ('id', 'document', 'label', 'start', 'end', 'text',
                  'created_at')
        read_only_fields = ('text', 'created_at')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            self.fields['document'].queryset = TextDocument.objects.filter(
                user=request.user
            )
            self.fields['label'].queryset = Label.objects.filter(
                user=request.user
            )

    def validate(self, attrs):
        instance = self.instance
        document = attrs.get(
            'document',
            instance.document if instance else None
        )
        label = attrs.get('label', instance.label if instance else None)
        start = attrs.get('start', instance.start if instance else None)
        end = attrs.get('end', instance.end if instance else None)
        request = self.context.get('request')

        if (
            request
            and request.user.is_authenticated
            and document.user_id != request.user.id
        ):
            raise serializers.ValidationError({
                'document': 'Нельзя создавать аннотации для чужого документа.'
            })

        if (
            request
            and request.user.is_authenticated
            and label.user_id != request.user.id
        ):
            raise serializers.ValidationError({
                'label': 'Нельзя использовать чужую метку.'
            })

        if start >= end:
            raise serializers.ValidationError({
                'end': 'Конец выделения должен быть больше начала.'
            })

        if end > len(document.content):
            raise serializers.ValidationError({
                'end': 'Конец выделения выходит за границы документа.'
            })

        if not document.content[start:end].strip():
            raise serializers.ValidationError({
                'start': 'Выделение не может состоять только из пробелов.'
            })

        return attrs

    def create(self, validated_data):
        document = validated_data['document']
        start = validated_data['start']
        end = validated_data['end']
        validated_data['text'] = document.content[start:end]
        return super().create(validated_data)

    def update(self, instance, validated_data):
        document = validated_data.get('document', instance.document)
        start = validated_data.get('start', instance.start)
        end = validated_data.get('end', instance.end)
        validated_data['text'] = document.content[start:end]
        return super().update(instance, validated_data)
