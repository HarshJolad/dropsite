if (sb) {

let files = [];

const dropZone =
    document.getElementById("dropZone");

const fileInput =
    document.getElementById("fileInput");

/*
 * Generate 5-char alphanumeric short ID
 */
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

        dropZone.classList.remove("dragging");

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
 *
 * Uploads to flat storage path, then writes a row to file_registry
 * with the uid from the verified JWT. If the registry insert fails
 * (e.g. Supabase rejects the JWT signature), the storage upload is
 * rolled back.
 */
async function uploadFiles(selectedFiles) {

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
                // Roll back the storage upload on registry failure
                await sb.storage
                    .from("files")
                    .remove([storageName]);
                throw regErr;
            }
        }

        await pingFileSignal();
        showToast("uploaded");

    } catch (err) {
        console.error(err);

        showToast("upload failed");
    }
}

/*
 * Delete File — removes from storage and file_registry
 */
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

        if (error) throw error;

        await pingFileSignal();
        showToast("deleted");

    } catch (err) {
        console.error(err);

        showToast("delete failed");
    }
}

/*
 * Download File
 */
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

/*
 * Copy share link to clipboard
 */
function copyLink(url) {

    navigator.clipboard
        .writeText(url)
        .then(() => showToast("link copied"))
        .catch(() => showToast("copy failed"));
}

/*
 * Load Files — queries file_registry (RLS scopes to currentUid)
 */
async function loadFiles() {
    try {
        const { data, error } =
            await sb
                .from("file_registry")
                .select("*")
                .order("created_at", { ascending: false });

        if (error)
            throw error;

        files = data || [];

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

            const shareUrl =
                `${window.location.origin}/${file.short_id}`;

            return `
                <div class="file-item">

                    <span class="file-name">
                        ${escapeHtml(file.original_name)}
                    </span>

                    <div class="file-actions">

                        <button
                            class="btn-ghost"
                            onclick="copyLink('${shareUrl}')"
                        >link</button>

                        <button
                            class="btn-ghost"
                            onclick="downloadFile(
                                '${data.publicUrl}',
                                '${encodeURIComponent(file.original_name)}'
                            )"
                        >download</button>

                        <button
                            class="btn-ghost"
                            onclick="deleteFile(
                                '${encodeURIComponent(file.storage_name)}',
                                '${file.id}'
                            )"
                        >delete</button>

                    </div>

                </div>
            </div>
        `;
    }).join("");
}

/*
 * Cleanup expired files (>2h old) for the current user
 */
async function cleanupExpiredFiles() {

    try {

        const twoHoursAgo =
            new Date(
                Date.now() - 2 * 60 * 60 * 1000
            ).toISOString();

        const { data, error } =
            await sb
                .from("file_registry")
                .select("id, storage_name")
                .lt("created_at", twoHoursAgo);

        if (error)
            throw error;

        if (!data || !data.length)
            return;

        const storageNames = data.map(f => f.storage_name);
        const ids          = data.map(f => f.id);

        await sb.storage
            .from("files")
            .remove(storageNames);

        await sb
            .from("file_registry")
            .delete()
            .in("id", ids);

        console.log(
            `Deleted ${data.length} expired files`
        );

    } catch (err) {

        console.error(err);
    }
}

(async () => {

    const pathMatch =
        window.location.pathname.match(
            /^\/([a-z0-9]{5})$/
        );

    await cleanupExpiredFiles();

    await loadFiles();

    if (pathMatch) {

        const [, targetId] = pathMatch;

        const target =
            files.find(f => f.short_id === targetId);

        if (target) {

            const { data } =
                sb.storage
                    .from("files")
                    .getPublicUrl(target.storage_name);

            showToast(
                `downloading ${target.original_name}`
            );

            await downloadFile(
                data.publicUrl,
                encodeURIComponent(target.original_name)
            );

        } else {

            showToast("file not found");
        }
    }

})();

} // end if (sb)
