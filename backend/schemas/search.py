from pydantic import BaseModel, Field

from schemas.destination import DestinationOut


class SearchIn(BaseModel):
    location: str = Field(min_length=1, max_length=50)


class SearchOut(BaseModel):
    location: str
    searched_web: bool  # 這次有沒有上網找
    added: int  # 這次新增了幾個景點
    destinations: list[DestinationOut]
