
export async function onRequest(context) {
    const { request, next } = context;
    const url = new URL(request.url);

    // Only protect the catalog page
    if (url.pathname === "/catalog-5.html") {
        const cookieHeader = request.headers.get('Cookie') || '';
        const cookies = Object.fromEntries(cookieHeader.split('; ').map(c => c.split('=')));
        const sessionToken = cookies['auth_session'];

        if (!sessionToken) {
            return Response.redirect(`${url.origin}/login.html?returnUrl=catalog-5.html`, 302);
        }

        try {
            const sessionData = JSON.parse(atob(sessionToken));
            if (sessionData.exp < Date.now()) {
                return Response.redirect(`${url.origin}/login.html?returnUrl=catalog-5.html`, 302);
            }
        } catch (e) {
            return Response.redirect(`${url.origin}/login.html?returnUrl=catalog-5.html`, 302);
        }
    }

    return next();
}
