from pydantic import BaseModel

class InitChatResponse(BaseModel):
    event_id: str
    session_id: str
