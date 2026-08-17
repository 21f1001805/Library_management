from pydantic import BaseModel, Field


class TranslateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    target_lang: str = Field(min_length=2, max_length=10)
    source_lang: str = "auto"


class TranslateResponse(BaseModel):
    translated: str


class TranslateBatchRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=2000)
    target_lang: str = Field(min_length=2, max_length=10)
    source_lang: str = "auto"


class TranslateBatchResponse(BaseModel):
    translated: list[str]
