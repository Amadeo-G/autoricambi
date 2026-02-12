
# Gestión de Clientes (Segura con Workers) - Autoricambi

He migrado el sistema a **Cloudflare Pages Functions (Workers)**. Ahora los datos de los clientes están protegidos en el servidor y nunca se envían al navegador a menos que las credenciales sean correctas.

## Cómo agregar tus 200 clientes (MODO SEGURO)

Para agregar los clientes, ahora debes editar el archivo ubicado en:
`functions/api/users.js`

Este archivo **NO** es accesible desde internet, solo lo usa el servidor para validar el inicio de sesión.

El formato sigue siendo el mismo:

```javascript
export const users = [
    {
        email: "correo@delcliente.com",
        password: "contraseña123",
        name: "Nombre del Cliente"
    },
    // ...
];
```

## Mejoras de Seguridad Realizadas

1. **Server-Side Auth**: La validación de contraseña ocurre en el servidor de Cloudflare.
2. **HttpOnly Cookies**: La sesión se guarda en una cookie especial que los scripts de "hackers" (XSS) no pueden leer.
3. **Middleware de Protección**: He configurado un "guardián" (`functions/_middleware.js`) que verifica la sesión antes siquiera de entregar el archivo `catalog-5.html`. Si no hay sesión válida, Cloudflare corta el acceso y redirige al login.
4. **Sin exposición de datos**: He eliminado el archivo `src/js/users.js` que exponía a todos tus clientes anteriormente.

## Próximos Pasos en Cloudflare Dashboard

Para una seguridad máxima, deberías configurar variables de entorno si planeas usar secretos reales, pero para una lista de 200 usuarios, editando el archivo `users.js` en el servidor es una solución muy sólida y profesional.

---
*Tu anterior sistema de localStorage ha sido reemplazado por esta arquitectura de nivel empresarial.*
