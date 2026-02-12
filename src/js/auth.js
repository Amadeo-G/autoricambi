
/**
 * Authentication Module (Workers Version)
 * Uses secure HttpOnly cookies and server-side validation.
 */

export const auth = {
    /**
     * Attempts to log in a user via the API.
     */
    async login(email, password) {
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (response.ok) {
                const data = await response.json();
                // We still cache the user info for UI purposes, but the SECURE check is on the server.
                localStorage.setItem('user', JSON.stringify(data.user));
                return { success: true };
            } else {
                const error = await response.json();
                return { success: false, error: error.error || 'Error de autenticación' };
            }
        } catch (err) {
            return { success: false, error: 'Ocurrió un error al conectar con el servidor.' };
        }
    },

    /**
     * Logs out the current user via the API.
     */
    async logout() {
        await fetch('/api/logout');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    },

    /**
     * Checks if a user is currently logged in via the API.
     */
    async getCurrentUser() {
        try {
            const response = await fetch('/api/user');
            if (response.ok) {
                const data = await response.json();
                if (data.user) {
                    localStorage.setItem('user', JSON.stringify(data.user));
                    return data.user;
                }
            }
            localStorage.removeItem('user');
            return null;
        } catch (e) {
            return JSON.parse(localStorage.getItem('user'));
        }
    }
};

// Global exposure
window.auth = auth;
