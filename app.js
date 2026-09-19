// ------------------------------------------------------------
// PARECE MENTIRA - FRONTEND PWA V2
// Backend real: Cloudflare Worker -> GitHub -> Actions
// ------------------------------------------------------------

const BACKEND_URL =
  "https://parece-mentira-api.fabriciosanchesalvarenga.workers.dev";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const KEY_STORAGE = "parece_mentira_app_key_v1";

const $ = (id) => document.getElementById(id);

const videoInput = $("videoInput");
const fileName = $("fileName");
const editBtn = $("editBtn");
const progressCard = $("progressCard");
const progressTitle = $("progressTitle");
const progressDetail = $("progressDetail");
const progressPercent = $("progressPercent");
const progressBar = $("progressBar");
const resultCard = $("resultCard");
const preview = $("preview");
const downloadBtn = $("downloadBtn");
const apiStatus = $("apiStatus");
const accessCard = $("accessCard");
const appKeyInput = $("appKeyInput");
const saveKeyBtn = $("saveKeyBtn");
const changeKeyBtn = $("changeKeyBtn");

let currentJobId = null;
let currentObjectUrl = null;
let fakeProgress = 15;
let pollStartedAt = 0;

function getAppKey() {
  return localStorage.getItem(KEY_STORAGE) || "";
}

function setBackendPill(text, type) {
  apiStatus.textContent = text;
  apiStatus.classList.remove("ok", "warn", "bad");
  if (type) apiStatus.classList.add(type);
}

function showAccessIfNeeded() {
  const hasKey = Boolean(getAppKey());
  accessCard.classList.toggle("hidden", hasKey);
  changeKeyBtn.classList.toggle("hidden", !hasKey);
}

async function checkBackend() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`, {
      method: "GET",
      cache: "no-store",
    });

    if (!res.ok) throw new Error("Backend indisponível");

    const data = await res.json();

    if (data?.ok) {
      if (getAppKey()) {
        setBackendPill("Backend conectado", "ok");
      } else {
        setBackendPill("Backend online • falta chave", "warn");
      }
      return;
    }

    throw new Error("Resposta inválida");
  } catch (err) {
    console.error(err);
    setBackendPill("Backend indisponível", "bad");
  }
}

saveKeyBtn.addEventListener("click", () => {
  const key = appKeyInput.value.trim();

  if (!key) {
    alert("Digite a APP_KEY.");
    return;
  }

  localStorage.setItem(KEY_STORAGE, key);
  appKeyInput.value = "";
  showAccessIfNeeded();
  checkBackend();
});

changeKeyBtn.addEventListener("click", () => {
  localStorage.removeItem(KEY_STORAGE);
  appKeyInput.value = "";
  showAccessIfNeeded();
  setBackendPill("Backend online • falta chave", "warn");
  appKeyInput.focus();
});

videoInput.addEventListener("change", () => {
  const file = videoInput.files?.[0];

  if (!file) {
    fileName.textContent =
      "MP4, MOV ou vídeo do iPhone • até 100 MB";
    return;
  }

  fileName.textContent =
    `${file.name} • ${formatBytes(file.size)}`;

  if (file.size > MAX_UPLOAD_BYTES) {
    fileName.textContent += " • ACIMA DO LIMITE";
  }
});

editBtn.addEventListener("click", async () => {
  const file = videoInput.files?.[0];
  const appKey = getAppKey();

  if (!appKey) {
    showAccessIfNeeded();
    appKeyInput.focus();
    alert("Salve a APP_KEY neste aparelho primeiro.");
    return;
  }

  if (!file) {
    alert("Selecione um vídeo primeiro.");
    return;
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    alert("Este vídeo ultrapassa 100 MB. Escolha um arquivo menor para esta versão.");
    return;
  }

  resultCard.classList.add("hidden");
  progressCard.classList.remove("hidden");
  editBtn.disabled = true;
  currentJobId = null;
  fakeProgress = 8;
  pollStartedAt = Date.now();

  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }

  preview.removeAttribute("src");
  downloadBtn.removeAttribute("href");

  setProgress(
    8,
    "Enviando vídeo...",
    "Upload para o processamento seguro."
  );

  try {
    const contexto = headerSafe($("contexto").value.trim());
    const modo = $("modo").value;
    const etapa = $("etapa").value;

    const startRes = await fetch(`${BACKEND_URL}/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "X-App-Key": appKey,
        "X-Filename": file.name,
        "X-Context": contexto,
        "X-Modo": modo,
        "X-Etapa": etapa,
      },
      body: file,
    });

    const startData = await safeJson(startRes);

    if (!startRes.ok) {
      throw new Error(
        startData?.error ||
        `Falha ao iniciar (${startRes.status}).`
      );
    }

    currentJobId = startData.job_id;

    setProgress(
      15,
      "Vídeo recebido",
      `Job ${currentJobId} • iniciando o GitHub Actions.`
    );

    await pollJob(currentJobId, appKey);
  } catch (err) {
    console.error(err);
    setProgress(
      0,
      "Falha no processamento",
      String(err?.message || err)
    );
    editBtn.disabled = false;
  }
});

async function pollJob(jobId, appKey) {
  let consecutiveErrors = 0;

  while (true) {
    await sleep(5000);

    try {
      const res = await fetch(
        `${BACKEND_URL}/jobs/${encodeURIComponent(jobId)}`,
        {
          method: "GET",
          headers: {
            "X-App-Key": appKey,
          },
          cache: "no-store",
        }
      );

      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(
          data?.error ||
          `Falha ao consultar job (${res.status}).`
        );
      }

      consecutiveErrors = 0;

      if (data.status === "PRONTO") {
        setProgress(
          96,
          "Finalizando...",
          "Master aprovado. Preparando o download."
        );

        await loadFinalVideo(jobId, appKey);

        setProgress(
          100,
          "Concluído",
          "Master final validado."
        );

        resultCard.classList.remove("hidden");
        editBtn.disabled = false;

        break;
      }

      if (data.status === "ERRO") {
        throw new Error(
          "O GitHub Actions informou falha real no processamento."
        );
      }

      updateProcessingProgress();

    } catch (err) {
      consecutiveErrors += 1;

      console.warn(
        "Falha temporária ao consultar job:",
        err
      );

      if (consecutiveErrors <= 12) {
        setProgress(
          fakeProgress,
          "Processando...",
          "Conexão oscilou. Continuando a acompanhar o GitHub."
        );

        continue;
      }

      throw new Error(
        "O processamento pode ainda estar rodando, mas o app perdeu a comunicação por muito tempo. Verifique o GitHub Actions."
      );
    }
  }
}

function updateProcessingProgress() {
  const elapsedSec = Math.floor(
    (Date.now() - pollStartedAt) / 1000
  );

  fakeProgress = Math.min(
    92,
    Math.max(fakeProgress + 2, 18 + Math.floor(elapsedSec / 8))
  );

  let title = "Processando...";
  let detail = "Analisando e montando o vídeo.";

  if (fakeProgress >= 35) {
    title = "Entendendo o episódio...";
    detail = "Cenas, narrativa e contexto em processamento.";
  }

  if (fakeProgress >= 55) {
    title = "Editando...";
    detail = "Montagem, narração e composição do master.";
  }

  if (fakeProgress >= 75) {
    title = "Finalizando...";
    detail = "Acabamento visual e QA técnico.";
  }

  setProgress(fakeProgress, title, detail);
}

async function loadFinalVideo(jobId, appKey) {
  const res = await fetch(
    `${BACKEND_URL}/jobs/${encodeURIComponent(jobId)}/download`,
    {
      method: "GET",
      headers: {
        "X-App-Key": appKey,
      },
    }
  );

  if (!res.ok) {
    const maybe = await res.text();
    throw new Error(
      `Master pronto, mas o download falhou: ${maybe}`
    );
  }

  const blob = await res.blob();

  currentObjectUrl = URL.createObjectURL(blob);

  preview.src = currentObjectUrl;
  downloadBtn.href = currentObjectUrl;
  downloadBtn.download = "final_master.mp4";
}

function setProgress(value, title, detail) {
  const safe = Math.max(
    0,
    Math.min(100, Number(value || 0))
  );

  progressBar.style.width = `${safe}%`;
  progressPercent.textContent = `${safe}%`;
  progressTitle.textContent = title;
  progressDetail.textContent = detail;
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB"];

  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  return `${(
    bytes / Math.pow(1024, i)
  ).toFixed(i ? 1 : 0)} ${units[i]}`;
}

function headerSafe(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1500);
}

async function safeJson(response) {
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

showAccessIfNeeded();
checkBackend();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("sw.js?v=2");
      reg.update();
    } catch (err) {
      console.error(err);
    }
  });
}
