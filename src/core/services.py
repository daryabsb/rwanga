from django.core.serializers import serialize
from django.db.models.fields.related import ForeignObjectRel
import json


def snapshot_related(instance, depth=1):
    """Walk reverse relations and capture all related rows into a JSON-serializable dict.
    Used when soft-deleting parent records so child data can be restored.
    depth: how many levels of relation to walk; 1 = direct children only."""
    data = {"self": _serialize_one(instance), "related": {}}
    if depth <= 0:
        return data
    for rel in instance._meta.get_fields():
        if isinstance(rel, ForeignObjectRel):
            related_name = rel.get_accessor_name()
            if not hasattr(instance, related_name):
                continue
            qs = getattr(instance, related_name)
            if hasattr(qs, "all"):
                children = list(qs.all())
                if children:
                    data["related"][related_name] = [_serialize_one(c) for c in children]
    return data


def _serialize_one(obj):
    serialized = json.loads(serialize("json", [obj]))[0]
    result = {"model": serialized["model"], "pk": str(serialized["pk"]), "fields": serialized["fields"]}
    result.update(serialized["fields"])
    return result
