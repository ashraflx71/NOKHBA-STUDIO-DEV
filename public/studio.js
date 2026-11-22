
"use strict";

/* =========================================
   NOKHBA AI STUDIO
   Development Edition
   Version: 1.0.0
   ========================================= */

/*
  ضع رابط Worker الخاص ببيئة التطوير فقط هنا
  اتركه فارغاً إلى أن يتم إنشاء Worker التطوير.

  لا تضع رابط الإنتاج هنا.
*/

const NOKHBA_CONFIG = Object.freeze({
  version: "1.0.0",
  environment: "development",

  // رابط Worker التطوير فقط
  workerUrl: "",

  // مسار فحص الصحة
  healthPath: "/",

  // أقصى مدة انتظار للفحص
  timeout: 10000
});

/* =========================================
   DOM ELEMENTS
   ========================================= */

const elements = {
  healthDot: document.getElementById("healthDot"),
  healthTitle: document.getElementById("healthTitle"),
  healthText: document.getElementById("healthText"),
  healthButton: document.getElementById("healthButton")
};

/* =========================================
   APPLICATION STATE
   ========================================= */

const state = {
  checking: false,
  connected: false,
  lastChecked: null
};

/* =========================================
   BASIC UTILITIES
   ========================================= */

function setHealthStatus(status, title, message) {
  if (
    !elements.healthDot ||
    !elements.healthTitle ||
    !elements.healthText
  ) {
    return;
  }

  const allowedStatuses = [
    "idle",
    "online",
    "offline"
  ];

  const safeStatus = allowedStatuses.includes(status)
    ? status
    : "idle";

  elements.healthDot.className = "dot " + safeStatus;
  elements.healthTitle.textContent = title;
  elements.healthText.textContent = message;
}

function setButtonState(disabled, text) {
  if (!elements.healthButton) return;

  elements.healthButton.disabled = disabled;
  elements.healthButton.textContent = text;
}

/* =========================================
   WORKER URL VALIDATION
   ========================================= */

function getWorkerEndpoint() {
  const base = NOKHBA_CONFIG.workerUrl.trim();

  if (!base) {
    return null;
  }

  let parsed;

  try {
    parsed = new URL(base);
  } catch {
    throw new Error("رابط Worker غير صالح.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("يجب استخدام رابط HTTPS.");
  }

  if (parsed.username || parsed.password) {
    throw new Error("الرابط يحتوي على بيانات غير مسموح بها.");
  }

  const endpoint = new URL(
    NOKHBA_CONFIG.healthPath,
    parsed.origin
  );

  if (endpoint.origin !== parsed.origin) {
    throw new Error("عنوان الفحص غير مسموح.");
  }

  return endpoint.toString();
}

/* =========================================
   WORKER HEALTH CHECK
   ========================================= */

async function checkWorker() {
  if (state.checking) return;

  if (!elements.healthButton) return;

  state.checking = true;

  setButtonState(true, "جارٍ الفحص...");

  setHealthStatus(
    "idle",
    "جارٍ فحص الاتصال",
    "يرجى الانتظار حتى انتهاء الفحص."
  );

  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, NOKHBA_CONFIG.timeout);

  try {
    const endpoint = getWorkerEndpoint();

    if (!endpoint) {
      setHealthStatus(
        "idle",
        "Worker التطوير غير محدد",
        "أضف رابط Worker التطوير في NOKHBA_CONFIG.workerUrl بعد إنشائه."
      );

      return;
    }

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Accept": "application/json, text/plain"
      },
      cache: "no-store",
      redirect: "error",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error("Worker returned HTTP " + response.status);
    }

    state.connected = true;
    state.lastChecked = new Date();

    setHealthStatus(
      "online",
      "Worker التطوير متصل",
      "تم الوصول إلى الخادم بنجاح. رمز الاستجابة: " +
        response.status
    );

  } catch (error) {
    state.connected = false;

    let message = "تعذر الاتصال بخادم التطوير.";

    if (error.name === "AbortError") {
      message = "انتهت مهلة الاتصال. حاول مرة أخرى.";
    } else if (
      error.message === "Failed to fetch" ||
      error instanceof TypeError
    ) {
      message = "تعذر الوصول إلى الخادم. تحقق من الرابط وCORS.";
    } else if (
      error.message.includes("رابط") ||
      error.message.includes("HTTPS") ||
      error.message.includes("عنوان")
    ) {
      message = error.message;
    }

    setHealthStatus(
      "offline",
      "Worker غير متاح",
      message
    );

  } finally {
    clearTimeout(timeoutId);

    state.checking = false;

    setButtonState(
      false,
      "فحص Worker التطوير"
    );
  }
}

/* =========================================
   INITIALIZATION
   ========================================= */

function initializeStudio() {
  if (!elements.healthButton) {
    console.warn(
      "NOKHBA STUDIO: Health button not found."
    );

    return;
  }

  elements.healthButton.addEventListener(
    "click",
    checkWorker
  );

  setHealthStatus(
    "idle",
    "لم يتم فحص الخادم بعد",
    "الواجهة تعمل في وضع التطوير المستقل."
  );

  setButtonState(
    false,
    "فحص Worker التطوير"
  );

  console.info(
    "NOKHBA AI STUDIO " +
    NOKHBA_CONFIG.version +
    " initialized."
  );

  console.info(
    "Environment:",
    NOKHBA_CONFIG.environment
  );
}

/* =========================================
   START APPLICATION
   ========================================= */

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeStudio,
    { once: true }
  );
} else {
  initializeStudio();
}
