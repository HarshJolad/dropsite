const clipInput =
    document.getElementById("clipInput");

let clipboardEntries = [];

/*
 * Load clipboard history (RLS scopes to currentUid automatically)
 */
async function loadClipboard() {
    try {
        const { data, error } =
            await sb
                .from("clipboard")
                .select("*")
                .eq("uid", currentUid)
                .order(
                    "created_at",
                    { ascending: false }
                );

        if (error) throw error;

        clipboardEntries = data || [];
        renderClipboard();

    } catch (err) {
        console.error(err);

        showToast(err.message || 'clipboard load failed');
    }
}

/*
 * Save clipboard entry — uid written explicitly so Supabase RLS
 * can enforce it matches auth.jwt()->>'uid' on insert
 */
async function saveClipboard() {
    const value = clipInput.value.trim();
    if (!value) return;

    try {
        const { error } =
            await sb
                .from("clipboard")
                .insert({
                    content: value,
                    uid:     currentUid
                });

        if (error) throw error;

        clipInput.value = "";
        showToast("saved");

    } catch (err) {
        console.error(err);
        showToast("save failed");
    }
}

/*
 * Copy raw markdown source to clipboard
 */
async function copyClip(id) {
    const item = clipboardEntries.find(x => x.id === id);
    if (!item) return;

    try {
        await navigator.clipboard.writeText(item.content);
        showToast("copied");
    } catch (err) {
        console.error(err);
        showToast("copy failed");
    }
}

async function deleteClip(id) {
    try {
        const { error } =
            await sb
                .from("clipboard")
                .delete()
                .eq("id", id);

        if (error) throw error;

        showToast("deleted");

    } catch (err) {
        console.error(err);
        showToast("delete failed");
    }
}

/*
 * Render clipboard list with markdown
 */
function renderClipboard() {

    const list =
        document.getElementById("clipboardList");

    if (!clipboardEntries.length) {

        list.innerHTML =
            `<div class="empty">no clips yet</div>`;

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

function initClipboard() {

    document
        .getElementById("saveClipBtn")
        .addEventListener("click", saveClipboard);

    document
        .getElementById("clearClipBtn")
        .addEventListener(
            "click",
            () => { clipInput.value = ""; }
        );

    loadClipboard();
}

if (sb) initClipboard();
