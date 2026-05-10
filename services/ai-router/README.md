# AI Router for Cloud Run

Маленький прокси-сервис для Gemini API, который можно развернуть в Google Cloud Run и использовать из нескольких проектов.

## Что делает

- принимает запросы от ваших проектов;
- проверяет `Bearer` токен;
- ходит в Gemini API из поддерживаемого региона;
- возвращает ответ обратно без лишней логики.

## Переменные окружения

- `GEMINI_API_KEY` - ключ Gemini API
- `ROUTER_TOKEN` - общий токен доступа для ваших проектов
- `GEMINI_MODEL` - модель по умолчанию, опционально

## Эндпоинты

- `GET /health`
- `POST /v1/gemini/generate-content`

Пример тела:

```json
{
  "model": "gemini-2.5-flash",
  "body": {
    "contents": [
      {
        "parts": [
          {
            "text": "Hello"
          }
        ]
      }
    ]
  }
}
```

## Деплой в Cloud Run

Официальные материалы:
- [Cloud Run quickstart](https://cloud.google.com/run/docs/quickstarts/deploy-container)
- [Deploy from source](https://docs.cloud.google.com/run/docs/deploying-source-code)
- [Secret Manager](https://cloud.google.com/secret-manager/docs/creating-and-accessing-secrets)

### 1. Подготовить проект

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com
```

### 2. Создать секреты

```bash
printf '%s' 'YOUR_GEMINI_API_KEY' | gcloud secrets create gemini-api-key --data-file=-
printf '%s' 'YOUR_LONG_RANDOM_ROUTER_TOKEN' | gcloud secrets create ai-router-token --data-file=-
```

Если секрет уже существует:

```bash
printf '%s' 'NEW_VALUE' | gcloud secrets versions add gemini-api-key --data-file=-
printf '%s' 'NEW_VALUE' | gcloud secrets versions add ai-router-token --data-file=-
```

### 3. Деплой

```bash
cd services/ai-router
gcloud run deploy techaks-ai-router \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest \
  --set-secrets ROUTER_TOKEN=ai-router-token:latest \
  --set-env-vars GEMINI_MODEL=gemini-2.5-flash
```

### 4. Проверка

```bash
curl https://YOUR_RUN_URL/health
```

### 5. Подключение в проекте

В админке магазина:

- `AI Proxy URL` = `https://YOUR_RUN_URL`
- `Токен роутера` = ваш `ROUTER_TOKEN`
- `Модель` = `gemini-2.5-flash`

После этого проект будет ходить в Gemini через Cloud Run роутер.
