const clipInput =
    document.getElementById("clipInput");

let clipboardEntries = [];

/*
 * Load clipboard history
 */
async function loadClipboard() {

    try {

        const { data, error } =
            await sb
                .from("clipboard")
                .select("*")
                .order(
                    "created_at",
                    { ascending: false }
                );

        if (error)
            throw error;

        clipboardEntries =
            data || [];

        renderClipboard();

    } catch (err) {

        console.error(err);

        showToast(
            "clipboard load failed"
        );
    }
}

/*
 * Save clipboard entry
 */
async function saveClipboard() {

    try {

        const value =
            clipInput.value.trim();

        if (!value)
            return;

        const { error } =
            await sb
                .from("clipboard")
                .insert({
                    content: value
                });

        if (error)
            throw error;

        clipInput.value = "";

        await loadClipboard();

        showToast("saved");

    } catch (err) {

        console.error(err);

        showToast("save failed");
    }
}

/*
 * Copy clipboard entry
 */
async function copyClip(id) {

    const item =
        clipboardEntries.find(
            x => x.id === id
        );

    if (!item)
        return;

    try {

        await navigator.clipboard
            .writeText(item.content);

        showToast("copied");

    } catch (err) {

        console.error(err);

        showToast("copy failed");
    }
}

/*
 * Delete clipboard entry
 */
async function deleteClip(id) {

    try {

        const { error } =
            await sb
                .from("clipboard")
                .delete()
                .eq("id", id);

        if (error)
            throw error;

        await loadClipboard();

        showToast("deleted");

    } catch (err) {

        console.error(err);

        showToast("delete failed");
    }
}

/*
 * Render clipboard list
 */
function renderClipboard() {

    const list =
        document.getElementById(
            "clipboardList"
        );

    if (!clipboardEntries.length) {

        list.innerHTML =
            `<div class="empty">
                no clips yet
            </div>`;

        return;
    }

    list.innerHTML =
        clipboardEntries.map(item => {

            const rendered =
                DOMPurify.sanitize(
                    marked.parse(item.content)
                );

            return `
                <div class="clipboard-item">

                    <div class="clipboard-text">
                        ${rendered}
                    </div>

                    <div class="clipboard-actions">

                        <button
                            class="btn-ghost"
                            onclick="copyClip(${item.id})"
                        >copy</button>

                        <button
                            class="btn-ghost"
                            onclick="deleteClip(${item.id})"
                        >delete</button>

                    </div>

                </div>
            `;

        }).join("");
}

document
.getElementById("saveClipBtn")
.addEventListener(
    "click",
    saveClipboard
);

document
.getElementById("clearClipBtn")
.addEventListener(
    "click",
    () => {
        clipInput.value = "";
    }
);

loadClipboard();