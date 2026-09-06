# Proxy de IA (Power Automate / Azure Function)

El asistente de planificaciones (`VITE_AI_PROVIDER=proxy`) envía `{ messages, options }`
a una URL y espera la respuesta `{ content }`. Esta guía explica dos formas de montar ese
proxy de forma segura, **sin exponer la clave de la API en el navegador**.

| Opción | Esfuerzo | Mantenimiento | Recomendada para |
| --- | --- | --- | --- |
| **A. Azure Function** | Medio (desplegar código) | Bajo | Uso en producción a largo plazo |
| **B. Power Automate** | Bajo (sin código) | Medio | Pruebas y flujos sencillos |

> Nota sobre "Copilot": **Microsoft 365 Copilot Chat no ofrece una API pública** para este
> uso. Para el generador de planificaciones use **Azure OpenAI**, **OpenAI** o **DeepSeek**.
> Azure OpenAI se integra naturalmente con el entorno Microsoft 365 del colegio.

---

## Contrato del proxy

**Petición (lo que envía la intranet):**
```json
{
  "messages": [
    { "role": "system", "content": "…prompt MINERD…" },
    { "role": "user", "content": "Genera una planificación…" }
  ],
  "options": { "temperature": 0.4, "maxTokens": 2048, "jsonMode": true }
}
```

**Respuesta esperada:**
```json
{ "content": "…respuesta de texto del modelo (JSON de la planificación)…" }
```

---

## Opción A — Azure Function (recomendado)

El código ya está en la carpeta **`proxy-ai/`** del repositorio (`src/functions/aiProxy.mjs`).
Soporta `openai`, `deepseek`, `anthropic` y `azure`.

### 1. Prueba local (opcional)

```bash
cd proxy-ai
npm install
copy local.settings.json.example local.settings.json   # complete AI_API_KEY
npm start            # http://localhost:7071/api/ai
```

Prueba rápida:
```powershell
Invoke-RestMethod -Method POST -Uri http://localhost:7071/api/ai `
  -ContentType 'application/json' `
  -Body '{"messages":[{"role":"user","content":"Di hola en una palabra"}]}'
```

### 2. Desplegar en Azure

Opción **VS Code + extensión "Azure Functions"** (lo más cómodo):

1. Instale la extensión **Azure Functions** y **Azure Tools**.
2. Abra la carpeta `proxy-ai/`, pulse **F1 → "Azure Functions: Create Function App in Azure"**.
   - Runtime **Node.js 24**, región cercana (p. ej. *East US 2*), plan **Consumption**, SO **Windows**.
3. En la vista **Azure → Functions**, despliegue (`Deploy to Function App`).
4. En el Function App en Azure Portal → **Configuración → Variables de entorno**, agregue:
   - `AI_PROVIDER` = `deepseek` (o `openai` / `azure`)
   - `AI_API_KEY` = la clave del proveedor (se guarda del servidor, no en el navegador)
   - `AI_BASE_URL` = `https://api.deepseek.com` (o `https://api.openai.com/v1`)
   - `AI_MODEL` = `deepseek-chat` (o `gpt-4o-mini`, etc.)
5. En el Function App → **CORS**, agregue:
   - `http://localhost:5173` (desarrollo)
   - `https://<nombre>.azurestaticapps.net` (producción)
6. Copie la URL: `https://<function>.azurewebsites.net/api/ai`.

### 3. Conectar la intranet

En `.env` (desarrollo) y `.env.production`:
```env
VITE_AI_PROVIDER=proxy
VITE_AI_API_URL=https://<function>.azurewebsites.net/api/ai
```

---

## Opción B — Power Automate

Flujo "sin código". El desencadenador HTTP guarda la clave dentro del propio flujo.

### 1. Desencadenador

Cree un flujo con el desencadenador **"Cuando se recibe una solicitud HTTP"** (`Request`).

- Método: **POST**.
- *Esquema JSON del cuerpo de la solicitud de ejemplo*:
```json
{
  "type": "object",
  "properties": {
    "messages": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "role": { "type": "string" },
          "content": { "type": "string" }
        },
        "required": ["role", "content"]
      }
    },
    "options": {
      "type": "object",
      "properties": {
        "temperature": { "type": "number" },
        "maxTokens": { "type": "integer" },
        "jsonMode": { "type": "boolean" }
      }
    }
  }
}
```

### 2. Llamada al proveedor (acción HTTP)

Agregue la acción **"HTTP"** (conector *HTTP*, requiere licencia premium en el entorno).

- **Método:** `POST`
- **URI:** `https://api.deepseek.com/chat/completions`
  - (OpenAI: `https://api.openai.com/v1/chat/completions` · Azure OpenAI: `https://<recurso>.openai.azure.com/openai/deployments/<modelo>/chat/completions?api-version=2024-06-01`)
- **Encabezados:**
  - `Content-Type`: `application/json`
  - `Authorization`: `Bearer <CLAVE>` (para Azure OpenAI use `api-key`: `<CLAVE>`)
- **Cuerpo:** pase a **modo código** (ícono `</>` ) y pegue:
```text
concat('{"model":"deepseek-chat","messages":', string(triggerBody()?['messages']), ',"temperature":', string(coalesce(triggerBody()?['options']?['temperature'], 0.6)), ',"max_tokens":', string(coalesce(triggerBody()?['options']?['maxTokens'], 2048)), '}')
```

### 3. Analizar la respuesta

Agregue **"Analizar JSON"** (`Parse JSON`) con el **Cuerpo** de la acción HTTP y este esquema:
```json
{
  "type": "object",
  "properties": {
    "choices": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "message": {
            "type": "object",
            "properties": { "content": { "type": "string" } }
          }
        }
      }
    }
  }
}
```

### 4. Responder a la intranet

Agregue la acción **"Respuesta"** (`Response`):

- **Código de estado:** `200`
- **Cuerpo** (modo código):
```text
concat('{"content":', string(outputs('Analizar_JSON')?['body']?['choices']?[0]?['message']?['content']), '}')
```

### 5. Conectar la intranet

Copie la URL del desencadenador (se muestra al guardar el flujo) y configure:
```env
VITE_AI_PROVIDER=proxy
VITE_AI_API_URL=https://prod-XX.westus.logic.azure.com:443/workflows/.../triggers/manual/paths/invoke?...
```

---

## Seguridad

- **Nunca** ponga la clave en `VITE_AI_API_KEY` para producción: todo lo `VITE_*` queda en el
  bundle del navegador.
- En la Azure Function use **variables de entorno** del Function App (o Key Vault).
- En Power Automate, la clave vive solo en el conector HTTP del flujo.
- Restrinja el acceso: en la Azure Function puede añadir autenticación de **Entra ID** y en el
  flujo el desencadenador HTTP ya va protegido por su URL firmada (`sig`).
