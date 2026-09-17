// ------------------------------------------------------------
// PARECE MENTIRA - FRONTEND PWA V1
// ------------------------------------------------------------
// IMPORTANTE:
// BACKEND_URL deve apontar para a ponte segura que vamos criar no
// próximo passo. Não coloque token do GitHub neste arquivo.
// ------------------------------------------------------------

const BACKEND_URL = "";

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

if (BACKEND_URL) {
  apiStatus.textContent = "Backend conectado";
  apiStatus.style.background = "#e7f6ef";
  apiStatus.style.color = "#1f6a50";
  apiStatus.style.borderColor = "#bfe6d5";
}

videoInput.addEventListener("change", () => {
  const file = videoInput.files?.[0];
  fileName.textContent = file ? `${file.name} • ${formatBytes(file.size)}` : "MP4, MOV ou vídeo do iPhone";
});

editBtn.addEventListener("click", async () => {
  const file = videoInput.files?.[0];
  if (!file) {
    alert("Selecione um vídeo primeiro.");
    return;
  }
  if (!BACKEND_URL) {
    alert("A interface está pronta. Falta conectar o backend seguro ao GitHub Actions.");
    return;
  }

  resultCard.classList.add("hidden");
  progressCard.classList.remove("hidden");
  editBtn.disabled = true;
  setProgress(5, "Enviando vídeo...", "Upload iniciado.");

  try {
    const form = new FormData();
    form.append("video", file);
    form.append("contexto", $("contexto").value.trim());
    form.append("modo", $("modo").value);
    form.append("etapa", $("etapa").value);

    const startRes = await fetch(`${BACKEND_URL}/start`, {
      method: "POST",
      body: form
    });

    if (!startRes.ok) throw new Error(await startRes.text());
    const { jobId } = await startRes.json();
    setProgress(12, "Processando...", `Job ${jobId}`);

    await pollJob(jobId);
  } catch (err) {
    console.error(err);
    setProgress(0, "Falha no processamento", String(err.message || err));
    editBtn.disabled = false;
  }
});

async function pollJob(jobId) {
  while (true) {
    await sleep(5000);
    const res = await fetch(`${BACKEND_URL}/status?id=${encodeURIComponent(jobId)}`);
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    setProgress(
      Number(data.progress || 15),
      data.title || "Processando...",
      data.detail || ""
    );

    if (data.status === "completed") {
      setProgress(100, "Concluído", "Master final validado.");
      preview.src = data.downloadUrl;
      downloadBtn.href = data.downloadUrl;
      resultCard.classList.remove("hidden");
      editBtn.disabled = false;
      break;
    }

    if (data.status === "failed") {
      throw new Error(data.error || "O processamento falhou.");
    }
  }
}

function setProgress(value, title, detail) {
  const safe = Math.max(0, Math.min(100, Number(value || 0)));
  progressBar.style.width = `${safe}%`;
  progressPercent.textContent = `${safe}%`;
  progressTitle.textContent = title;
  progressDetail.textContent = detail;
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B","KB","MB","GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(console.error);
  });
}
