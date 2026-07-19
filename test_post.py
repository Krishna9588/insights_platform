from fastapi.testclient import TestClient
from backend.app import app

client = TestClient(app)
response = client.post("/news/monitors", json={"name":"SEBI Test","query":"Test SEBI news","sources":["news"]})
print(response.status_code)
print(response.json())
