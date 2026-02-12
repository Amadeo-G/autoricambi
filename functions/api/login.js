
import { users } from './users.js';

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const { email, password } = await request.json();
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);

        if (!user) {
            return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // In a real production environment, you would use a secure JWT or a session ID in KV.
        // For this implementation, we'll create a simple session token (base64 encoded user info)
        // and set it as an HttpOnly cookie to prevent JS access (XSS protection).

        const sessionData = {
            email: user.email,
            name: user.name,
            exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        };

        const sessionToken = btoa(JSON.stringify(sessionData));

        return new Response(JSON.stringify({ success: true, user: { name: user.name, email: user.email } }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Set-Cookie': `auth_session=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`
            }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Error en el servidor' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
