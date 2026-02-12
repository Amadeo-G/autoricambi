
export async function onRequestGet(context) {
    return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': 'auth_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
        }
    });
}
