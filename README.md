# CVision AI — Smart ATS Resume Analyzer & Optimizer

Un analizador y optimizador de currículums de última generación impulsado por inteligencia artificial y algoritmos heurísticos ATS, construido con **React 19**, **React Router v7**, **Tailwind CSS v4**, y **TypeScript**.

---

## ✨ Características Principales

- 📄 **Carga y Extracción de PDF Real**: Extracción automática de texto y renderizado de alta resolución con `pdfjs-dist`.
- ⚡ **Diagnóstico de Compatibilidad ATS**: Puntuación ponderada basada en estructura, densidad de métricas, verbos de acción y cobertura de competencias.
- 🎯 **Tracker de Palabras Clave Faltantes (Keyword Gap Analysis)**: Comparación en tiempo real entre los requerimientos de la oferta de trabajo y tu CV.
- ✨ **Reescritura de Viñetas con Fórmula de Google (XYZ)**: Sugerencias automatizadas para transformar responsabilidades pasivas en logros cuantificados (*"Logré [X], medido por [Y], haciendo [Z]"*).
- ✉️ **Generador de Carta de Presentación**: Redacción personalizada a medida para la empresa y puesto postulado, con opciones de copiado y descarga en `.txt`.
- 🖨️ **Exportador de Reportes**: Exportación e impresión limpia del informe de auditoría.
- 🌙 **Modo Oscuro / Claro**: Diseño moderno *Obsidian & Electric Indigo / Cyan* con persistencia de tema.
- ⚙️ **Soporte BYOK & Offline**: Funciona 100% privado y offline por defecto, con opción de conectar API Keys (Gemini, Groq) u Ollama local.
- 💾 **Persistencia 100% en el Navegador**: Almacenamiento seguro en `IndexedDB` y `localStorage` sin servidores externos obligatorios.

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

## 🚀 Inicio Rápido

### Requisitos previos
- [Node.js](https://nodejs.org/) (versión 18 o superior)
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

---

## 📦 Scripts Disponibles

- `npm run dev`: Inicia el servidor de desarrollo local.
- `npm run build`: Compila la aplicación para producción en modo SPA.
- `npm run typecheck`: Valida tipos de TypeScript y React Router typegen.
- `npm run start`: Inicia el servidor de producción.

---

## 📄 Licencia

Este proyecto está bajo la licencia MIT.
