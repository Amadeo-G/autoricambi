
/**
 * Authentication Module
 * Manages user login and session using local storage and users.json (from Excel).
 */

export const auth = {
    /**
     * Attempts to log in a user.
     * First tries the API, falls back to local JSON check for static implementation.
     */
    async login(email, password) {
        try {
            // Optional: You can keep the fetch if you have a real backend in the future
            /*
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            if (response.ok) { ... }
            */

            // Local Implementation (Excel-based)
            const response = await fetch(`/src/js/users.json?t=${Date.now()}`);
            if (!response.ok) {
                console.error('Fetch error:', response.status, response.statusText);
                return { success: false, error: `No se pudo conectar con la base de datos (${response.status}).` };
            }

            const users = await response.json();

            // Find user in standardized JSON
            const user = users.find(u =>
                (u.email?.toString().toLowerCase() === email.toLowerCase()) &&
                (u.password?.toString() === password.toString())
            );

            if (user) {
                const userData = {
                    email: user.email,
                    name: user.name || user.email.split('@')[0], // Use 'name' if exists, else prefix
                    role: 'client'
                };
                localStorage.setItem('user', JSON.stringify(userData));
                return { success: true };
            } else {
                return { success: false, error: 'Usuario o contraseña incorrectos.' };
            }
        } catch (err) {
            console.error('Auth Error:', err);
            return { success: false, error: 'Error de conexión. Por favor, verifica que los cambios se hayan subido al servidor.' };
        }
    },

    /**
     * Logs out the current user.
     */
    async logout() {
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    },

    /**
     * Checks if a user is currently logged in.
     */
    async getCurrentUser() {
        const userJson = localStorage.getItem('user');
        if (!userJson) return null;
        try {
            return JSON.parse(userJson);
        } catch (e) {
            localStorage.removeItem('user');
            return null;
        }
    },

    /**
     * Protects a page by redirecting to login if not authenticated.
     */
    async checkAuth() {
        const user = await this.getCurrentUser();
        if (!user) {
            const currentPath = window.location.pathname;
            // Get the last part of the path, removing trailing slash if exists
            const pathParts = currentPath.split('/').filter(p => p);
            const lastPart = pathParts[pathParts.length - 1] || 'index.html';

            // Check if we are already on login page to avoid loops
            if (!lastPart.includes('login.html')) {
                // If we are in a virtual path like /buscador/REF, redirect correctly to root login
                window.location.href = `/login.html?returnUrl=${encodeURIComponent(currentPath)}`;
            }
        }
        return user;
    }
};

// Global exposure
window.auth = auth;
