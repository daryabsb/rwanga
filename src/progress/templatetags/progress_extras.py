from django import template

register = template.Library()


@register.filter(name="split")
def split_filter(value, separator=","):
    if value is None:
        return []
    return str(value).split(separator)
