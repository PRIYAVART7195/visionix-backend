# Visionix AI - Backend Server
# Made by Priyavart & Team for FlowZint Hackathon 2026
# Using FastAPI + Groq AI for smart farming

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
import requests
import os, base64
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Visionix AI")

# allow all origins so frontend can talk to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# setup groq client
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
WEATHER_KEY = os.getenv("WEATHER_API_KEY")

# using these two models - vision for images, text for chat
VISION_MODEL = model="meta-llama/llama-4-scout-17b-16e-instruct"
CHAT_MODEL = "llama-3.3-70b-versatile"

# language instructions - added all major indian languages
LANG_MAP = {
    "hindi":    "Respond in simple Hindi using Devanagari script.",
    "bhojpuri": "Respond in Bhojpuri language, like talking to a village elder.",
    "marathi":  "Respond in simple Marathi.",
    "telugu":   "Respond in simple Telugu.",
    "tamil":    "Respond in simple Tamil.",
    "english":  "Respond in simple English that farmers can understand.",
}

# Dr. Rajesh Kumar - our AI farming expert persona
# This prompt makes the AI give much better farming advice
EXPERT_PROMPT = """You are Dr. Rajesh Kumar, an experienced Indian agricultural scientist with 25 years of field work.

Crops you know well:
- Grains: Rice, Wheat, Maize, Sugarcane
- Vegetables: Tomato, Potato, Onion, Chilli
- Others: Cotton, Soybean, Groundnut, Banana

Indian Trees & Fruits you know:
- Mango, Guava, Papaya, Coconut, Lemon
- Pomegranate, Amla, Jackfruit, Litchi
- Neem, Tulsi, Drumstick (Moringa)

When giving treatment advice:
- Always suggest organic/natural options first (neem oil, etc)
- Then chemical options with Indian brand names (Bavistin, Dithane M-45)
- Give specific dosage per acre
- Keep language simple for rural farmers"""


# ----------- request models -----------

class ChatMsg(BaseModel):
    message: str
    language: str = "english"
    disease: str = ""
    temperature: float = 0.0
    humidity: float = 0.0
    has_rain: bool = False

class TreatmentReq(BaseModel):
    disease: str
    language: str = "english"
    temperature: float = 0.0
    humidity: float = 0.0
    has_rain: bool = False

class CopilotReq(BaseModel):
    location: str
    crop: str
    language: str = "english"
    disease: str = ""
    temperature: float = 0.0
    humidity: float = 0.0
    has_rain: bool = False
    weather_summary: str = ""


# ----------- routes -----------

@app.get("/")
def home():
    return {"status": "Visionix AI is running!", "version": "5.0"}


# weather forecast using openweathermap
@app.get("/weather/{city}")
async def get_weather(city: str):
    url = f"https://api.openweathermap.org/data/2.5/forecast?q={city}&appid={WEATHER_KEY}&units=metric"
    try:
        res = requests.get(url, timeout=10)
        data = res.json()

        if data.get("cod") != "200":
            return {"error": "City not found. Try again!"}

        has_rain = False
        grouped = {}
        from datetime import datetime

        for item in data["list"]:
            dt = datetime.fromtimestamp(item["dt"])
            day = dt.strftime("%Y-%m-%d")
            if day not in grouped:
                grouped[day] = []

            is_rain = any(w in item["weather"][0]["main"].lower() for w in ["rain", "thunder", "drizzle"])
            if is_rain:
                has_rain = True

            grouped[day].append({
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
        return {"error": f"Something went wrong: {str(e)}"}


# main disease detection using groq vision
@app.post("/detect-disease")
async def detect_disease(
    file: UploadFile = File(...),
    language: str = "english",
    temperature: float = 0.0,
    humidity: float = 0.0,
    has_rain: bool = False
):
    try:
        # read and encode image
        img_bytes = await file.read()
        img_b64 = base64.b64encode(img_bytes).decode("utf-8")
        mime = file.content_type or "image/jpeg"

        lang = LANG_MAP.get(language.lower(), LANG_MAP["english"])

        prompt = f"""{EXPERT_PROMPT}

{lang}

Look at this crop/plant image carefully and give your diagnosis.

Weather context:
- Temperature: {temperature}°C
- Humidity: {humidity}%
- Rain coming: {"Yes" if has_rain else "No"}

Please give your report in this format:

**CROP**: [what crop/plant is this]
**DISEASE NAME**: [disease name or "Healthy Plant"]
**CONFIDENCE**: [High / Medium / Low]
**SYMPTOMS**: [what you can see in the image - 2-3 lines]
**SEVERITY**: [Mild / Moderate / Severe]
**IMMEDIATE ACTION**: [what farmer should do right now]
**ORGANIC TREATMENT**: [neem oil etc with dosage]
**CHEMICAL TREATMENT**: [Indian brand name + how much to use]
**WEATHER ADVICE**: [advice based on current weather]
**PREVENTION**: [how to avoid this next time - 2 tips]"""

        response = groq_client.chat.completions.create(
            model=VISION_MODEL,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{img_b64}"}}
                ]
            }],
            temperature=0.3,
            max_tokens=800
        )

        result = response.choices[0].message.content.strip()

        # extract disease name from response
        disease = "Unknown"
        for line in result.split('\n'):
            if "disease name" in line.lower():
                parts = line.split(":", 1)
                if len(parts) > 1:
                    disease = parts[1].strip().replace("**", "").strip()
                    break

        return {
            "success": True,
            "disease": disease,
            "full_analysis": result,
            "language": language
        }

    except Exception as e:
        return {"success": False, "error": str(e), "disease": "Detection failed"}


# mandi price - tries govt api first, then groq as backup
@app.get("/mandi/{crop}")
async def get_mandi(crop: str, state: str = "Bihar"):
    # try official data.gov.in api
    try:
        url = f"https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=579b464db66ec23bdd000001cdd3946e44ce4aab825ef8579006697&format=json&filters%5Bcommodity%5D={crop}&filters%5Bstate%5D={state}&limit=5"
        res = requests.get(url, timeout=8)
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
    except:
        pass  # if govt api fails, use groq

    # groq fallback for price estimate
    try:
        resp = groq_client.chat.completions.create(
            model=CHAT_MODEL,
            messages=[{"role": "user", "content": f"What is the current approximate mandi price of {crop} in {state}, India? Give price in Rs per quintal. Keep it short - one line only."}],
            temperature=0.3,
            max_tokens=100
        )
        return {
            "crop": crop,
            "state": state,
            "prices": [],
            "gemini_estimate": resp.choices[0].message.content
        }
    except Exception as e:
        return {"error": str(e)}


# chatbot - disease aware and multilingual
@app.post("/chat")
async def chat(req: ChatMsg):
    lang = LANG_MAP.get(req.language.lower(), LANG_MAP["english"])

    # add context if we know the disease
    farm_context = ""
    if req.disease:
        farm_context = f"\nCurrent situation: Disease = {req.disease}, Temp = {req.temperature}°C, Humidity = {req.humidity}%, Rain = {'Yes' if req.has_rain else 'No'}"

    prompt = f"""{EXPERT_PROMPT}

{lang}
{farm_context}

Farmer's question: {req.message}

Give practical advice in 3-5 bullet points. Use simple language. Include specific product names and amounts where relevant."""

    try:
        resp = groq_client.chat.completions.create(
            model=CHAT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=500
        )
        return {"reply": resp.choices[0].message.content, "language": req.language}
    except Exception as e:
        return {"error": str(e), "reply": "Sorry, something went wrong. Please try again."}


# treatment advice endpoint
@app.post("/treatment")
async def get_treatment(req: TreatmentReq):
    lang = LANG_MAP.get(req.language.lower(), LANG_MAP["english"])

    prompt = f"""{EXPERT_PROMPT}
{lang}

Disease found: {req.disease}
Weather: Temp={req.temperature}°C, Humidity={req.humidity}%, Rain={'expected' if req.has_rain else 'not expected'}

Give a short treatment plan with Indian product names and dosages. Max 6 bullet points."""

    try:
        resp = groq_client.chat.completions.create(
            model=CHAT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=350
        )
        return {"treatment": resp.choices[0].message.content, "disease": req.disease}
    except Exception as e:
        return {"error": str(e)}


# SMART FARM COPILOT - our main feature
# combines disease detection + weather + soil + mandi + 7 day plan
@app.post("/copilot")
async def farm_copilot(req: CopilotReq):
    lang = LANG_MAP.get(req.language.lower(), LANG_MAP["english"])

    prompt = f"""{EXPERT_PROMPT}

{lang}

Generate a complete farm report for this farmer:

Location: {req.location}
Crop: {req.crop}
Disease Found: {req.disease or "None / Healthy"}
Temperature: {req.temperature}°C
Humidity: {req.humidity}%
Rain Expected: {"Yes" if req.has_rain else "No"}
Weather Info: {req.weather_summary or "Not available"}

Write the report in this format:

## 🌾 VISIONIX SMART FARM REPORT
**Location:** {req.location}
**Crop:** {req.crop}
**Date:** Today

---

## 🦠 DISEASE STATUS
[Write disease name and how bad it is, or say "Healthy" if no disease]
**Confidence:** [High/Medium/Low]
**Needs Immediate Action:** [Yes/No]

---

## 🌦️ WEATHER IMPACT
**Now:** {req.temperature}°C, {req.humidity}% humidity
**Rain:** {"⚠️ Coming soon - be careful" if req.has_rain else "☀️ Clear sky"}
**Effect on crop:** [How this weather affects {req.crop} right now]

---

## 🎯 SOIL HEALTH ESTIMATE
**pH level:** [estimate]
**Nitrogen:** [Low/OK/High]
**Phosphorus:** [Low/OK/High]  
**Potassium:** [Low/OK/High]
**Score:** [X out of 10]
**What to do:** [specific advice for {req.crop} in {req.location}]

---

## 💧 IRRIGATION PLAN
**Water next:** [exact day and time, e.g. "Tomorrow 6 AM"]
**How much:** [liters per acre]
**Method:** [Drip/Flood/Sprinkler]
**Why:** [reason based on weather and disease]

---

## 💊 TREATMENT PLAN
{"**For the disease:**" if req.disease and "healthy" not in req.disease.lower() else "**Preventive care:**"}
1. [step 1 with Indian product + amount]
2. [step 2]

**Fertilizer to use:**
- [name] - [amount per acre] - [when]

**Pesticide if needed:**
- [Indian brand name + dosage]

---

## 💰 MARKET ADVICE
**Price estimate:** ₹[range] per quintal for {req.crop}
**Price trend:** [Going up/down/stable]
**Good markets near {req.location}:** [2-3 market names]
**Should you sell?**
[🟢 SELL NOW / 🔴 WAIT / 🟡 SELL HALF]
**Because:** [simple reason]

---

## 📅 7-DAY PLAN
| Day | What to do | When | How urgent |
|-----|-----------|------|------------|
| Day 1 | [task] | [time] | [🔴 High/🟡 Medium/🟢 Low] |
| Day 2 | [task] | [time] | [priority] |
| Day 3 | [task] | [time] | [priority] |
| Day 4 | [task] | [time] | [priority] |
| Day 5 | [task] | [time] | [priority] |
| Day 6 | [task] | [time] | [priority] |
| Day 7 | [task] | [time] | [priority] |

---

## ⚠️ URGENT ALERTS
[Any warnings farmer needs to know RIGHT NOW]

---

## 💡 EXPERT TIPS
[2-3 practical tips for {req.crop} this season in {req.location}]

Keep everything specific and practical. Use simple words."""

    try:
        resp = groq_client.chat.completions.create(
            model=CHAT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=2000
        )
        return {
            "success": True,
            "report": resp.choices[0].message.content,
            "crop": req.crop,
            "location": req.location
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


# run server
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)