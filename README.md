# Huma.io

MVP de Huma.io - Una landing page minimalista con un chat widget que simula una conversación real.

## Características

- Landing page ultra-minimalista con diseño "Clean White"
- Chat integrado estilo Slack/WhatsApp
- Estado de "Escribiendo..." para simular respuesta humana
- Integración con Google Generative AI (Gemini 1.5 Flash)
- Personalidad de agente configurada (Huma)

## Configuración

1. Instala las dependencias:
```bash
npm install
```

2. Crea un archivo `.env.local` en la raíz del proyecto:
```
GOOGLE_GENERATIVE_AI_API_KEY=tu_api_key_de_google_generative_ai
```

3. Ejecuta el servidor de desarrollo:
```bash
npm run dev
```

4. Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## Stack Tecnológico

- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Google Generative AI SDK (@google/generative-ai)

