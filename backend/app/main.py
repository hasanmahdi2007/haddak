"""The FastAPI application: wires the routers together.

Run with:  uvicorn app.main:app --reload
Docs at:   http://localhost:8000/docs
"""

from fastapi import APIRouter, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routers import admin, categories, me, providers, reviews

app = FastAPI(title="Haddak API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list(),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
def validation_error_handler(request: Request, error: RequestValidationError) -> JSONResponse:
    """Return validation problems as {"detail": "one readable message"}.

    FastAPI's default is a list of objects; docs/API.md promises a string, so
    the app can show it or log it without special handling.
    """
    messages = []
    for problem in error.errors():
        # loc looks like ("body", "phone") or ("query", "radius_m").
        field = ".".join(str(part) for part in problem["loc"][1:])
        messages.append(f"{field}: {problem['msg']}" if field else problem["msg"])
    return JSONResponse(status_code=422, content={"detail": "; ".join(messages)})


api = APIRouter(prefix="/api/v1")


@api.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}


api.include_router(categories.router)
api.include_router(providers.router)
api.include_router(reviews.router)
api.include_router(me.router)
api.include_router(admin.router)

app.include_router(api)
