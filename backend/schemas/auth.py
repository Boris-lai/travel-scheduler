from pydantic import BaseModel, ConfigDict, EmailStr, Field


# 點餐單：註冊
class SignupIn(BaseModel):
    email: EmailStr  # 會檢查是不是 Email 的格式
    password: str = Field(min_length=8, max_length=128)  # 上限：防止有人送超長的密碼拖慢伺服器
    name: str = Field(min_length=1, max_length=30)


# 點餐單：登入
class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


# 出餐單：會員資料（沒有 password_hash，不會送出去）
class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str
