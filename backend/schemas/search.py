from typing import Literal

from pydantic import BaseModel, Field

from schemas.destination import DestinationOut


class SearchIn(BaseModel):
    location: str = Field(min_length=1, max_length=50)


class SearchOut(BaseModel):
    location: str
    status: Literal["completed", "processing"]
    task_id: str | None = None  # 交給背景處理時才會有
    destinations: list[DestinationOut]


class TaskStatusOut(BaseModel):
    status: Literal["processing", "completed", "failed"]
    added: int | None = None  # 完成時：新增了幾個景點
    error: str | None = None  # 失敗時：原因
