from fastapi import APIRouter

from app.modules.translate import service
from app.modules.translate.schemas import (
    TranslateBatchRequest,
    TranslateBatchResponse,
    TranslateRequest,
    TranslateResponse,
)

router = APIRouter(prefix="/translate", tags=["translate"])


@router.post("", response_model=TranslateResponse)
async def translate(payload: TranslateRequest) -> TranslateResponse:
    return await service.translate_text(payload)


@router.post("/batch", response_model=TranslateBatchResponse)
async def translate_batch(payload: TranslateBatchRequest) -> TranslateBatchResponse:
    return await service.translate_batch(payload)
