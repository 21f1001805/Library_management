from typing import Annotated

from fastapi import APIRouter, Depends
from prisma.models import User

from app.api.deps import get_current_user
from app.modules.chat.orchestrator import run_chat
from app.modules.chat.schemas import ChatRequest, ChatResponse

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    current_user: Annotated[User, Depends(get_current_user)],
) -> ChatResponse:
    return await run_chat(
        message=payload.message,
        history=payload.history,
        member_id=current_user.id,
        user_name=current_user.fullName,
        role=current_user.role.name,
    )
