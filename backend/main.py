from fastapi import FastAPI
from router import destinations, itinerary, legs, search, trips, places

app = FastAPI()

app.include_router(destinations.router)
app.include_router(search.router)
app.include_router(trips.router)
app.include_router(itinerary.router)
app.include_router(places.router)
app.include_router(legs.router)


@app.get("/health")
def health():
    return {"status": "ok"}
