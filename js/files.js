let files = [];

const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");

dropZone.addEventListener("dragover", e => {
    e.preventDefault();
    dropZone.classList.add("dragging");
});

dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragging");
});

dropZone.addEventListener("drop", e => {
    e.preventDefault();
    dropZone.classList.remove("dragging");
    uploadFiles([...e.dataTransfer.files]);
});

fileInput.addEventListener("change", () => {
    uploadFiles([...fileInput.files]);
    fileInput.value = "";
});

// Ping a tiny table so realtime fires for all browsers
// (Storage doesn't emit postgres_changes directly)
async function pingFileSignal() {
    await sb.from("file_signals").insert({ ts: new Date().toISOString() });
    // Keep the table small — delete old rows
    await sb.from("file_signals").delete().lt("id",  9999999);
}

async function uploadFiles(selectedFiles) {
    try {
        for (const file of selectedFiles) {
            const { error } =
                await sb.storage
                    .from("files")
                    .upload(file.name, file, { upsert: true });

            if (error) throw error;
        }

        await pingFileSignal();
        showToast("uploaded");

    } catch (err) {
        console.error(err);
        showToast("upload failed");
    }
}

async function deleteFile(encodedName) {
    const filename = decodeURIComponent(encodedName);

    try {
        const { error } =
            await sb.storage
                .from("files")
                .remove([filename]);

        if (error) throw error;

        await pingFileSignal();
        showToast("deleted");

    } catch (err) {
        console.error(err);
        showToast("delete failed");
    }
}

async function loadFiles() {
    try {
        const { data, error } =
            await sb.storage
                .from("files")
                .list("", { sortBy: { column: "created_at", order: "desc" } });

        if (error) throw error;

        files = data || [];
        renderFiles();

    } catch (err) {
        console.error(err);
    }
}

function fmtSize(b) {
    if (!b) return "";
    if (b < 1024) return b + " B";
    if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
    return (b / 1048576).toFixed(1) + " MB";
}

function renderFiles() {
    const fileList = document.getElementById("fileList");

    if (!files.length) {
        fileList.innerHTML = `<div class="empty">no files yet</div>`;
        return;
    }

    fileList.innerHTML = files.map(file => {
        const { data } = sb.storage.from("files").getPublicUrl(file.name);
        const size = fmtSize(file.metadata?.size);

        return `
            <div class="file-item">
                <span class="file-name">${escapeHtml(file.name)}</span>
                ${size ? `<span class="file-size">${size}</span>` : ""}
                <div class="file-actions">
                    <a class="btn-ghost"
                       href="${data.publicUrl}"
                       download="${escapeHtml(file.name)}">
                        download
                    </a>
                    <button class="btn-ghost danger"
                            onclick="deleteFile('${encodeURIComponent(file.name)}')">
                        delete
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

// Listen for file changes across browsers via signal table
sb.channel("file-signals")
    .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "file_signals" },
        () => loadFiles()
    )
    .subscribe();

loadFiles();
