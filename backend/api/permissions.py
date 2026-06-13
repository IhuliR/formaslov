from rest_framework.permissions import BasePermission


class IsAuthor(BasePermission):

    def has_object_permission(self, request, view, obj):
        if hasattr(obj, 'user'):
            return obj.user == request.user

        if hasattr(obj, 'document'):
            return obj.document.user == request.user

        return False
