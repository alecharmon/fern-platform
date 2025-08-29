from pydantic import BaseModel


class PaginationResponse(BaseModel):
    total: int
    page: int
    limit: int
