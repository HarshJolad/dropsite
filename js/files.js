let files = [];

const dropZone =
    document.getElementById("dropZone");

const fileInput =
    document.getElementById("fileInput");

/*
 * Drag & Drop
 */
dropZone.addEventListener(
    "dragover",
    e => {
        e.preventDefault();
        dropZone.classList.add("dragging");
    }
);

dropZone.addEventListener(
    "dragleave",
    () => {
        dropZone.classList.remove("dragging");
    }
);

dropZone.addEventListener(
    "drop",
    e => {

        e.preventDefault();

        dropZone.classList.remove(
            "dragging"
        );

        uploadFiles(
            [...e.dataTransfer.files]
        );
    }
);

fileInput.addEventListener(
    "change",
    () => {
        uploadFiles(
            [...fileInput.files]
        );
    }
);

/*
 * Upload Files
 */
async function uploadFiles(
    selectedFiles
) {

    try {

        for (const file of selectedFiles) {

            const filename = Date.now() + "_" + file.name;

            const { error } =
                await sb.storage
                    .from("files")
                    .upload(
                        filename,
                        file,
                        {
                            upsert: true
                        }
                    );

            if (error)
                throw error;
        }

        await loadFiles();

        showToast("uploaded");

    } catch (err) {

        console.error(err);

        showToast(
            "upload failed"
        );
    }
}

/*
 * Delete File
 */
async function deleteFile(
    encodedName
) {

    const filename =
        decodeURIComponent(
            encodedName
        );

    try {

        const { error } =
            await sb.storage
                .from("files")
                .remove([
                    filename
                ]);

        if (error)
            throw error;

        await loadFiles();

        showToast("deleted");

    } catch (err) {

        console.error(err);

        showToast(
            "delete failed"
        );
    }
}

/*
 * Download File
 */
async function downloadFile(
    url,
    encodedName
) {

    const filename =
        decodeURIComponent(
            encodedName
        );

    try {

        const response =
            await fetch(url);

        if (!response.ok)
            throw new Error(
                "Download failed"
            );

        const blob =
            await response.blob();

        const objectUrl =
            URL.createObjectURL(blob);

        const a =
            document.createElement("a");

        a.href = objectUrl;
        a.download = filename;

        document.body.appendChild(a);

        a.click();

        a.remove();

        URL.revokeObjectURL(
            objectUrl
        );

    } catch (err) {

        console.error(err);

        showToast(
            "download failed"
        );
    }
}

/*
 * Load Files
 */
async function loadFiles() {

    try {

        const { data, error } =
            await sb.storage
                .from("files")
                .list();

        if (error)
            throw error;

        files =
            (data || [])
            .sort((a, b) =>
                a.name.localeCompare(
                    b.name
                )
            );

        renderFiles();

    } catch (err) {

        console.error(err);
    }
}

/*
 * Render Files
 */
function renderFiles() {

    const fileList =
        document.getElementById(
            "fileList"
        );

    if (!files.length) {

        fileList.innerHTML =
            `<div class="empty">
                no files yet
            </div>`;

        return;
    }

    fileList.innerHTML =
        files.map(file => {

            const { data } =
                sb.storage
                    .from("files")
                    .getPublicUrl(
                        file.name
                    );

            return `
                <div class="file-item">

                    <span class="file-name">
                        ${escapeHtml(file.name)}
                    </span>

                    <div class="file-actions">

                        <button
                            class="btn-ghost"
                            onclick="downloadFile(
                                '${data.publicUrl}',
                                '${encodeURIComponent(file.name)}'
                            )"
                        >
                            download
                        </button>

                        <button
                            class="btn-ghost"
                            onclick="deleteFile(
                                '${encodeURIComponent(file.name)}'
                            )"
                        >
                            delete
                        </button>

                    </div>

                </div>
            `;

        }).join("");
}


async function cleanupExpiredFiles() {

    try {

        const { data, error } =
            await sb.storage
                .from("files")
                .list();

        if (error)
            throw error;

        const now = Date.now();

        const expired = [];

        for (const file of data) {

            const timestamp =
                parseInt(
                    file.name.split("_")[0]
                );

            if (
                !isNaN(timestamp) &&
                now - timestamp >
                (2 * 60 * 60 * 1000)
            ) {
                expired.push(file.name);
            }
        }

        if (expired.length) {

            await sb.storage
                .from("files")
                .remove(expired);

            console.log(
                `Deleted ${expired.length} expired files`
            );
        }

    } catch (err) {

        console.error(err);
    }
}

(async () => {

    await cleanupExpiredFiles();

    await loadFiles();

})();