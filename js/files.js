let files = [];

const dropZone =
    document.getElementById("dropZone");

const fileInput =
    document.getElementById("fileInput");

function generateId() {

    const chars =
        'abcdefghijklmnopqrstuvwxyz0123456789';

    let id = '';

    for (let i = 0; i < 5; i++) {
        id += chars[
            Math.floor(Math.random() * chars.length)
        ];
    }

    return id;
}

function fmtSize(b) {
    if (!b) return '';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
}

async function uploadFiles(selectedFiles) {

    try {

        for (const file of selectedFiles) {

            const id          = generateId();
            const timestamp   = Date.now();
            const storageName =
                `${timestamp}_${id}_${file.name}`;

            const { error: uploadErr } =
                await sb.storage
                    .from("files")
                    .upload(storageName, file, {
                        upsert: true
                    });

            if (uploadErr)
                throw uploadErr;

            const { error: regErr } =
                await sb
                    .from("file_registry")
                    .insert({
                        short_id:      id,
                        storage_name:  storageName,
                        original_name: file.name,
                        uid:           currentUid
                    });

            if (regErr) {
                await sb.storage
                    .from("files")
                    .remove([storageName]);
                throw regErr;
            }
        }

        await loadFiles();

        showToast("uploaded");

    } catch (err) {

        console.error(err);

        showToast("upload failed");
    }
}

async function deleteFile(encodedStorageName, registryId) {

    const storageName =
        decodeURIComponent(encodedStorageName);

    try {

        const { error: storageErr } =
            await sb.storage
                .from("files")
                .remove([storageName]);

        if (storageErr)
            throw storageErr;

        const { error: regErr } =
            await sb
                .from("file_registry")
                .delete()
                .eq("id", registryId);

        if (regErr)
            throw regErr;

        await loadFiles();

        showToast("deleted");

    } catch (err) {

        console.error(err);

        showToast("delete failed");
    }
}

async function downloadFile(url, encodedName) {

    const filename =
        decodeURIComponent(encodedName);

    try {

        const response = await fetch(url);

        if (!response.ok)
            throw new Error("Download failed");

        const blob      = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a         = document.createElement("a");

        a.href     = objectUrl;
        a.download = filename;

        document.body.appendChild(a);

        a.click();
        a.remove();

        URL.revokeObjectURL(objectUrl);

    } catch (err) {

        console.error(err);

        showToast("download failed");
    }
}


async function loadFiles() {

    try {

        const { data, error } =
            await sb
                .from("file_registry")
                .select("*")
                .eq("uid", currentUid)
                .order("created_at", { ascending: false });

        if (error)
            throw error;

        files = data || [];

        renderFiles();

    } catch (err) {

        console.error(err);

        showToast(err.message || 'load failed');
    }
}

function renderFiles() {

    const fileList =
        document.getElementById("fileList");

    if (!files.length) {

        fileList.innerHTML =
            `<div class="empty">no files yet</div>`;

        return;
    }

    fileList.innerHTML =
        files.map(file => {

            const { data } =
                sb.storage
                    .from("files")
                    .getPublicUrl(file.storage_name);

            return `
                <div class="file-item">

                    <span class="file-name">
                        ${escapeHtml(file.original_name)}
                    </span>

                    <span class="file-size">
                        ${fmtSize(file.metadata?.size)}
                    </span>

                    <div class="file-actions">

                        <button
                            class="btn-ghost"
                            onclick="downloadFile(
                                '${data.publicUrl}',
                                '${encodeURIComponent(file.original_name)}'
                            )"
                        >download</button>

                        <button
                            class="btn-ghost danger"
                            onclick="deleteFile(
                                '${encodeURIComponent(file.storage_name)}',
                                '${file.id}'
                            )"
                        >delete</button>

                    </div>

                </div>
            `;

        }).join("");
}


async function initFiles() {

    dropZone.addEventListener(
        "dragover",
        e => {
            e.preventDefault();
            dropZone.classList.add("dragging");
        }
    );

    dropZone.addEventListener(
        "dragleave",
        () => dropZone.classList.remove("dragging")
    );

    dropZone.addEventListener(
        "drop",
        e => {
            e.preventDefault();
            dropZone.classList.remove("dragging");
            uploadFiles([...e.dataTransfer.files]);
        }
    );

    fileInput.addEventListener(
        "change",
        () => uploadFiles([...fileInput.files])
    );

    await loadFiles();
}

if (sb) initFiles();
