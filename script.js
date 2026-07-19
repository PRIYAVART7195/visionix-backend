

const BACKEND = "https://visionix-backend.onrender.com";
let currentLang = "english", currentDisease = "";
let currentTemp = 0, currentHumidity = 0, hasRainForecast = false;
let detectionHistory = JSON.parse(localStorage.getItem("visionix_history") || "[]");
let cameraStream = null;
let priceChart = null;
let lastAnalysisText = "";
let floatingChatOpen = false;


function switchTab(name, el) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  if (el) el.classList.add("active");
  else document.querySelector(`[onclick*="'${name}'"]`)?.classList.add("active");
  document.getElementById("tab-" + name).classList.add("active");
  if (name === "history") renderHistory();
  if (name === "dashboard") updateDashboard();
  if (name === "kisanbot") initKisanBot();
}

const T = {
  english: { headerSub: "AI-Based Smart Resource Allocation for Farmers", weatherTitle: "Weather Prediction", detectTitle: "Crop Disease Detection", chatPH: "Ask about your crop...", mandiTitle: "Mandi Price", footerText: "Empowering Indian Farmers with AI", floatPH: "Ask anything..." },
  hindi: { headerSub: "किसानों के लिए AI स्मार्ट प्रणाली", weatherTitle: "मौसम पूर्वानुमान", detectTitle: "फसल रोग पहचान", chatPH: "फसल के बारे में पूछें...", mandiTitle: "मंडी भाव", footerText: "AI से किसानों को सशक्त बनाना", floatPH: "कुछ भी पूछें..." },
  bhojpuri: { headerSub: "किसान भाइयन खातिर AI", weatherTitle: "मौसम अनुमान", detectTitle: "फसल रोग पहचान", chatPH: "फसल के बारे में पूछीं...", mandiTitle: "मंडी भाव", footerText: "AI से किसानन के मदद", floatPH: "कुछ भी पूछीं..." },
  marathi: { headerSub: "शेतकऱ्यांसाठी AI", weatherTitle: "हवामान अंदाज", detectTitle: "पीक रोग ओळख", chatPH: "पिकाबद्दल विचारा...", mandiTitle: "बाजार भाव", footerText: "AI द्वारे शेतकऱ्यांना सक्षम करणे", floatPH: "काहीही विचारा..." },
  telugu: { headerSub: "రైతులకు AI", weatherTitle: "వాతావరణ అంచనా", detectTitle: "పంట వ్యాధి గుర్తింపు", chatPH: "పంట గురించి అడగండి...", mandiTitle: "మండి ధర", footerText: "AI తో రైతులను సశక్తం", floatPH: "ఏదైనా అడగండి..." },
  tamil: { headerSub: "விவசாயிகளுக்கான AI", weatherTitle: "வானிலை கணிப்பு", detectTitle: "பயிர் நோய் கண்டறிதல்", chatPH: "பயிரைப் பற்றி கேளுங்கள்...", mandiTitle: "சந்தை விலை", footerText: "AI மூலம் விவசாயிகளை வலுப்படுத்துதல்", floatPH: "எதையும் கேளுங்கள்..." }
};

function setLang(lang, btn) {
  currentLang = lang;
  document.querySelectorAll(".lang-btn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  const t = T[lang];
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const setPH = (id, val) => { const el = document.getElementById(id); if (el) el.placeholder = val; };
  set("headerSub", t.headerSub); set("weatherTitle", t.weatherTitle);
  set("detectTitle", t.detectTitle); set("mandiTitle", t.mandiTitle);
  set("footerText", t.footerText);
  setPH("kisanBotInput", t.chatPH); setPH("floatingInput", t.floatPH);
}

function setPill(id, text, cls) { const el = document.getElementById(id); if (el) { el.textContent = text; el.className = `pill ${cls}`; } }
function loadModel() { setPill("modelStatus", "✅ Groq Vision", "ready"); }
async function checkBackend() {
  try { const res = await fetch(`${BACKEND}/`); const data = await res.json(); if (data.status) setPill("backendStatus", "✅ Backend", "ready"); }
  catch { setPill("backendStatus", "❌ Offline", "error"); }
}

async function getWeather() {
  const city = document.getElementById("city").value.trim();
  if (!city) { alert("Enter city name"); return; }
  const el = document.getElementById("weatherResult");
  el.innerHTML = "⏳ Loading...";
  try {
    const res = await fetch(`${BACKEND}/weather/${encodeURIComponent(city)}`);
    const data = await res.json();
    if (data.error) { el.innerHTML = "❌ City not found"; return; }
    currentTemp = data.current_temp; currentHumidity = data.current_humidity; hasRainForecast = data.has_rain_forecast;
    let html = `<strong>🌦️ ${data.city} — 5-Day Forecast</strong><br><br>`;
    for (const [date, slots] of Object.entries(data.forecast)) {
      const day = new Date(date).toLocaleDateString("en-US", { weekday: "short" });
      html += `<strong>${day} (${date})</strong><br>`;
      slots.forEach(s => { html += `• ${s.time} → 🌡 ${s.temp}°C | ${s.weather} | 💧 ${s.humidity}%${s.rain ? " 🌧" : ""}<br>`; });
      html += "<br>";
    }
    if (hasRainForecast) html += "⚠️ Rain expected → Reduce irrigation";
    el.innerHTML = html;
    updateDashboard();
  } catch { el.innerHTML = "❌ Backend offline?"; }
}


async function openCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    cameraStream = stream;
    const video = document.getElementById("cameraStream");
    video.srcObject = stream; video.style.display = "block";
    document.getElementById("captureBtn").style.display = "block";
  } catch { alert("Camera not available. Use Upload."); }
}

function capturePhoto() {
  const video = document.getElementById("cameraStream");
  const canvas = document.getElementById("canvas");
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  canvas.toBlob(blob => {
    const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
    const dt = new DataTransfer(); dt.items.add(file);
    document.getElementById("imageUpload").files = dt.files;
    const preview = document.getElementById("preview");
    preview.src = URL.createObjectURL(blob); preview.style.display = "block";
  }, "image/jpeg");
  if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
  document.getElementById("cameraStream").style.display = "none";
  document.getElementById("captureBtn").style.display = "none";
}

document.getElementById("imageUpload").addEventListener("change", function () {
  const file = this.files[0]; if (!file) return;
  const preview = document.getElementById("preview");
  preview.src = URL.createObjectURL(file); preview.style.display = "block";
});

async function detectDisease() {
  const file = document.getElementById("imageUpload").files[0];
  if (!file) { alert("Upload or capture a crop image first"); return; }
  const el = document.getElementById("diseaseResult");
  el.innerHTML = "⏳ <strong>Groq Vision AI analyzing...</strong><br><small>Please wait 5-10 seconds</small>";
  document.getElementById("recommendation").innerHTML = "";
  document.getElementById("whatsappBtn").style.display = "none";
  document.getElementById("gotoBot").style.display = "none";

  try {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${BACKEND}/detect-disease?language=${currentLang}&temperature=${currentTemp}&humidity=${currentHumidity}&has_rain=${hasRainForecast}`, { method: "POST", body: formData });
    const data = await res.json();
    if (!data.success) { el.innerHTML = `❌ ${data.error}`; return; }

    currentDisease = data.disease;
    lastAnalysisText = data.full_analysis;
    const isHealthy = data.disease.toLowerCase().includes("healthy");

    el.innerHTML = isHealthy
      ? `🌿 <strong>Healthy Plant!</strong> ✅<br><small>Groq Vision AI</small>`
      : `🦠 <strong>Disease: ${data.disease}</strong><br><small>Groq Vision AI</small>`;

    document.getElementById("recommendation").innerHTML =
      `<strong>🤖 Full Analysis:</strong><br><br>${data.full_analysis.replace(/\n/g, "<br>").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")}`;

    document.getElementById("whatsappBtn").style.display = "block";
    document.getElementById("gotoBot").style.display = "block";

    // Auto open floating bot with context
    setTimeout(() => {
      showFloatingBotMessage(isHealthy
        ? `✅ Your crop is <strong>healthy</strong>! Want tips to keep it healthy?`
        : `🦠 I detected <strong>${data.disease}</strong>! I can help with treatment, mandi prices, or prevention tips. What do you need?`
      );
    }, 500);

    saveHistory(data.disease, isHealthy ? 1.0 : 0.92);
    updateDashboard();
  } catch (err) { el.innerHTML = `❌ Error: ${err.message}`; }
}

function shareWhatsApp() {
  const isHealthy = currentDisease.toLowerCase().includes("healthy");
  const msg = isHealthy
    ? `🌾 *KRISHI AI Report*\n\n✅ Crop is *Healthy*!\n\nAnalyzed by Groq Vision AI\n🔗 visionix.ai`
    : `🌾 *KRISHI AI Report*\n\n🦠 Disease: *${currentDisease}*\n\n${lastAnalysisText.substring(0, 300)}...\n\nAnalyzed by Groq Vision AI`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
}

async function getMandiPrice() {
  const crop = document.getElementById("cropName").value.trim();
  const state = document.getElementById("stateName").value.trim() || "Bihar";
  if (!crop) { alert("Enter crop name"); return; }
  const el = document.getElementById("mandiResult");
  el.innerHTML = "⏳ Fetching prices...";
  try {
    const res = await fetch(`${BACKEND}/mandi/${encodeURIComponent(crop)}?state=${encodeURIComponent(state)}`);
    const data = await res.json();
    if (data.error) { el.innerHTML = "❌ " + data.error; return; }
    if (data.prices && data.prices.length > 0) {
      let html = `<strong>💰 ${crop} — ${state}</strong><br><br>`;
      const labels = [], modal = [], min = [], max = [];
      data.prices.forEach(p => {
        html += `📍 <strong>${p.market}</strong><br>• Min: ₹${p.min_price} | Max: ₹${p.max_price} | Modal: ₹${p.modal_price}<br>• Date: ${p.date}<br><br>`;
        labels.push(p.market); modal.push(parseFloat(p.modal_price)||0); min.push(parseFloat(p.min_price)||0); max.push(parseFloat(p.max_price)||0);
      });
      el.innerHTML = html;
      showPriceGraph(labels, modal, min, max, crop);
    } else if (data.gemini_estimate) {
      el.innerHTML = `<strong>💰 AI Price Estimate — ${crop}:</strong><br>${data.gemini_estimate}`;
      document.getElementById("graphContainer").style.display = "none";
    }
  } catch { el.innerHTML = "❌ Error. Backend running?"; }
}

function showPriceGraph(labels, modal, min, max, crop) {
  document.getElementById("graphContainer").style.display = "block";
  const ctx = document.getElementById("priceChart").getContext("2d");
  if (priceChart) priceChart.destroy();
  priceChart = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [
      { label: "Modal (₹)", data: modal, backgroundColor: "rgba(34,197,94,0.7)", borderColor: "#22c55e", borderWidth: 2, borderRadius: 8 },
      { label: "Min (₹)", data: min, backgroundColor: "rgba(251,191,36,0.5)", borderColor: "#fbbf24", borderWidth: 2, borderRadius: 8 },
      { label: "Max (₹)", data: max, backgroundColor: "rgba(99,102,241,0.5)", borderColor: "#6366f1", borderWidth: 2, borderRadius: 8 }
    ]},
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: "#e8f5e9" } },
        title: { display: true, text: `${crop} Price (₹/Quintal)`, color: "#86efac" }
      },
      scales: { x: { ticks: { color: "#6b9e78" }, grid: { color: "rgba(34,197,94,0.1)" } }, y: { ticks: { color: "#6b9e78" }, grid: { color: "rgba(34,197,94,0.1)" } } }
    }
  });
}

function quickCrop(crop) { document.getElementById("cropName").value = crop; getMandiPrice(); }

async function getCropCalendar() {
  const state = document.getElementById("calendarState").value.trim() || "Bihar";
  const month = document.getElementById("calendarMonth").value;
  const months = ["","January","February","March","April","May","June","July","August","September","October","November","December"];
  const el = document.getElementById("calendarResult");
  el.innerHTML = "⏳ Getting crop calendar...";
  try {
    const res = await fetch(`${BACKEND}/chat`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: `What crops should a farmer in ${state}, India plant in ${months[month]}? Give: 1) Best crops to sow 2) Crops to harvest 3) Soil preparation 4) Irrigation schedule 5) Common pests. Format with headings.`, language: currentLang, disease: "", temperature: currentTemp, humidity: currentHumidity, has_rain: hasRainForecast })
    });
    const data = await res.json();
    el.innerHTML = `<strong>🌱 ${state} — ${months[month]}</strong><br><br>${data.reply.replace(/\n/g,"<br>").replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>")}`;
  } catch { el.innerHTML = "❌ Error."; }
}

async function getSoilHealth() {
  const city = document.getElementById("soilCity").value.trim() || "Bihar";
  const crop = document.getElementById("soilCrop").value.trim() || "Wheat";
  const soilType = document.getElementById("soilType").value;
  const el = document.getElementById("soilResult");
  el.innerHTML = "⏳ Analyzing soil...";
  try {
    const res = await fetch(`${BACKEND}/chat`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: `Analyze soil health for ${city}, India growing ${crop} on ${soilType} soil. Temp=${currentTemp}°C, Humidity=${currentHumidity}%, Rain=${hasRainForecast?"Yes":"No"}. Give: 1) Health Score/10 2) pH estimate 3) NPK status 4) Best fertilizers 5) Irrigation tips 6) Warnings. Use headings.`, language: currentLang, disease: currentDisease, temperature: currentTemp, humidity: currentHumidity, has_rain: hasRainForecast })
    });
    const data = await res.json();
    el.innerHTML = `<strong>🎯 Soil Report — ${city}</strong><br><br>${data.reply.replace(/\n/g,"<br>").replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>")}`;
  } catch { el.innerHTML = "❌ Error."; }
}

function updateDashboard() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set("dashTemp", currentTemp ? `${currentTemp}°C` : "-- °C");
  set("dashHumidity", currentHumidity ? `${currentHumidity}%` : "-- %");
  set("dashRain", hasRainForecast ? "🌧 Expected" : currentTemp ? "☀️ Clear" : "--");
  set("dashDisease", currentDisease || "None");
  set("dashScans", detectionHistory.length);
  set("dashHealthy", detectionHistory.filter(h => h.healthy).length);
  const activity = detectionHistory.slice(0, 5).map(h => `• ${h.healthy ? "🌿" : "🦠"} ${h.disease} — ${h.time}`).join("<br>");
  const actEl = document.getElementById("dashActivity");
  if (actEl) actEl.innerHTML = activity || "Run weather check and crop analysis to see activity!";
}

function saveHistory(disease, prob) {
  detectionHistory.unshift({ disease, confidence: Math.round(prob*100), healthy: disease.toLowerCase().includes("healthy"), time: new Date().toLocaleString("en-IN",{hour12:true,hour:"2-digit",minute:"2-digit",day:"numeric",month:"short"}) });
  if (detectionHistory.length > 20) detectionHistory = detectionHistory.slice(0,20);
  localStorage.setItem("visionix_history", JSON.stringify(detectionHistory));
}
function renderHistory() {
  const list = document.getElementById("historyList");
  if (!detectionHistory.length) { list.innerHTML = `<p class="empty-history">No detections yet.</p>`; return; }
  list.innerHTML = detectionHistory.map(e => `<div class="history-item"><div><span class="disease-tag ${e.healthy?'healthy':''}">${e.healthy?"🌿":"🦠"} ${e.disease}</span><span style="color:var(--text-dim);font-size:12px;margin-left:8px">${e.confidence}% confidence</span></div><span class="time-tag">🕐 ${e.time}</span></div>`).join("");
}
function clearHistory() { detectionHistory = []; localStorage.removeItem("visionix_history"); renderHistory(); updateDashboard(); }

const QUICK_REPLIES_DATA = {
  welcome: [
    {text:"🦠 Disease Help", msg:"I need help with crop disease"},
    {text:"💰 Mandi Price", msg:"What are the mandi prices today?"},
    {text:"🌦️ Weather Advice", msg:"Give me weather based farming advice"},
    {text:"🌱 Crop Calendar", msg:"What crops should I grow this month?"},
    {text:"🎯 Soil Health", msg:"How do I improve my soil health?"},
  ],
  after_disease: [
    {text:"💊 Full Treatment", msg:`Give full treatment for ${currentDisease}`},
    {text:"💰 Best Market Price", msg:"Where can I sell my crop at best price?"},
    {text:"🛡️ Prevention Tips", msg:"How to prevent this disease in future?"},
    {text:"🌦️ Weather Impact", msg:"How will weather affect my crop disease?"},
  ],
  general: [
    {text:"🏠 Main Menu", msg:"__welcome__"},
    {text:"🦠 Disease Help", msg:"I need help with crop disease"},
    {text:"💰 Mandi Price", msg:"Check mandi price"},
    {text:"🌱 More Advice", msg:"Give me farming advice"},
  ]
};

let kisanBotInitialized = false;

function initKisanBot() {
  if (kisanBotInitialized) return;
  kisanBotInitialized = true;
  addKisanBotMessage("Namaste! 🌾 Main **Visionix Kisan Bot** hoon!\n\nMain aapki madad kar sakta hoon:\n• 🦠 Crop disease treatment\n• 💰 Mandi prices\n• 🌦️ Weather advice\n• 🌱 Crop calendar\n• 🎯 Soil health\n\nAaj kaise madad karoon?", false, "welcome");
}

function addKisanBotMessage(text, isUser, quickReplyType = null) {
  const box = document.getElementById("kisanBotBox");
  const div = document.createElement("div");
  div.className = `chat-msg ${isUser ? "user" : "bot"}`;
  div.innerHTML = `<span class="chat-avatar">${isUser ? "👨‍🌾" : "🌾"}</span><div class="chat-bubble">${text.replace(/\n/g,"<br>").replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>")}</div>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  if (quickReplyType) setTimeout(() => addKisanQuickReplies(quickReplyType), 300);
}

function addKisanQuickReplies(type) {
  const container = document.getElementById("kisanBotQuickReplies");
  container.innerHTML = "";
  const replies = QUICK_REPLIES_DATA[type] || QUICK_REPLIES_DATA.general;
  replies.forEach(r => {
    const btn = document.createElement("button");
    btn.className = "quick-reply-btn";
    btn.textContent = r.text;
    btn.onclick = () => {
      container.innerHTML = "";
      if (r.msg === "__welcome__") { addKisanBotMessage(r.text, true); initKisanBotWelcome(); return; }
      addKisanBotMessage(r.text, true);
      sendKisanBotMessage(r.msg);
    };
    container.appendChild(btn);
  });
}

function initKisanBotWelcome() {
  addKisanBotMessage("Bilkul! Kaise madad karoon?", false, "welcome");
}

function addKisanTyping() {
  const box = document.getElementById("kisanBotBox");
  const div = document.createElement("div"); div.className = "chat-msg bot"; div.id = "kisanTyping";
  div.innerHTML = `<span class="chat-avatar">🌾</span><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
  box.appendChild(div); box.scrollTop = box.scrollHeight;
}
function removeKisanTyping() { const el = document.getElementById("kisanTyping"); if (el) el.remove(); }

async function sendKisanBotMessage(msg) {
  addKisanTyping();
  try {
    const res = await fetch(`${BACKEND}/chat`, { method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ message: msg, language: currentLang, disease: currentDisease, temperature: currentTemp, humidity: currentHumidity, has_rain: hasRainForecast })
    });
    const data = await res.json();
    removeKisanTyping();
    const qType = currentDisease && !currentDisease.toLowerCase().includes("healthy") ? "after_disease" : "general";
    addKisanBotMessage(data.reply || "Sorry, try again.", false, qType);
  } catch { removeKisanTyping(); addKisanBotMessage("❌ Backend offline. Start the server!", false); }
}

async function sendKisanBot() {
  const input = document.getElementById("kisanBotInput");
  const msg = input.value.trim(); if (!msg) return;
  document.getElementById("kisanBotQuickReplies").innerHTML = "";
  addKisanBotMessage(msg, true); input.value = "";
  await sendKisanBotMessage(msg);
}

document.getElementById("kisanBotInput").addEventListener("keypress", e => { if (e.key === "Enter") sendKisanBot(); });

let floatingInitialized = false;

function toggleFloatingChat() {
  const popup = document.getElementById("floatingChatPopup");
  floatingChatOpen = !floatingChatOpen;
  popup.classList.toggle("open", floatingChatOpen);
  document.getElementById("floatingBadge").style.display = "none";
  if (floatingChatOpen && !floatingInitialized) {
    floatingInitialized = true;
    addFloatingQuickReplies("welcome");
  }
}

function openFloatingChat() {
  const popup = document.getElementById("floatingChatPopup");
  floatingChatOpen = true; popup.classList.add("open");
  document.getElementById("floatingBadge").style.display = "none";
}

function openFullBot() {
  toggleFloatingChat();
  switchTab("kisanbot", document.querySelector(".tab:nth-child(3)"));
}

function addFloatingMessage(text, isUser) {
  const box = document.getElementById("floatingChatBox");
  const div = document.createElement("div"); div.className = `chat-msg ${isUser?"user":"bot"}`;
  div.innerHTML = `<span class="chat-avatar" style="font-size:16px">${isUser?"👨‍🌾":"🌾"}</span><div class="chat-bubble" style="font-size:12px">${text.replace(/\n/g,"<br>").replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>")}</div>`;
  box.appendChild(div); box.scrollTop = box.scrollHeight;
}

function showFloatingBotMessage(text) {
  openFloatingChat();
  document.getElementById("floatingQuickReplies").innerHTML = "";
  addFloatingMessage(text, false);
  const qType = currentDisease && !currentDisease.toLowerCase().includes("healthy") ? "after_disease" : "general";
  setTimeout(() => addFloatingQuickReplies(qType), 300);
  // Show badge if closed
  if (!floatingChatOpen) document.getElementById("floatingBadge").style.display = "flex";
}

function addFloatingQuickReplies(type) {
  const container = document.getElementById("floatingQuickReplies");
  container.innerHTML = "";
  const replies = (QUICK_REPLIES_DATA[type] || QUICK_REPLIES_DATA.general).slice(0, 3);
  replies.forEach(r => {
    const btn = document.createElement("button"); btn.className = "quick-reply-btn"; btn.textContent = r.text;
    btn.style.fontSize = "11px"; btn.style.padding = "5px 10px";
    btn.onclick = () => { container.innerHTML = ""; addFloatingMessage(r.text, true); sendFloatingMessage(r.msg); };
    container.appendChild(btn);
  });
}

function addFloatingTyping() {
  const box = document.getElementById("floatingChatBox");
  const div = document.createElement("div"); div.className = "chat-msg bot"; div.id = "floatingTyping";
  div.innerHTML = `<span class="chat-avatar" style="font-size:16px">🌾</span><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
  box.appendChild(div); box.scrollTop = box.scrollHeight;
}
function removeFloatingTyping() { const el = document.getElementById("floatingTyping"); if (el) el.remove(); }

async function sendFloatingMessage(msg) {
  addFloatingTyping();
  try {
    const res = await fetch(`${BACKEND}/chat`, { method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ message: msg, language: currentLang, disease: currentDisease, temperature: currentTemp, humidity: currentHumidity, has_rain: hasRainForecast })
    });
    const data = await res.json();
    removeFloatingTyping();
    addFloatingMessage(data.reply || "Sorry, try again.", false);
    addFloatingQuickReplies("general");
  } catch { removeFloatingTyping(); addFloatingMessage("❌ Backend offline!", false); }
}

async function sendFloatingChat() {
  const input = document.getElementById("floatingInput");
  const msg = input.value.trim(); if (!msg) return;
  document.getElementById("floatingQuickReplies").innerHTML = "";
  addFloatingMessage(msg, true); input.value = "";
  await sendFloatingMessage(msg);
}

document.getElementById("floatingInput").addEventListener("keypress", e => { if (e.key === "Enter") sendFloatingChat(); });

function startVoiceBot() {
  if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) { alert("Use Chrome!"); return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const r = new SR();
  const langMap = { english:"en-IN", hindi:"hi-IN", bhojpuri:"hi-IN", marathi:"mr-IN", telugu:"te-IN", tamil:"ta-IN" };
  r.lang = langMap[currentLang] || "hi-IN";
  const btn = document.getElementById("voiceBtnBot");
  btn.classList.add("listening"); btn.textContent = "🔴"; r.start();
  r.onresult = e => { document.getElementById("kisanBotInput").value = e.results[0][0].transcript; btn.classList.remove("listening"); btn.textContent = "🎤"; sendKisanBot(); };
  r.onerror = r.onend = () => { btn.classList.remove("listening"); btn.textContent = "🎤"; };
}


window.onload = () => { loadModel(); checkBackend(); updateDashboard(); };

let copilotCameraStream = null;
let copilotReportText = "";

async function openCopilotCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    copilotCameraStream = stream;
    const video = document.getElementById("copilotCamera");
    video.srcObject = stream; video.style.display = "block";
    document.getElementById("copilotCaptureBtn").style.display = "block";
  } catch { alert("Camera not available. Use Upload."); }
}

function captureCopilotPhoto() {
  const video = document.getElementById("copilotCamera");
  const canvas = document.getElementById("copilotCanvas");
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  canvas.toBlob(blob => {
    const file = new File([blob], "copilot_capture.jpg", { type: "image/jpeg" });
    const dt = new DataTransfer(); dt.items.add(file);
    document.getElementById("copilotImage").files = dt.files;
    const preview = document.getElementById("copilotPreview");
    preview.src = URL.createObjectURL(blob); preview.style.display = "block";
    document.getElementById("copilotUploadText").textContent = "Photo captured! ✅";
  }, "image/jpeg");
  if (copilotCameraStream) { copilotCameraStream.getTracks().forEach(t => t.stop()); copilotCameraStream = null; }
  document.getElementById("copilotCamera").style.display = "none";
  document.getElementById("copilotCaptureBtn").style.display = "none";
}

document.getElementById("copilotImage").addEventListener("change", function() {
  const file = this.files[0]; if (!file) return;
  const preview = document.getElementById("copilotPreview");
  preview.src = URL.createObjectURL(file); preview.style.display = "block";
  document.getElementById("copilotUploadText").textContent = file.name + " ✅";
});

function setStep(stepNum, status) {
  const el = document.getElementById(`step${stepNum}`);
  if (!el) return;
  el.className = `copilot-step ${status}`;
  if (status === "done") {
    el.textContent = el.textContent.replace("...", " ✅");
  }
}

async function runCopilot() {
  const location = document.getElementById("copilotLocation").value.trim();
  const crop = document.getElementById("copilotCrop").value.trim();

  if (!location || !crop) {
    alert("Please enter both Location and Crop name!");
    return;
  }


  const btn = document.getElementById("copilotBtn");
  btn.disabled = true; btn.textContent = "⏳ Generating Report...";

  document.getElementById("copilotLoading").style.display = "block";
  document.getElementById("copilotReport").style.display = "none";

  ["step1","step2","step3"].forEach(s => {
    const el = document.getElementById(s);
    if (el) { el.className = "copilot-step"; el.textContent = el.textContent.replace(" ✅","").replace("...","..."); }
  });

  setStep(1, "active");
  let detectedDisease = "Not analyzed";

  const imageFile = document.getElementById("copilotImage").files[0];
  if (imageFile) {
    try {
      const formData = new FormData();
      formData.append("file", imageFile);
      // using same detection as detect tab so results are consistent
      const res = await fetch(
        `${BACKEND}/detect-disease?language=${currentLang}&temperature=${currentTemp}&humidity=${currentHumidity}&has_rain=${hasRainForecast}`,
        { method: "POST", body: formData }
      );
      const data = await res.json();
      if (data.success && data.disease) {
        detectedDisease = data.disease;
        currentDisease = data.disease;
        // show in detect tab as well
        const detectEl = document.getElementById("diseaseResult");
        if (detectEl) {
          const isHealthy = data.disease.toLowerCase().includes("healthy");
          detectEl.innerHTML = isHealthy
            ? `🌿 <strong>Healthy Plant!</strong> ✅<br><small>Analyzed by Groq Vision AI</small>`
            : `🦠 <strong>Disease: ${data.disease}</strong><br><small>Analyzed by Groq Vision AI</small>`;
        }
      }
    } catch (e) {
      console.log("detection error:", e);
      detectedDisease = "Could not analyze - try a clearer photo";
    }
  } else {
    detectedDisease = "No photo uploaded - AI will estimate from crop type and weather";
  }
  setStep(1, "done");

  setStep(2, "active");
  let weatherSummary = "";
  try {
    const res = await fetch(`${BACKEND}/weather/${encodeURIComponent(location)}`);
    const data = await res.json();
    if (!data.error) {
      currentTemp = data.current_temp;
      currentHumidity = data.current_humidity;
      hasRainForecast = data.has_rain_forecast;
      weatherSummary = `${data.current_temp}°C, ${data.current_humidity}% humidity, Rain: ${data.has_rain_forecast ? "Expected" : "No"}`;
    }
  } catch { weatherSummary = "Weather fetch failed"; }
  setStep(2, "done");

  setStep(3, "active");
  try {
    const res = await fetch(`${BACKEND}/copilot`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location, crop, language: currentLang,
        disease: detectedDisease,
        temperature: currentTemp,
        humidity: currentHumidity,
        has_rain: hasRainForecast,
        weather_summary: weatherSummary
      })
    });
    const data = await res.json();
    setStep(3, "done");

    if (data.success) {
      copilotReportText = data.report;

      let html = data.report
        .replace(/\n/g, "<br>")
        .replace(/## (.*?)(<br>|$)/g, '<h2>$1</h2>')
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\| (.*?) \|/g, (match) => match)
        .replace(/---/g, '<hr style="border-color:rgba(251,191,36,0.2);margin:12px 0">');

      document.getElementById("copilotReportContent").innerHTML = html;
      document.getElementById("copilotReport").style.display = "block";

      updateDashboard();

      showFloatingBotMessage(`🚀 Farm Copilot report ready for **${crop}** in **${location}**! ${detectedDisease !== "Not analyzed" ? `Disease: ${detectedDisease}.` : ""} Ask me anything about your report!`);
    } else {
      document.getElementById("copilotReportContent").innerHTML = `❌ Error: ${data.error}`;
      document.getElementById("copilotReport").style.display = "block";
    }
  } catch (err) {
    setStep(3, "done");
    document.getElementById("copilotReportContent").innerHTML = `❌ Error: ${err.message}`;
    document.getElementById("copilotReport").style.display = "block";
  }

  document.getElementById("copilotLoading").style.display = "none";
  btn.disabled = false; btn.textContent = "🚀 Generate Complete Farm Report";
}

function shareCopilotWhatsApp() {
  const location = document.getElementById("copilotLocation").value;
  const crop = document.getElementById("copilotCrop").value;
  const shortReport = copilotReportText.substring(0, 500);
  const msg = `🌾 *Visionix AI — Smart Farm Report*\n📍 ${location} | 🌱 ${crop}\n\n${shortReport}...\n\n_Generated by Visionix AI_`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
}

function printCopilotReport() {
  const content = document.getElementById("copilotReportContent").innerHTML;
  const win = window.open("", "_blank");
  win.document.write(`
    <html><head><title>Visionix Farm Report</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;color:#111;line-height:1.8}h2{color:#16a34a;margin-top:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px}th{background:#f0fdf4}hr{margin:16px 0;border-color:#ccc}</style>
    </head><body>
    <h1 style="color:#16a34a">🌾 KRISHI AI  — Smart Farm Report</h1>
    ${content}
    <br><hr><p style="color:#999;font-size:12px">Generated by Visionix AI | visionix.ai</p>
    </body></html>`);
  win.document.close();
  win.print();
}

async function findSchemes() {
  const state = document.getElementById("schemeState").value.trim() || "India";
  const crop = document.getElementById("schemeCrop").value.trim() || "all crops";
  const category = document.getElementById("schemeCategory").value;
  const el = document.getElementById("schemeResult");
  el.innerHTML = "⏳ Finding government schemes...";

  try {
    const res = await fetch(`${BACKEND}/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `List all relevant Indian government agricultural schemes for a farmer in ${state} growing ${crop}. Category focus: ${category}.

For each scheme provide:
1. **Scheme Name** (Hindi + English)
2. **Benefit**: What farmer gets (money/subsidy/insurance amount)
3. **Eligibility**: Who can apply
4. **How to Apply**: Steps + website/app
5. **Documents Needed**: List
6. **Helpline**: Phone number

Include: PM-KISAN, PMFBY, Kisan Credit Card, Soil Health Card, PM Krishi Sinchai Yojana, and any ${state}-specific schemes.

Format clearly with headings. Be specific with amounts and deadlines.`,
        language: currentLang,
        disease: "",
        temperature: 0,
        humidity: 0,
        has_rain: false
      })
    });
    const data = await res.json();
    el.innerHTML = `<strong>🏛️ Government Schemes — ${state} | ${crop}</strong><br><br>${data.reply.replace(/\n/g,"<br>").replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>")}`;
  } catch { el.innerHTML = "❌ Error. Backend running?"; }
}

function quickScheme(scheme) {
  document.getElementById("schemeCrop").value = scheme;
  document.getElementById("schemeState").value = document.getElementById("schemeState").value || "Bihar";
  findSchemes();
}
