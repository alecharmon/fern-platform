from pydantic import BaseModel


class ChatRequest(BaseModel):
    domain: str
