from enum import StrEnum


class Role(StrEnum):
    ADMIN = "admin"
    LIBRARIAN = "librarian"
    MANAGER = "manager"
    MEMBER = "member"
    GUARDIAN = "guardian"
    IT_HEAD = "it-head"
