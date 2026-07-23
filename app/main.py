from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import Base, engine, get_db
from app import models, schemas

# Автоматично створюємо таблиці в БД
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Interview Prep API")


@app.get("/")
def read_root():
    return {"message": "API працює успішно!"}


# ==================== CATEGORIES ENDPOINTS ====================

@app.post("/categories/", response_model=schemas.CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(category: schemas.CategoryCreate, db: Session = Depends(get_db)):
    # Перевіряємо, чи немає вже категорії з таким slug
    db_category = db.query(models.Category).filter(models.Category.slug == category.slug).first()
    if db_category:
        raise HTTPException(status_code=400, detail="Category with this slug already exists")
    
    new_category = models.Category(name=category.name, slug=category.slug)
    db.add(new_category)
    db.commit()
    db.refresh(new_category)
    return new_category


@app.get("/categories/", response_model=List[schemas.CategoryResponse])
def get_categories(db: Session = Depends(get_db)):
    return db.query(models.Category).all()


# ==================== QUESTIONS ENDPOINTS ====================

@app.post("/questions/", response_model=schemas.QuestionResponse, status_code=status.HTTP_201_CREATED)
def create_question(question: schemas.QuestionCreate, db: Session = Depends(get_db)):
    # Перевіряємо, чи існує категорія для питання
    category = db.query(models.Category).filter(models.Category.id == question.category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    new_question = models.Question(
        category_id=question.category_id,
        title=question.title,
        question_text=question.question_text,
        answer_text=question.answer_text,
        difficulty=question.difficulty
    )
    db.add(new_question)
    db.commit()
    db.refresh(new_question)
    return new_question


@app.get("/categories/{category_id}/questions", response_model=List[schemas.QuestionResponse])
def get_questions_by_category(category_id: int, db: Session = Depends(get_db)):
    category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    return db.query(models.Question).filter(models.Question.category_id == category_id).all()