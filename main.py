from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
import requests
import os, base64
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Visionix AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
WEATHER_API_KEY = os.getenv("WEATHER_API_KEY")

VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
TEXT_MODEL = "llama-3.3-70b-versatile"

LANG_INSTRUCTIONS = {
    "hindi":    "Respond in simple Hindi (Devanagari script).",
    "bhojpuri": "Respond in Bhojpuri language.",
    "marathi":  "Respond in simple Marathi.",
    "telugu":   "Respond in simple Telugu.",
    "tamil":    "Respond in simple Tamil.",
    "english":  "Respond in simple English.",
}

# ============================================================
# MODELS
# ============================================================
class ChatRequest(BaseModel):
    message: str
    language: str = "english"
    disease: str = ""
    temperature: float = 0.0
    humidity: float = 0.0
    has_rain: bool = False

class TreatmentRequest(BaseModel):
    disease: str
    language: str = "english"
    temperature: float = 0.0
    humidity: float = 0.0
    has_rain: bool = False

# ============================================================
# ROOT
# ============================================================
@app.get("/")
def root():
    return {"status": "Visionix AI Backend Running!", "version": "4.0 - Groq Powered"}

# ============================================================
# WEATHER
# ============================================================
@app.get("/weather/{city}")
async def get_weather(city: str):
    url = f"https://api.openweathermap.org/data/2.5/forecast?q={city}&appid={WEATHER_API_KEY}&units=metric"
    try:
        res = requests.get(url, timeout=10)
        data = res.json()
        if data.get("cod") != "200":
            return {"error": "City not found"}

        has_rain = False
        grouped = {}
        from datetime import datetime

        for item in data["list"]:
            dt = datetime.fromtimestamp(item["dt"])
            date_key = dt.strftime("%Y-%m-%d")
            if date_key not in grouped:
                grouped[date_key] = []
            is_rain = "rain" in item["weather"][0]["main"].lower() or "thunder" in item["weather"][0]["main"].lower()
            if is_rain:
                has_rain = True
            grouped[date_key].append({
                "time": dt.strftime("%H:%M"),
                "temp": round(item["main"]["temp"]),
                "weather": item["weather"][0]["main"],
                "humidity": item["main"]["humidity"],
                "rain": is_rain
            })

        current = data["list"][0]
        return {
            "current_temp": round(current["main"]["temp"]),
            "current_humidity": current["main"]["humidity"],
            "has_rain_forecast": has_rain,
            "forecast": grouped,
            "city": city
        }
    except Exception as e:
        return {"error": str(e)}

# ============================================================
# 🌟 GROQ VISION — AI DISEASE DETECTION
# ============================================================
@app.post("/detect-disease")
async def detect_disease(
    file: UploadFile = File(...),
    language: str = "english",
    temperature: float = 0.0,
    humidity: float = 0.0,
    has_rain: bool = False
):
    try:
        image_bytes = await file.read()
        image_base64 = base64.b64encode(image_bytes).decode("utf-8")
        mime_type = file.content_type or "image/jpeg"

        lang_instruction = LANG_INSTRUCTIONS.get(language.lower(), LANG_INSTRUCTIONS["english"])

        prompt = f"""You are an expert Indian agricultural scientist and plant pathologist.
{lang_instruction}

Analyze this crop/plant image carefully and provide:

1. **Disease Name**: (or "Healthy" if no disease found)
2. **Confidence**: (High/Medium/Low)
3. **Affected Part**: (Leaves/Stem/Fruit/Root)
4. **Symptoms Observed**: (2-3 lines)
5. **Immediate Treatment**: 
   - Natural remedy
   - Chemical option if needed
6. **Irrigation Advice**: Based on Temp={temperature}°C, Humidity={humidity}%, Rain={'Yes' if has_rain else 'No'}
7. **Prevention Tips**: (2 points)

Be specific, practical, and helpful for Indian farmers.
Format your response clearly with these exact headings."""

        completion = client.chat.completions.create(
            model=VISION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{image_base64}"
                            }
                        }
                    ]
                }
            ],
            temperature=0.4,
            max_tokens=1024
        )

        result_text = completion.choices[0].message.content.strip()

        disease_name = "Unknown"
        lines = result_text.split('\n')
        for line in lines:
            if "disease name" in line.lower():
                parts = line.split(":", 1)
                if len(parts) > 1:
                    disease_name = parts[1].strip().replace("**", "").strip()
                    break

        return {
            "success": True,
            "disease": disease_name,
            "full_analysis": result_text,
            "language": language
        }

    except Exception as e:
        return {"success": False, "error": str(e), "disease": "Detection failed"}

# ============================================================
# MANDI PRICE
# ============================================================
@app.get("/mandi/{crop}")
async def get_mandi_price(crop: str, state: str = "Bihar"):
    try:
        url = f"https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=579b464db66ec23bdd000001cdd3946e44ce4aab825ef8579006697&format=json&filters%5Bcommodity%5D={crop}&filters%5Bstate%5D={state}&limit=5"
        res = requests.get(url, timeout=20)
        data = res.json()

        if data.get("records"):
            prices = []
            for r in data["records"][:3]:
                prices.append({
                    "market": r.get("market", "N/A"),
                    "min_price": r.get("min_price", "N/A"),
                    "max_price": r.get("max_price", "N/A"),
                    "modal_price": r.get("modal_price", "N/A"),
                    "date": r.get("arrival_date", "N/A")
                })
            return {"crop": crop, "state": state, "prices": prices}
        else:
            completion = client.chat.completions.create(
                model=TEXT_MODEL,
                messages=[{"role": "user", "content": f"Current approximate mandi price of {crop} in {state}, India? Give price in Rs per quintal. One line only."}],
                temperature=0.3,
                max_tokens=100
            )
            return {"crop": crop, "state": state, "prices": [], "gemini_estimate": completion.choices[0].message.content}

    except Exception as e:
        try:
            completion = client.chat.completions.create(
                model=TEXT_MODEL,
                messages=[{"role": "user", "content": f"Current approximate mandi price of {crop} in {state}, India? Give price in Rs per quintal. One line only."}],
                temperature=0.3,
                max_tokens=100
            )
            return {"crop": crop, "state": state, "prices": [], "gemini_estimate": completion.choices[0].message.content}
        except Exception as e2:
            return {"error": str(e2)}

# ============================================================
# AI CHATBOT
# ============================================================
@app.post("/chat")
async def chat(req: ChatRequest):
    lang_instruction = LANG_INSTRUCTIONS.get(req.language.lower(), LANG_INSTRUCTIONS["english"])
    context = f"\nFarm context: Disease={req.disease or 'None'}, Temp={req.temperature}°C, Humidity={req.humidity}%, Rain={'Yes' if req.has_rain else 'No'}" if req.disease else ""

    prompt = f"""You are Visionix AI, a helpful agricultural assistant for Indian farmers.
{lang_instruction}
{context}

Farmer's question: {req.message}

Give practical, actionable advice in 3-5 bullet points.
Be concise, warm, and use simple language a rural farmer can understand.
If disease context is available, make your answer specific to that disease."""

    try:
        completion = client.chat.completions.create(
            model=TEXT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
            max_tokens=512
        )
        return {"reply": completion.choices[0].message.content, "language": req.language}
    except Exception as e:
        return {"error": str(e), "reply": "Sorry, could not get response."}

# ============================================================
# TREATMENT ADVICE
# ============================================================
@app.post("/treatment")
async def get_treatment(req: TreatmentRequest):
    lang_instruction = LANG_INSTRUCTIONS.get(req.language.lower(), LANG_INSTRUCTIONS["english"])
    prompt = f"""You are a helpful Indian agricultural expert.
{lang_instruction}
Disease: {req.disease}, Temp: {req.temperature}°C, Humidity: {req.humidity}%, Rain: {'Yes' if req.has_rain else 'No'}
Provide short practical treatment in bullet points under 6 lines."""
    try:
        completion = client.chat.completions.create(
            model=TEXT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=300
        )
        return {"treatment": completion.choices[0].message.content, "disease": req.disease}
    except Exception as e:
        return {"error": str(e)}

# ============================================================
# RUN
# ============================================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)