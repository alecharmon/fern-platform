from typing import Dict
from typing import Literal

from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

    def to_dict(self) -> Dict[str, str]:
        return {"role": self.role, "content": self.content}
