RBAC_AREAS = ["scripts", "breakdown", "shots", "storyboards", "scheduling",
              "contacts", "departments", "reviews", "community",
              "progress", "settings", "billing"]
RBAC_ACTIONS = ["view", "edit", "manage", "delete"]


ROLE_DEFAULT_PERMISSIONS = {
    "owner": {area: ["view", "edit", "manage", "delete"] for area in RBAC_AREAS},
    "admin": {area: ["view", "edit", "manage"] for area in RBAC_AREAS},
    "member": {area: ["view", "edit"] for area in RBAC_AREAS if area != "billing"},
    "auditor": {area: ["view"] for area in RBAC_AREAS},
    "reviewer": {area: ["view"] for area in RBAC_AREAS},
}


def user_can(user, studio, area, action):
    if not user.is_authenticated:
        return False
    membership = studio.memberships.filter(user=user, status="active").first()
    if not membership:
        return False
    role_perms = ROLE_DEFAULT_PERMISSIONS.get(membership.role, {})
    overrides = membership.permissions or {}
    allowed = overrides.get(area, role_perms.get(area, []))
    return action in allowed
