import re
from pathlib import Path

from django.db.models.deletion import ProtectedError
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.parsers import MultiPartParser

from core.models import TextDocument, Label, Annotation
from .serializers import (TextDocumentSerializer, LabelSerializer,
                          AnnotationSerializer)
from .permissions import IsAuthor


class TextDocumentViewSet(viewsets.ModelViewSet):
    queryset = TextDocument.objects.all()
    serializer_class = TextDocumentSerializer
    permission_classes = [IsAuthenticated, IsAuthor]
    pagination_class = LimitOffsetPagination
    parser_classes = [MultiPartParser]

    def get_document(self, pk=None):
        pk = pk or self.kwargs.get('pk')
        document = get_object_or_404(
            TextDocument, pk=pk, user=self.request.user
        )
        return document

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)

    def perform_create(self, serializer):
        return serializer.save(user=self.request.user)

    @action(detail=True, methods=['get'])
    def chunks(self, request, pk=None):
        document = self.get_document(pk)

        content = document.content or ""

        # Find "paragraph blocks": text separated by one or more blank lines
        # Skips empty chunks but keeps correct absolute offsets.
        matches = list(
            re.finditer(
                r"\S.*?(?=\n\s*\n|\Z)",
                content,
                flags=re.DOTALL
            )
        )
        raw_chunks = [m.group(0) for m in matches]
        offsets = [m.start() for m in matches]

        # query params
        try:
            page = int(request.query_params.get("page", 1))
            page_size = int(request.query_params.get("page_size", 1))
        except ValueError:
            return Response(
                {"detail": "page and page_size must be integers."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if page < 1 or page_size < 1:
            return Response(
                {"detail": "page and page_size must be >= 1."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Early return for empty documents
        if not raw_chunks:
            return Response(
                {
                    "document_id": document.id,
                    "page": page,
                    "page_size": page_size,
                    "has_next": False,
                    "has_prev": False,
                    "total_chunks": 0,
                    "chunk": [],
                    "chunk_index": None,
                    "chunk_start": None,
                    "chunk_end": None,
                },
                status=status.HTTP_200_OK
            )

        total_chunks = len(raw_chunks)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size

        if start_idx >= total_chunks:
            return Response(
                {"detail": "Страница вне диапазона."},
                status=status.HTTP_404_NOT_FOUND
            )

        page_chunks = raw_chunks[start_idx:end_idx]

        if len(page_chunks) == 1:
            chunk_index = start_idx
            chunk_start = offsets[chunk_index]
            chunk_end = chunk_start + len(page_chunks[0])
        else:
            chunk_index = None
            chunk_start = None
            chunk_end = None

        return Response(
            {
                "document_id": document.id,
                "page": page,
                "page_size": page_size,
                "has_next": end_idx < total_chunks,
                "has_prev": page > 1,
                "total_chunks": total_chunks,
                "chunk": page_chunks,
                "chunk_index": chunk_index,
                "chunk_start": chunk_start,
                "chunk_end": chunk_end,
            },
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['post'], url_path='upload')
    def upload_file(self, request):
        uploaded_file = request.FILES.get('file')

        if not uploaded_file:
            return Response({"detail": "Файл не найден."},
                            status=status.HTTP_400_BAD_REQUEST)

        if not uploaded_file.name.endswith('.txt'):
            return Response({"detail": "Только .txt файлы разрешены."},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            content = uploaded_file.read().decode('utf-8')
        except UnicodeDecodeError:
            return Response(
                {"detail": "Ошибка при чтении файла. Проверьте кодировку."},
                status=status.HTTP_400_BAD_REQUEST
            )

        content = content.replace('\r\n', '\n').replace('\r', '\n')
        serializer = self.get_serializer(data={
            'title': Path(uploaded_file.name).stem,
            'original_filename': uploaded_file.name,
            'content': content,
        })
        serializer.is_valid(raise_exception=True)
        document = serializer.save(
            user=request.user,
        )

        return Response(
            self.get_serializer(document).data,
            status=status.HTTP_201_CREATED
        )


class LabelViewSet(viewsets.ModelViewSet):
    queryset = Label.objects.all()
    serializer_class = LabelSerializer
    permission_classes = [IsAuthenticated, IsAuthor]

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def destroy(self, request, *args, **kwargs):
        label = self.get_object()

        try:
            self.perform_destroy(label)
        except ProtectedError:
            annotations_count = label.annotation_set.count()
            annotations_word = (
                'аннотации'
                if annotations_count % 10 == 1
                and annotations_count % 100 != 11
                else 'аннотациях'
            )
            return Response(
                {
                    'detail': (
                        f'Нельзя удалить метку «{label.name}»: она '
                        f'используется в {annotations_count} '
                        f'{annotations_word}. '
                        'Сначала удалите или измените эти аннотации.'
                    ),
                    'code': 'label_in_use',
                    'annotations_count': annotations_count,
                },
                status=status.HTTP_409_CONFLICT
            )

        return Response(status=status.HTTP_204_NO_CONTENT)


class AnnotationViewSet(viewsets.ModelViewSet):
    queryset = Annotation.objects.select_related('document', 'label')
    serializer_class = AnnotationSerializer
    permission_classes = [IsAuthenticated, IsAuthor]

    def get_queryset(self):
        qs = self.queryset.filter(document__user=self.request.user)
        document_id = self.request.query_params.get('document')
        if document_id:
            qs = qs.filter(document_id=document_id)
        return qs
