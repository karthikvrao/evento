from pydantic import BaseModel
from typing import Optional


class InitChatRequest(BaseModel):
    name: str
    description: Optional[str] = None
    event_type: Optional[str] = None


class InitChatResponse(BaseModel):
    event_id: str
    session_id: str
