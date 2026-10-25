from fastapi import FastAPI
from router import destinations, search

app = FastAPI()

app.include_router(destinations.router)
app.include_router(search.router)


@app.get("/health")
def health():
    return {"status": "ok"}
