from datetime import UTC, datetime

from prisma.models import CommunityBan, CommunityComment, CommunityPost

from app.db.prisma import prisma

POST_INCLUDE = {
    "author": True,
    "likes": True,
    "saves": True,
    "comments": {"include": {"author": True}, "order_by": {"createdAt": "asc"}},
}


async def list_posts() -> list[CommunityPost]:
    return await prisma.communitypost.find_many(
        where={"deletedAt": None},
        include=POST_INCLUDE,
        order={"createdAt": "desc"},
    )


async def find_post(post_id: str) -> CommunityPost | None:
    post = await prisma.communitypost.find_unique(where={"id": post_id}, include=POST_INCLUDE)
    if post is None or post.deletedAt is not None:
        return None
    return post


async def create_post(author_id: str, data: dict) -> CommunityPost:
    created = await prisma.communitypost.create(data={**data, "authorId": author_id})
    post = await find_post(created.id)
    assert post is not None
    return post


async def update_post(post_id: str, data: dict) -> CommunityPost:
    await prisma.communitypost.update(where={"id": post_id}, data=data)
    post = await find_post(post_id)
    assert post is not None
    return post


async def soft_delete_post(post_id: str) -> None:
    await prisma.communitypost.update(where={"id": post_id}, data={"deletedAt": datetime.now(UTC)})


async def set_post_reported(post_id: str, reported: bool) -> CommunityPost:
    return await update_post(post_id, {"reported": reported})


async def toggle_like(post_id: str, user_id: str) -> CommunityPost:
    existing = await prisma.communitypostlike.find_unique(
        where={"postId_userId": {"postId": post_id, "userId": user_id}}
    )
    if existing:
        await prisma.communitypostlike.delete(where={"id": existing.id})
    else:
        await prisma.communitypostlike.create(data={"postId": post_id, "userId": user_id})
    post = await find_post(post_id)
    assert post is not None
    return post


async def toggle_save(post_id: str, user_id: str) -> CommunityPost:
    existing = await prisma.communitypostsave.find_unique(
        where={"postId_userId": {"postId": post_id, "userId": user_id}}
    )
    if existing:
        await prisma.communitypostsave.delete(where={"id": existing.id})
    else:
        await prisma.communitypostsave.create(data={"postId": post_id, "userId": user_id})
    post = await find_post(post_id)
    assert post is not None
    return post


async def add_comment(
    post_id: str, author_id: str, content: str, parent_id: str | None
) -> CommunityPost:
    await prisma.communitycomment.create(
        data={
            "postId": post_id,
            "authorId": author_id,
            "content": content,
            "parentId": parent_id,
        }
    )
    post = await find_post(post_id)
    assert post is not None
    return post


async def find_comment(comment_id: str) -> CommunityComment | None:
    return await prisma.communitycomment.find_unique(where={"id": comment_id})


async def delete_comment(comment_id: str) -> None:
    await prisma.communitycomment.delete(where={"id": comment_id})


async def set_comment_reported(comment_id: str, reported: bool) -> None:
    await prisma.communitycomment.update(where={"id": comment_id}, data={"reported": reported})


async def find_ban(user_id: str) -> CommunityBan | None:
    return await prisma.communityban.find_unique(where={"userId": user_id})


async def list_bans() -> list[CommunityBan]:
    return await prisma.communityban.find_many(include={"user": True}, order={"createdAt": "asc"})


async def ban_user(user_id: str) -> None:
    await prisma.communityban.upsert(
        where={"userId": user_id},
        data={"create": {"userId": user_id}, "update": {}},
    )


async def unban_user(user_id: str) -> None:
    ban = await prisma.communityban.find_unique(where={"userId": user_id})
    if ban:
        await prisma.communityban.delete(where={"id": ban.id})
