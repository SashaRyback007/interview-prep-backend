from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from app.models import DifficultyEnum


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