const clipInput = document.getElementById("clipInput");

let clipboardEntries = [];

async function loadClipboard() {
    try {
        const { data, error } =
            await sb
                .from("clipboard")
                .select("*")
                .order("created_at", { ascending: false });

        if (error) throw error;

        clipboardEntries = data || [];
        renderClipboard();

    } catch (err) {
        console.error(err);
        showToast("clipboard load failed");
    }
}

async function saveClipboard() {
    const value = clipInput.value.trim();
    if (!value) return;

    try {
        const { error } =
            await sb
                .from("clipboard")
                .insert({ content: value });

        if (error) throw error;

        clipInput.value = "";
        showToast("saved");

    } catch (err) {
        console.error(err);
        showToast("save failed");
    }
}

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

function renderClipboard() {
    const list = document.getElementById("clipboardList");

    if (!clipboardEntries.length) {
        list.innerHTML = `<div class="empty">no clips yet</div>`;
        return;
    }

    list.innerHTML = clipboardEntries.map(item => `
        <div class="clipboard-item">
            <span class="clipboard-text">${escapeHtml(item.content)}</span>
            <div class="clipboard-actions">
                <button class="btn-ghost" onclick="copyClip(${item.id})">copy</button>
                <button class="btn-ghost danger" onclick="deleteClip(${item.id})">delete</button>
            </div>
        </div>
    `).join("");
}

// Ctrl+Enter to save
clipInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) saveClipboard();
});

document.getElementById("saveClipBtn").addEventListener("click", saveClipboard);
document.getElementById("clearClipBtn").addEventListener("click", () => {
    clipInput.value = "";
});

// Real-time subscription
sb.channel("clipboard-changes")
    .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clipboard" },
        () => loadClipboard()
    )
    .subscribe();

loadClipboard();
