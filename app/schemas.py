from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from app.models import DifficultyEnum
from app.models import StatusEnum

# ==================== CATEGORY SCHEMAS ====================

# Базова схема для Категорії (поля, які потрібні при створенні)
class CategoryBase(BaseModel):
    name: str
    slug: str

class CategoryCreate(CategoryBase):
    pass

# Схема для повернення Категорії з БД (включає id)
class CategoryResponse(CategoryBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# ==================== QUESTION SCHEMAS ====================

# Базова схема для Питання
class QuestionBase(BaseModel):
    title: str
    question_text: str
    answer_text: str
    difficulty: DifficultyEnum = DifficultyEnum.MEDIUM

class QuestionCreate(QuestionBase):
    category_id: int

# Схема для повернення Питання з БД
class QuestionResponse(QuestionBase):
    id: int
    category_id: int

    model_config = ConfigDict(from_attributes=True)


# ==================== NESTED SCHEMAS ====================

# Схема категорії разом із лістом питань у ній
class CategoryWithQuestionsResponse(CategoryResponse):
    questions: List[QuestionResponse] = []

    model_config = ConfigDict(from_attributes=True)

# ==================== USER & AUTH SCHEMAS ====================

# Схема для реєстрації користувача
class UserCreate(BaseModel):
    email: str
    username: str
    password: str

# Схема для повернення даних користувача
class UserResponse(BaseModel):
    id: int
    email: str
    username: str

    model_config = ConfigDict(from_attributes=True)

# Схема для повернення JWT-токена
class Token(BaseModel):
    access_token: str
    token_type: str

# ==================== PROGRESS SCHEMAS ====================

# Схема для створення/оновлення статусу вивчення
class ProgressCreate(BaseModel):
    question_id: int
    status: str  # Наприклад: "learned", "review", "in_progress"

# Схема для повернення запису про прогрес
class ProgressResponse(BaseModel):
    id: int
    user_id: int
    question_id: int
    status: str

    model_config = ConfigDict(from_attributes=True)

class ProgressCreate(BaseModel):
    question_id: int
    status: StatusEnum

class ProgressResponse(BaseModel):
    id: int
    user_id: int
    question_id: int
    status: StatusEnum

    model_config = ConfigDict(from_attributes=True)