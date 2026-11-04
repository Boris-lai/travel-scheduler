from fastapi import FastAPI
from router import destinations, itinerary, search, trips

app = FastAPI()

app.include_router(destinations.router)
app.include_router(search.router)
app.include_router(trips.router)
app.include_router(itinerary.router)


@app.get("/health")
def health():
    return {"status": "ok"}
