const COOKIE_KEY = 'drop_token';

function getCookie(name) {
    const m = document.cookie.match(
        new RegExp('(?:^|;\\s*)' + name + '=([^;]*)')
    );
    return m ? decodeURIComponent(m[1]) : null;
}

const gateEl = document.getElementById('gate');
const appEl  = document.getElementById('appRoot');

function showGate(err) {
    if (err)
        document.getElementById('gateError').textContent = err;
    gateEl.style.display = 'flex';
    appEl.style.display  = 'none';
}

function showApp() {
    gateEl.style.display = 'none';
    appEl.style.display  = 'flex';
}

const savedPassword = getCookie(COOKIE_KEY);

let currentUid = null;
let sb         = null;

if (savedPassword) {
    currentUid = savedPassword;
    sb = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        {
            global: {
                headers: {
                    'x-user-uid': savedPassword
                }
            }
        }
    );
    showApp();
} else {
    showGate();
}

document
    .getElementById('gateSubmit')
    .addEventListener('click', async () => {

        const btn = document.getElementById('gateSubmit');
        const val =
            document
                .getElementById('gatePasswordInput')
                .value;

        if (val.length !== 8) {
            showGate('password must be 8 characters');
            return;
        }

        btn.disabled    = true;
        btn.textContent = '...';

        const check = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_ANON_KEY
        );

        const { data } = await check
            .from('allowed_uids')
            .select('uid')
            .eq('uid', val)
            .single();

        btn.disabled    = false;
        btn.textContent = 'enter';

        if (!data) {
            showGate('invalid password');
            return;
        }

        document.cookie =
            `${COOKIE_KEY}=${encodeURIComponent(val)}; path=/; SameSite=Strict; max-age=31536000`;

        window.location.reload();
    });

document
    .getElementById('gatePasswordInput')
    .addEventListener('keydown', e => {
        if (e.key === 'Enter')
            document.getElementById('gateSubmit').click();
    });
