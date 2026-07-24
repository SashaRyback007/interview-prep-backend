def test_register_user(client):
    response = client.post(
        "/register",
        json={
            "username": "testuser",
            "email": "test@example.com",
            "password": "password123",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert "id" in data


def test_login_user(client):
    # Спочатку реєструємо
    client.post(
        "/register",
        json={
            "username": "testuser",
            "email": "test@example.com",
            "password": "password123",
        },
    )

    # Намагаємося увійти
    response = client.post(
        "/login",
        data={"username": "testuser", "password": "password123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_get_stats_unauthorized(client):
    # Запит до /stats без токена має повертати 401
    response = client.get("/stats")
    assert response.status_code == 401