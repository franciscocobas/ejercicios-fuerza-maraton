# Fuerza Para Correr

PWA de entrenamiento de fuerza diseñada para corredores. Guía al usuario por dos rutinas de fuerza (A y B), con temporizadores, descansos cronometrados, historial de entrenamientos y racha de días.

## Funcionalidades

- **Dos rutinas de 3 rondas:**
  - Rutina A — Fuerza básica (sentadilla, estocada inversa, puente de glúteos, plancha, elevación de pantorrillas)
  - Rutina B — Fuerza unilateral (sentadilla búlgara, peso muerto a una pierna, plancha lateral, marcha de glúteos, sentadilla isométrica, superman)
- Temporizador visual (SVG animado) para ejercicios de plancha
- Descanso cronometrado entre series (60 s) y entre rondas (90 s)
- Racha de días de entrenamiento
- Historial sincronizado entre dispositivos vía Firebase Firestore
- Login con Google (Firebase Auth)
- Instalable como PWA (service worker + manifest)
- Sonidos de feedback con Web Audio API (sin archivos externos)

## Tecnología

| Capa | Detalle |
|------|---------|
| Frontend | HTML + CSS + JavaScript vanilla |
| Auth | Firebase Authentication (Google) |
| Base de datos | Firebase Firestore |
| Hosting | Firebase Hosting |
| CI/CD | GitHub Actions (deploy automático en push a `main`) |

## Estructura

```
├── index.html      # Pantallas: login, home, workout, rest, done
├── script.js       # Lógica de la app y conexión a Firebase
├── style.css       # Estilos
├── sw.js           # Service worker (caché offline)
├── manifest.json   # PWA manifest
├── firebase.json   # Configuración de Firebase Hosting
└── icons/          # Íconos de la PWA
```

## Desarrollo local

```bash
# Servir con cualquier servidor estático, por ejemplo:
npx serve .
# o
python3 -m http.server
```

La app funciona en `localhost` — el dominio está habilitado en Firebase Auth.

## Deploy

El deploy a Firebase Hosting se realiza automáticamente vía GitHub Actions al hacer push a `main`. Requiere el secret `FIREBASE` con el token de servicio de Firebase.

URL de producción: https://ejercicios-casa.web.app
