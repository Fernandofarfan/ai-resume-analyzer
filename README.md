# CVision AI — Smart ATS Resume Analyzer & Optimizer

[![CI](https://github.com/Fernandofarfan/ai-resume-analyzer/actions/workflows/ci.yml/badge.svg)](https://github.com/Fernandofarfan/ai-resume-analyzer/actions/workflows/ci.yml)

Un analizador y optimizador de currículums de última generación impulsado por algoritmos heurísticos ATS e inteligencia artificial, construido con **React 19**, **React Router v7**, **Tailwind CSS v4**, y **TypeScript**.

---

## ✨ Características Principales

- 📄 **Carga y Extracción de PDF Real**: Extracción automática de texto y renderizado de alta resolución con `pdfjs-dist`.
- ⚡ **Diagnóstico de Compatibilidad ATS**: Puntuación ponderada basada en estructura, densidad de métricas, verbos de acción y cobertura de competencias.
- 🎯 **Tracker de Palabras Clave Faltantes (Keyword Gap Analysis)**: Comparación real entre los requerimientos de la oferta de trabajo y tu CV.
- ✨ **Reescritura de Viñetas con Fórmula de Google (XYZ)**: Sugerencias con placeholders para transformar responsabilidades pasivas en logros cuantificados.
- ✉️ **Generador de Carta de Presentación**: Redacción basada en las competencias detectadas en tu CV, con opciones de copiado y descarga en `.txt`.
- 🖨️ **Exportador de Reportes**: Exportación e impresión limpia del informe de auditoría.
- 🌙 **Modo Oscuro / Claro**: Diseño moderno _Obsidian & Electric Indigo / Cyan_ con persistencia de tema.
- 🔐 **Claves de IA solo en el servidor**: Gemini/Groq/Ollama se configuran en el servidor; ninguna credencial llega al navegador.
- 💾 **Persistencia local en el navegador**: Almacenamiento en `IndexedDB` y `localStorage` (local al dispositivo, sin servidores externos obligatorios).

---

## 🔒 Privacidad y seguridad

- Las **claves de API** de los proveedores de IA se leen **únicamente desde el servidor** (`server/config.mjs`) a través de variables de entorno sin prefijo `VITE_`. Nunca se incluyen en el bundle del navegador.
- El endpoint `/api/analyze` aplica **rate limiting** (por IP, ventana deslizante y cuota diaria), **presupuesto global diario**, **límite de concurrencia**, **timeout** en las llamadas a proveedores, validación del tamaño del prompt y rechazo de orígenes cruzados. Además exige **consentimiento explícito** antes de reenviar el CV a un proveedor remoto (fail closed). Para una app pública, protege el endpoint con autenticación real mediante un reverse proxy (cookie `HttpOnly`, OAuth, etc.).
- El análisis se realiza por defecto con el **motor heurístico local** (`AI_PROVIDER=offline`), por lo que el CV **no sale de tu dispositivo**.
- Si activas un proveedor remoto (Gemini/Groq), el contenido de tu CV y la oferta laboral **se envían a ese proveedor** para generar el análisis. La aplicación solicita un **consentimiento explícito** antes de hacerlo.
- Los datos se guardan en el **almacenamiento local del navegador** (`IndexedDB` y `localStorage`). Este almacenamiento **no está cifrado** y es accesible para cualquier script que se ejecute en el mismo origen; no debe considerarse un almacenamiento seguro. La opción de eliminación borra tanto los metadatos como los archivos binarios.

---

## 🛠️ Stack Tecnológico

- **Frontend**: [React 19](https://react.dev/)
- **Enrutamiento**: [React Router v7 (SPA Mode)](https://reactrouter.com/)
- **Estilos**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Gestión de Estado**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Motor de PDF**: [PDF.js (pdfjs-dist)](https://mozilla.github.io/pdf.js/)
- **Empaquetador**: [Vite](https://vite.dev/)
- **Lenguaje**: [TypeScript](https://www.typescriptlang.org/)

---

## 🔐 Configuración de Variables de Entorno (`.env`)

Copia el archivo `.env.example` a `.env` y configura el motor de IA que prefieras:

```bash
cp .env.example .env
```

Contenido del archivo `.env`:

```env
# Proveedor de IA: "offline", "gemini", "groq", o "ollama"
AI_PROVIDER=offline

# Clave de API de Google Gemini (si AI_PROVIDER=gemini)
GEMINI_API_KEY=

# Clave de API de Groq (si AI_PROVIDER=groq)
GROQ_API_KEY=

# Configuración de Ollama Local (si AI_PROVIDER=ollama)
OLLAMA_ENDPOINT=http://localhost:11434
OLLAMA_MODEL=llama3
```

> ⚠️ **Importante**: estas variables las lee el servidor. No uses el prefijo `VITE_` para ninguna credencial.

Los proveedores remotos requieren arrancar el servidor incluido (`npm run build && npm start`). En desarrollo (`npm run dev`) se usa el motor heurístico local.

---

## 🚀 Inicio Rápido

### Requisitos previos

- [Node.js](https://nodejs.org/) (versión 22 o superior)
- [npm](https://www.npmjs.com/)

### Instalación

1. Clona el repositorio:

    ```bash
    git clone <URL_DEL_REPOSITORIO>
    cd ai-resume-analyzer
    ```

2. Instala las dependencias:

    ```bash
    npm install
    ```

3. Inicia el servidor de desarrollo:

    ```bash
    npm run dev
    ```

4. Abre [http://localhost:5173](http://localhost:5173) en tu navegador.

### Producción

```bash
npm run build
npm start
```

`npm start` levanta un servidor Node que sirve la SPA y expone el endpoint seguro de IA en `/api/analyze`.

---

## 🐳 Docker

```bash
docker build -t cvision-ai .
docker run -p 3000:3000 --env-file .env cvision-ai
```

---

## 📦 Scripts Disponibles

- `npm run dev`: Inicia el servidor de desarrollo local.
- `npm run build`: Compila la aplicación para producción en modo SPA.
- `npm run start`: Inicia el servidor de producción (sirve la SPA + API de IA).
- `npm run typecheck`: Genera los tipos de React Router y valida TypeScript.
- `npm run lint`: ESLint + verificación de formato + `check:server` + `check:docker-config` + `typecheck`.
- `npm run lint:fix`: Aplica las correcciones automáticas de ESLint y Prettier.
- `npm run format` / `npm run format:check`: Formatea / verifica el formato del código.
- `npm run test`: Ejecuta las pruebas unitarias, de almacenamiento e integración (Vitest).
- `npm run test:coverage`: Ejecuta la suite con informe de cobertura (`coverage/`).
- `npm run check:server`: Comprueba la sintaxis de los módulos del servidor (`server/*.mjs`).
- `npm run check:docker-config`: Valida que el `Dockerfile` y los scripts de arranque sean coherentes.

---

## 🧱 Arquitectura

- `server/index.mjs`: servidor HTTP (rutas, estáticos, `healthz`, `/api/analyze`).
- `server/config.mjs`: variables de entorno, validación y cabeceras de seguridad (CSP).
- `server/ai.mjs`: adaptadores de proveedores de IA, reintentos y circuit breakers.
- `app/lib/storage/`: persistencia en IndexedDB dividida en `idb`, `blobs`, `resumes`, `backups` y `gc`.
- `app/lib/hooks/useResumeList.ts`: lógica de listado/gestion de CVs consumida por `app/routes/home.tsx`.
- `shared/`: tipos y validaciones compartidos entre cliente y servidor.

---

## 📄 Licencia

Este proyecto está bajo la licencia MIT.
