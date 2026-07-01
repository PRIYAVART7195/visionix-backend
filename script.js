/* ============================================================
   VISIONIX AI - UPGRADED SCRIPT v2.0
   Backend Connected: FastAPI on localhost:8000
   Features: Multilingual Chatbot, Mandi Price, Disease Detection
   ============================================================ */

const BACKEND = "http://localhost:8000";
const TM_MODEL_URL = "https://teachablemachine.withgoogle.com/models/67Vf2YTSL/";

let tmModel;
let currentLang = "english";
let currentDisease = "";
let currentTemp = 0;
let currentHumidity = 0;
let hasRainForecast = false;
let detectionHistory = JSON.parse(localStorage.getItem("visionix_history") || "[]");

/* ============================================================
   TRANSLATIONS
   ============================================================ */
const T = {
  english: {
    headerSub: "AI-Based Smart Resource Allocation for Farmers",
    weatherTitle: "Weather Prediction", weatherBtn: "Check Weather",
    detectTitle: "Crop Disease Detection", uploadText: "Click to upload crop photo",
    analyzeBtn: "🔍 Analyze Crop", recommendTitle: "Smart Recommendation",
    mandiTitle: "Mandi Price", mandiBtn: "Get Price",
    chatTitle: "AI Farmer Assistant", chatSub: "Upload a crop photo first, then ask me anything!",
    chatPlaceholder: "Ask about your crop...", sendBtn: "Send",
    historyTitle: "Detection History", welcomeMsg: "Namaste! I'm Visionix AI. Upload a crop photo and ask me about diseases, treatment, irrigation, or mandi prices!",
    emptyHistory: "No detections yet. Analyze a crop to see history.",
    cityPlaceholder: "Enter your city name", cropPlaceholder: "Crop name (e.g. Wheat, Rice)", statePlaceholder: "State (e.g. Bihar)"
  },
  hindi: {
    headerSub: "किसानों के लिए AI-आधारित स्मार्ट संसाधन प्रणाली",
    weatherTitle: "मौसम पूर्वानुमान", weatherBtn: "मौसम देखें",
    detectTitle: "फसल रोग पहचान", uploadText: "फसल की फोटो अपलोड करें",
    analyzeBtn: "🔍 फसल जांचें", recommendTitle: "स्मार्ट सुझाव",
    mandiTitle: "मंडी भाव", mandiBtn: "भाव देखें",
    chatTitle: "AI किसान सहायक", chatSub: "पहले फोटो अपलोड करें, फिर कुछ भी पूछें!",
    chatPlaceholder: "अपनी फसल के बारे में पूछें...", sendBtn: "भेजें",
    historyTitle: "जांच इतिहास", welcomeMsg: "नमस्ते! मैं विज़निक्स AI हूं। फसल की फोटो अपलोड करें और रोग, उपचार, सिंचाई या मंडी भाव के बारे में पूछें!",
    emptyHistory: "अभी तक कोई जांच नहीं।",
    cityPlaceholder: "अपना शहर दर्ज करें", cropPlaceholder: "फसल का नाम (जैसे गेहूं, चावल)", statePlaceholder: "राज्य (जैसे बिहार)"
  },
  bhojpuri: {
    headerSub: "किसान भाइयन खातिर AI स्मार्ट सिस्टम",
    weatherTitle: "मौसम अनुमान", weatherBtn: "मौसम देखीं",
    detectTitle: "फसल रोग पहचान", uploadText: "फसल के फोटो डालीं",
    analyzeBtn: "🔍 फसल जांचीं", recommendTitle: "सुझाव",
    mandiTitle: "मंडी भाव", mandiBtn: "भाव देखीं",
    chatTitle: "AI किसान सहायक", chatSub: "पहिले फोटो डालीं, फिर कुछ भी पूछीं!",
    chatPlaceholder: "अपना फसल के बारे में पूछीं...", sendBtn: "भेजीं",
    historyTitle: "जांच इतिहास", welcomeMsg: "प्रणाम! हम विज़निक्स AI हईं। फसल के फोटो डालीं आ रोग, इलाज, पानी या मंडी भाव के बारे में पूछीं!",
    emptyHistory: "अभी तक कौनो जांच नइखे।",
    cityPlaceholder: "अपना शहर लिखीं", cropPlaceholder: "फसल के नाम", statePlaceholder: "राज्य लिखीं"
  },
  marathi: {
    headerSub: "शेतकऱ्यांसाठी AI-आधारित स्मार्ट प्रणाली",
    weatherTitle: "हवामान अंदाज", weatherBtn: "हवामान पहा",
    detectTitle: "पीक रोग ओळख", uploadText: "पिकाचा फोटो अपलोड करा",
    analyzeBtn: "🔍 पीक तपासा", recommendTitle: "स्मार्ट सूचना",
    mandiTitle: "बाजार भाव", mandiBtn: "भाव पहा",
    chatTitle: "AI शेतकरी सहाय्यक", chatSub: "आधी फोटो अपलोड करा, मग काहीही विचारा!",
    chatPlaceholder: "तुमच्या पिकाबद्दल विचारा...", sendBtn: "पाठवा",
    historyTitle: "तपासणी इतिहास", welcomeMsg: "नमस्कार! मी विझनिक्स AI आहे. पिकाचा फोटो अपलोड करा आणि रोग, उपचार, सिंचन किंवा बाजारभावाबद्दल विचारा!",
    emptyHistory: "अद्याप कोणतीही तपासणी नाही.",
    cityPlaceholder: "तुमचे शहर प्रविष्ट करा", cropPlaceholder: "पिकाचे नाव", statePlaceholder: "राज्य"
  },
  telugu: {
    headerSub: "రైతులకు AI-ఆధారిత స్మార్ట్ వ్యవస్థ",
    weatherTitle: "వాతావరణ అంచనా", weatherBtn: "వాతావరణం చూడండి",
    detectTitle: "పంట వ్యాధి గుర్తింపు", uploadText: "పంట ఫోటో అప్లోడ్ చేయండి",
    analyzeBtn: "🔍 పంట విశ్లేషించండి", recommendTitle: "స్మార్ట్ సిఫార్సు",
    mandiTitle: "మండి ధర", mandiBtn: "ధర చూడండి",
    chatTitle: "AI రైతు సహాయకుడు", chatSub: "ముందుగా ఫోటో అప్లోడ్ చేయండి, ఆపై ఏదైనా అడగండి!",
    chatPlaceholder: "మీ పంట గురించి అడగండి...", sendBtn: "పంపండి",
    historyTitle: "గుర్తింపు చరిత్ర", welcomeMsg: "నమస్కారం! నేను విజనిక్స్ AI. పంట ఫోటో అప్లోడ్ చేసి వ్యాధులు, చికిత్స, నీటిపారుదల లేదా మండి ధరల గురించి అడగండి!",
    emptyHistory: "ఇంకా గుర్తింపు లేదు.",
    cityPlaceholder: "మీ నగరం నమోదు చేయండి", cropPlaceholder: "పంట పేరు", statePlaceholder: "రాష్ట్రం"
  },
  tamil: {
    headerSub: "விவசாயிகளுக்கான AI அடிப்படையிலான அமைப்பு",
    weatherTitle: "வானிலை கணிப்பு", weatherBtn: "வானிலை பாருங்கள்",
    detectTitle: "பயிர் நோய் கண்டறிதல்", uploadText: "பயிரின் புகைப்படம் பதிவேற்றவும்",
    analyzeBtn: "🔍 பயிரை ஆய்வு செய்யவும்", recommendTitle: "புத்திசாலி பரிந்துரை",
    mandiTitle: "சந்தை விலை", mandiBtn: "விலை பாருங்கள்",
    chatTitle: "AI விவசாய உதவியாளர்", chatSub: "முதலில் புகைப்படம் பதிவேற்றவும், பின்னர் கேளுங்கள்!",
    chatPlaceholder: "உங்கள் பயிரைப் பற்றி கேளுங்கள்...", sendBtn: "அனுப்பு",
    historyTitle: "கண்டறிதல் வரலாறு", welcomeMsg: "வணக்கம்! நான் விஷனிக்ஸ் AI. பயிர் புகைப்படம் பதிவேற்றி நோய்கள், சிகிச்சை, நீர்ப்பாசனம் அல்லது சந்தை விலை பற்றி கேளுங்கள்!",
    emptyHistory: "இன்னும் கண்டறிதல் இல்லை.",
    cityPlaceholder: "உங்கள் நகரை உள்ளிடவும்", cropPlaceholder: "பயிர் பெயர்", statePlaceholder: "மாநிலம்"
  }
};

/* ============================================================
   LANGUAGE SETUP
   ============================================================ */
function setLang(lang) {
  currentLang = lang;
  document.querySelectorAll(".lang-btn").forEach(b => b.classList.remove("active"));
  event.target.classList.add("active");

  const t = T[lang];
  document.getElementById("headerSub").textContent = t.headerSub;
  document.getElementById("weatherTitle").textContent = t.weatherTitle;
  document.getElementById("detectTitle").textContent = t.detectTitle;
  document.getElementById("uploadText").textContent = t.uploadText;
  document.getElementById("recommendTitle").textContent = t.recommendTitle;
  document.getElementById("mandiTitle").textContent = t.mandiTitle;
  document.getElementById("chatTitle").textContent = t.chatTitle;
  document.getElementById("chatSub").textContent = t.chatSub;
  document.getElementById("chatInput").placeholder = t.chatPlaceholder;
  document.getElementById("historyTitle").textContent = t.historyTitle;
  document.getElementById("welcomeMsg").textContent = t.welcomeMsg;
  document.getElementById("city").placeholder = t.cityPlaceholder;
  document.getElementById("cropName").placeholder = t.cropPlaceholder;
  document.getElementById("stateName").placeholder = t.statePlaceholder;
}

/* ============================================================
   BACKEND STATUS CHECK
   ============================================================ */
async function checkBackend() {
  try {
    const res = await fetch(`${BACKEND}/`);
    const data = await res.json();
    if (data.status) {
      document.getElementById("backendStatus").textContent = "✅ Backend Connected";
      document.getElementById("backendStatus").className = "status-dot ready";
    }
  } catch {
    document.getElementById("backendStatus").textContent = "❌ Backend Offline";
    document.getElementById("backendStatus").className = "status-dot error";
  }
}

/* ============================================================
   LOAD TEACHABLE MACHINE MODEL
   ============================================================ */
async function loadModel() {
  try {
    tmModel = await tmImage.load(TM_MODEL_URL + "model.json", TM_MODEL_URL + "metadata.json");
    document.getElementById("modelStatus").textContent = "✅ AI Model Ready";
    document.getElementById("modelStatus").className = "status-dot ready";
  } catch {
    document.getElementById("modelStatus").textContent = "❌ Model Load Failed";
    document.getElementById("modelStatus").className = "status-dot error";
  }
}

/* ============================================================
   WEATHER — via Backend
   ============================================================ */
async function getWeather() {
  const city = document.getElementById("city").value.trim();
  if (!city) { alert("Please enter city name"); return; }

  const resultEl = document.getElementById("weatherResult");
  resultEl.innerHTML = "⏳ Loading weather...";

  try {
    const res = await fetch(`${BACKEND}/weather/${encodeURIComponent(city)}`);
    const data = await res.json();

    if (data.error) { resultEl.innerHTML = "❌ City not found"; return; }

    currentTemp = data.current_temp;
    currentHumidity = data.current_humidity;
    hasRainForecast = data.has_rain_forecast;

    let html = `<strong>🌦️ 5-Day Forecast — ${data.city}</strong><br><br>`;
    for (const [date, slots] of Object.entries(data.forecast)) {
      const dayName = new Date(date).toLocaleDateString("en-US", { weekday: "short" });
      html += `<strong>${dayName} (${date})</strong><br>`;
      slots.forEach(s => {
        html += `• ${s.time} → 🌡 ${s.temp}°C | ${s.weather} | 💧 ${s.humidity}%${s.rain ? " 🌧 Rain" : ""}<br>`;
      });
      html += "<br>";
    }
    if (hasRainForecast) html += "⚠️ Rain predicted → Reduce irrigation on rainy days<br>";
    resultEl.innerHTML = html;
    generateRecommendation();
  } catch {
    resultEl.innerHTML = "❌ Error fetching weather. Is backend running?";
  }
}

/* ============================================================
   IMAGE PREVIEW
   ============================================================ */
document.getElementById("imageUpload").addEventListener("change", function () {
  const file = this.files[0];
  if (!file) return;
  const preview = document.getElementById("preview");
  preview.src = URL.createObjectURL(file);
  preview.style.display = "block";
  document.getElementById("uploadText").textContent = file.name;
});

/* ============================================================
   DISEASE DETECTION — Teachable Machine
   ============================================================ */
async function detectDisease() {
  const file = document.getElementById("imageUpload").files[0];
  if (!file) { alert("Please upload a crop image first"); return; }

  const resultEl = document.getElementById("diseaseResult");
  if (!tmModel) { resultEl.innerHTML = "⏳ Model still loading..."; return; }

  resultEl.innerHTML = "⏳ Analyzing crop...";

  const img = document.createElement("img");
  img.src = URL.createObjectURL(file);

  img.onload = async () => {
    const predictions = await tmModel.predict(img);
    const best = predictions.reduce((a, b) => a.probability > b.probability ? a : b);
    currentDisease = best.className;

    if (best.probability < 0.6) {
      resultEl.innerHTML = "⚠️ Try a clearer image";
    } else if (best.className.toLowerCase().includes("healthy")) {
      resultEl.innerHTML = "🌿 Healthy Plant ✅";
      addChatMessage(`Great news! Your crop looks healthy 🌿. ${currentTemp > 0 ? `Current temp is ${currentTemp}°C.` : ""} Do you want tips to keep it healthy?`, false);
    } else {
      resultEl.innerHTML = `🦠 Disease Detected: <strong>${best.className}</strong> (${Math.round(best.probability * 100)}% confidence)`;
      addChatMessage(`I detected <strong>${best.className}</strong> in your crop! Would you like to know the treatment? Just ask me! 💊`, false);
    }

    saveHistory(best.className, best.probability);
    generateRecommendation();
  };
}

/* ============================================================
   RECOMMENDATION — via Backend
   ============================================================ */
async function generateRecommendation() {
  let suggestion = "";

  if (currentTemp > 35) suggestion += "💧 Increase irrigation (high temperature)<br>";
  else if (currentTemp > 0) suggestion += "💧 Normal irrigation recommended<br>";
  if (currentHumidity > 80) suggestion += "⚠️ High humidity — disease risk elevated<br>";
  if (hasRainForecast) suggestion += "🌧 Rain forecast → Reduce irrigation on rainy days<br>";

  if (currentDisease && !currentDisease.toLowerCase().includes("healthy")) {
    suggestion += `💊 Treatment needed for: <strong>${currentDisease}</strong><br>`;
    document.getElementById("recommendation").innerHTML = suggestion + "<br>⏳ Getting AI treatment advice...";

    try {
      const res = await fetch(`${BACKEND}/treatment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disease: currentDisease,
          language: currentLang,
          temperature: currentTemp,
          humidity: currentHumidity,
          has_rain: hasRainForecast
        })
      });
      const data = await res.json();
      suggestion += `<br><strong>🤖 AI Advice:</strong><br>${data.treatment.replace(/\n/g, "<br>")}`;
    } catch {
      suggestion += "<br>⚠️ Could not get AI advice (backend offline?)";
    }
  } else if (currentDisease) {
    suggestion += "🌿 Crop is healthy — keep monitoring!<br>";
  }

  document.getElementById("recommendation").innerHTML = suggestion || "Run weather check and crop analysis to see recommendations.";
}

/* ============================================================
   MANDI PRICE — via Backend
   ============================================================ */
async function getMandiPrice() {
  const crop = document.getElementById("cropName").value.trim();
  const state = document.getElementById("stateName").value.trim() || "Bihar";
  if (!crop) { alert("Enter crop name"); return; }

  const resultEl = document.getElementById("mandiResult");
  resultEl.innerHTML = "⏳ Fetching mandi prices...";

  try {
    const res = await fetch(`${BACKEND}/mandi/${encodeURIComponent(crop)}?state=${encodeURIComponent(state)}`);
    const data = await res.json();

    if (data.error) { resultEl.innerHTML = "❌ Error: " + data.error; return; }

    if (data.prices && data.prices.length > 0) {
      let html = `<strong>💰 Mandi Prices — ${crop} in ${state}</strong><br><br>`;
      data.prices.forEach(p => {
        html += `📍 <strong>${p.market}</strong><br>`;
        html += `• Min: ₹${p.min_price} | Max: ₹${p.max_price} | Modal: ₹${p.modal_price}<br>`;
        html += `• Date: ${p.date}<br><br>`;
      });
      resultEl.innerHTML = html;
    } else if (data.gemini_estimate) {
      resultEl.innerHTML = `<strong>💰 AI Price Estimate for ${crop}:</strong><br>${data.gemini_estimate}`;
    } else {
      resultEl.innerHTML = "No price data found for this crop/state.";
    }
  } catch {
    resultEl.innerHTML = "❌ Could not fetch prices. Is backend running?";
  }
}

/* ============================================================
   CHATBOT — Disease Aware + Multilingual via Backend
   ============================================================ */
function addChatMessage(text, isUser = false) {
  const chatBox = document.getElementById("chatBox");
  const msgDiv = document.createElement("div");
  msgDiv.className = `chat-msg ${isUser ? "user" : "bot"}`;

  const avatar = document.createElement("span");
  avatar.className = "chat-avatar";
  avatar.textContent = isUser ? "👨‍🌾" : "🌾";

  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";
  bubble.innerHTML = text.replace(/\n/g, "<br>").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  msgDiv.appendChild(avatar);
  msgDiv.appendChild(bubble);
  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function addTypingIndicator() {
  const chatBox = document.getElementById("chatBox");
  const div = document.createElement("div");
  div.className = "chat-msg bot";
  div.id = "typingIndicator";
  div.innerHTML = `<span class="chat-avatar">🌾</span><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function removeTypingIndicator() {
  const el = document.getElementById("typingIndicator");
  if (el) el.remove();
}

async function sendChat() {
  const input = document.getElementById("chatInput");
  const msg = input.value.trim();
  if (!msg) return;

  addChatMessage(msg, true);
  input.value = "";
  addTypingIndicator();

  try {
    const res = await fetch(`${BACKEND}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: msg,
        language: currentLang,
        disease: currentDisease,
        temperature: currentTemp,
        humidity: currentHumidity,
        has_rain: hasRainForecast
      })
    });
    const data = await res.json();
    removeTypingIndicator();
    addChatMessage(data.reply || "Sorry, could not get response.", false);
  } catch {
    removeTypingIndicator();
    addChatMessage("❌ Backend offline. Please start the server.", false);
  }
}

function quickAsk(msg) {
  document.getElementById("chatInput").value = msg;
  sendChat();
}

document.getElementById("chatInput").addEventListener("keypress", e => {
  if (e.key === "Enter") sendChat();
});

/* ============================================================
   VOICE INPUT
   ============================================================ */
function startVoice() {
  if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
    alert("Voice input not supported. Please use Chrome browser.");
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SR();
  const langMap = { english: "en-IN", hindi: "hi-IN", bhojpuri: "hi-IN", marathi: "mr-IN", telugu: "te-IN", tamil: "ta-IN" };
  recognition.lang = langMap[currentLang] || "hi-IN";
  recognition.interimResults = false;

  const btn = document.getElementById("voiceBtn");
  btn.classList.add("listening");
  btn.textContent = "🔴";
  recognition.start();

  recognition.onresult = e => {
    document.getElementById("chatInput").value = e.results[0][0].transcript;
    btn.classList.remove("listening");
    btn.textContent = "🎤";
    sendChat();
  };
  recognition.onerror = recognition.onend = () => {
    btn.classList.remove("listening");
    btn.textContent = "🎤";
  };
}

/* ============================================================
   HISTORY LOG
   ============================================================ */
function saveHistory(disease, probability) {
  const entry = {
    disease,
    confidence: Math.round(probability * 100),
    healthy: disease.toLowerCase().includes("healthy"),
    time: new Date().toLocaleString("en-IN", { hour12: true, hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })
  };
  detectionHistory.unshift(entry);
  if (detectionHistory.length > 20) detectionHistory = detectionHistory.slice(0, 20);
  localStorage.setItem("visionix_history", JSON.stringify(detectionHistory));
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById("historyList");
  if (!detectionHistory.length) {
    list.innerHTML = `<p class="empty-history">No detections yet.</p>`;
    return;
  }
  list.innerHTML = detectionHistory.map(e => `
    <div class="history-item">
      <div>
        <span class="disease-tag ${e.healthy ? 'healthy' : ''}">${e.healthy ? "🌿" : "🦠"} ${e.disease}</span>
        <span style="color:var(--text-dim);font-size:12px;margin-left:8px">${e.confidence}% confidence</span>
      </div>
      <span class="time-tag">🕐 ${e.time}</span>
    </div>`).join("");
}

function clearHistory() {
  detectionHistory = [];
  localStorage.removeItem("visionix_history");
  renderHistory();
}

/* ============================================================
   INIT
   ============================================================ */
window.onload = () => {
  loadModel();
  checkBackend();
  renderHistory();
};