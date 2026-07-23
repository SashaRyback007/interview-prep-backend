from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from fastapi.security import OAuth2PasswordRequestForm
from app import models, schemas, auth
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