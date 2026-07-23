from fastapi import FastAPI
from app.database import Base, engine

# Автоматично створюємо всі таблиці в SQLite при запуску
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Interview Prep API")


@app.get("/")
def read_root():
    return {"message": "API працює успішно!"}