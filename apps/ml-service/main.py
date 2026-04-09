from fastapi import FastAPI

app = FastAPI(title='Amdox AI ML Service')

@app.get('/')
def read_root():
    return {'status': 'healthy', 'service': 'ml-service'}