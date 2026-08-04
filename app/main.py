from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from fastapi.security import OAuth2PasswordRequestForm
from app import models, schemas, auth
from app.database import Base, engine, get_db
from app import models, schemas
from app.auth import get_current_user
import random
from fastapi.staticfiles import StaticFiles
from fastapi import HTTPException, status

# Автоматично створюємо таблиці в БД
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Interview Prep API")


# @app.get("/")
# def read_root():
#     return {"message": "API працює успішно!"}


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

# ==================== AUTH ENDPOINTS ====================

@app.post("/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    # Перевіряємо, чи немає вже користувача з таким email або username
    existing_user = db.query(models.User).filter(
        (models.User.email == user_data.email) | (models.User.username == user_data.username)
    ).first()
    
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email or username already exists")

    # Хешуємо пароль перед збереженням
    hashed_pwd = auth.hash_password(user_data.password)

    new_user = models.User(
        email=user_data.email,
        username=user_data.username,
        password_hash=hashed_pwd
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Шукаємо користувача за username (або email)
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Генеруємо токен
    access_token = auth.create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}

# ==================== PROGRESS ENDPOINTS ====================

@app.post("/progress", response_model=schemas.ProgressResponse)
def set_question_progress(
    progress_data: schemas.ProgressCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Перевіряємо, чи існує таке питання
    question = db.query(models.Question).filter(models.Question.id == progress_data.question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    # Перевіряємо, чи вже є запис про прогрес для цього користувача і питання
    progress_entry = db.query(models.UserProgress).filter(
        models.UserProgress.user_id == current_user.id,
        models.UserProgress.question_id == progress_data.question_id
    ).first()

    if progress_entry:
        # Оновлюємо існуючий статус
        progress_entry.status = progress_data.status
    else:
        # Створюємо новий запис
        progress_entry = models.UserProgress(
            user_id=current_user.id,
            question_id=progress_data.question_id,
            status=progress_data.status
        )
        db.add(progress_entry)

    db.commit()
    db.refresh(progress_entry)
    return progress_entry


@app.get("/progress", response_model=list[schemas.ProgressResponse])
def get_user_progress(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Повертаємо всі записи прогресу поточного користувача
    return db.query(models.UserProgress).filter(models.UserProgress.user_id == current_user.id).all()

@app.get("/stats", response_model=schemas.UserStatsResponse)
def get_user_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # 1. Загальна кількість питань у системі
    total_questions = db.query(models.Question).count()
    
    if total_questions == 0:
        return schemas.UserStatsResponse(
            total_questions=0,
            new_count=0,
            learning_count=0,
            mastered_count=0,
            progress_percentage=0.0
        )

    # 2. Отримуємо весь прогрес поточного користувача
    user_progress = db.query(models.UserProgress).filter(
        models.UserProgress.user_id == current_user.id
    ).all()

    # Підраховуємо статус кожного питання
    learning_count = sum(1 for p in user_progress if p.status == models.StatusEnum.LEARNING)
    mastered_count = sum(1 for p in user_progress if p.status == models.StatusEnum.MASTERED)
    
    # Решта питань, для яких ще немає запису або статус NEW — це new_count
    new_count = total_questions - (learning_count + mastered_count)

    # Обчислюємо відсоток за засвоєними (Mastered) питаннями
    progress_percentage = round((mastered_count / total_questions) * 100, 2)

    return schemas.UserStatsResponse(
        total_questions=total_questions,
        new_count=new_count,
        learning_count=learning_count,
        mastered_count=mastered_count,
        progress_percentage=progress_percentage
    )

@app.get("/questions/random", response_model=schemas.QuestionResponse)
def get_random_question(
    category_id: int | None = None,
    difficulty: str | None = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Question)
    
    # Фільтруємо категорію, тільки якщо це дійсний ID (> 0)
    if category_id and category_id > 0:
        query = query.filter(models.Question.category_id == category_id)
        
    # Фільтруємо складність, тільки якщо це не "All" і значення заповнене
    if difficulty and difficulty != "All":
        query = query.filter(models.Question.difficulty == difficulty)
        
    questions = query.all()
    
    if not questions:
        raise HTTPException(
            status_code=404, 
            detail="No questions found with specified parameters"
        )
        
    return random.choice(questions)


@app.delete("/api/questions/{question_id}")
def delete_question(question_id: int, db: Session = Depends(get_db)):
    # Звертаємося через models.Question
    question = db.query(models.Question).filter(models.Question.id == question_id).first()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Question not found"
        )
    
    # Видаляємо зв'язаний прогрес користувачів за цим питанням (якщо є)
    db.query(models.UserProgress).filter(models.UserProgress.question_id == question_id).delete()

    # Видаляємо сам об'єкт питання
    db.delete(question)
    db.commit()
    return {"message": "Question deleted successfully"}

app.mount("/", StaticFiles(directory="static", html=True), name="static")