
export async function onRequestGet(context) {
    const { request } = context;
    const cookieHeader = request.headers.get('Cookie') || '';
    const cookies = Object.fromEntries(cookieHeader.split('; ').map(c => c.split('=')));
    const sessionToken = cookies['auth_session'];

    if (!sessionToken) {
        return new Response(JSON.stringify({ user: null }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const sessionData = JSON.parse(atob(sessionToken));

        // Check expiration
        if (sessionData.exp < Date.now()) {
            return new Response(JSON.stringify({ user: null }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Set-Cookie': 'auth_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
                }
            });
        }

        return new Response(JSON.stringify({ user: { name: sessionData.name, email: sessionData.email } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ user: null }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
