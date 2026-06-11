const COOKIE_KEY = 'drop_token';

/*
 * Cookie helpers
 */
function getCookie(name) {

    const m = document.cookie.match(
        new RegExp('(?:^|;\\s*)' + name + '=([^;]*)')
    );

    return m ? decodeURIComponent(m[1]) : null;
}

/*
 * Decode JWT payload without verifying signature.
 * Supabase verifies the signature on every request —
 * if the token is forged, the request is rejected there.
 */
function decodeJwt(token) {

    try {

        const b64 = token
            .split('.')[1]
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        return JSON.parse(atob(b64));

    } catch {

        return null;
    }
}

/*
 * Plant empty cookie key so the user can see it in DevTools.
 * They set the value manually: DevTools → Application → Cookies.
 */
const rawToken = getCookie(COOKIE_KEY);

if (rawToken === null) {
    document.cookie =
        `${COOKIE_KEY}=; path=/; SameSite=Strict`;
}

/*
 * Initialize Supabase client with JWT injected into every request.
 * Supabase PostgREST + Storage both pick up the Authorization header
 * and verify the signature against the project JWT secret.
 * RLS policies then enforce uid-scoped access.
 */
let currentUid = null;
let sb = null;

if (rawToken) {

    const claims = decodeJwt(rawToken);

    if (claims && claims.uid) {

        currentUid = claims.uid;

        sb = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_ANON_KEY,
            {
                global: {
                    headers: {
                        Authorization: `Bearer ${rawToken}`
                    }
                },
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false,
                }
            }
        );
    }
}

/*
 * Show gate if no valid token, reveal app if valid.
 */
const gateEl = document.getElementById('gate');
const appEl  = document.getElementById('appRoot');

if (sb) {
    gateEl.classList.add('hidden');
    appEl.classList.remove('hidden');
} else {
    gateEl.classList.remove('hidden');
    appEl.classList.add('hidden');
}
