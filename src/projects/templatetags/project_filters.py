from django import template

register = template.Library()

@register.filter
def clean_synopsis(value):
    if not isinstance(value, str):
        return value
    marker = '[RWANGA_META]'
    if marker in value:
        return value.split(marker, 1)[0].strip()
    return value

