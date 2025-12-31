import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Falta API KEY' }, { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
    
    let text = "";
    let errorLog = "";

    const body = await request.json();
    const messages = body.messages || [];
    const lastMessage = messages[messages.length - 1];
    const userContent = lastMessage?.content || "";
    const trimmedContent = userContent.trim();

    // Silencio inicial: Si el input está vacío
    if (!trimmedContent || trimmedContent.length === 0) {
      return NextResponse.json({ 
        message: '¡Hola! 👋 ¿Qué empresa o URL tenemos en el radar hoy? 🎯',
        content: '¡Hola! 👋 ¿Qué empresa o URL tenemos en el radar hoy? 🎯'
      });
    }

    // Detectar si es el primer mensaje del usuario (solo empresa/URL) o una pregunta específica
    const isURL = /^https?:\/\//i.test(trimmedContent);
    // Es primer mensaje si solo hay 1 mensaje (el del usuario) o si el anterior era del asistente con cards
    const userMessages = messages.filter((m: any) => m.role === 'user');
    const isFirstMessage = userMessages.length === 1;
    
    // Detectar comandos específicos de los botones iniciales (más específico)
    const lowerContent = trimmedContent.toLowerCase();
    const isAnalyzeURL = lowerContent.includes('analizar url') || 
                         lowerContent.includes('fallas en su web') ||
                         lowerContent.includes('analizar fallas') ||
                         (lowerContent.includes('analizar') && lowerContent.includes('web'));
    const isBriefCEO = lowerContent.includes('brief para el ceo') || 
                      lowerContent.includes('gancho para linkedin') ||
                      (lowerContent.includes('gancho') && lowerContent.includes('linkedin')) ||
                      (lowerContent.includes('brief') && lowerContent.includes('ceo'));
    const isDetectFriction = lowerContent.includes('detectar fricción') || 
                            lowerContent.includes('detectar friccion') ||
                            lowerContent.includes('perdiendo plata') ||
                            lowerContent.includes('dolores operativos') ||
                            (lowerContent.includes('detectar') && lowerContent.includes('friccion')) ||
                            (lowerContent.includes('detectar') && lowerContent.includes('fricción'));
    
    // Detectar si es una pregunta específica
    const isQuestion = trimmedContent.includes('?') || 
                      /^(qué|quien|cómo|cuál|cuando|dónde|por qué|qué|quién)/i.test(trimmedContent) ||
                      (trimmedContent.toLowerCase().includes('investigar') && !isAnalyzeURL) ||
                      trimmedContent.toLowerCase().includes('buscar') ||
                      trimmedContent.toLowerCase().includes('cuéntame') ||
                      trimmedContent.toLowerCase().includes('dime');

    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({ 
          model: modelName,
          tools: [{ google_search: {} }] as any 
        });
        
        let prompt = '';

        if (isFirstMessage && !isQuestion) {
          // Primer mensaje: solo empresa/URL → mostrar validación + cards con preguntas de investigación
          prompt = `SOS HUMA. Sos un estratega de ventas B2B DIVERTIDO y CONVERSACIONAL. NO sos Wikipedia.

EMPRESA/URL: ${trimmedContent}

INSTRUCCIONES CRÍTICAS (OBLIGATORIO GENERAR CARDS):
1. Buscá información sobre esta empresa usando Google Search
2. SI encontrás MÚLTIPLES empresas con el mismo nombre en diferentes países:
   - PRIMERO escribí: "Encontré varias empresas con ese nombre 🤔 ¿Cuál querés investigar?"
   - LUEGO generá EXACTAMENTE 3 cards con las opciones (OBLIGATORIO):
   - [CARD_1]: [Nombre Empresa] | [País] - [Rubro breve]
   - [CARD_2]: [Nombre Empresa] | [País] - [Rubro breve]
   - [CARD_3]: [Nombre Empresa] | [País] - [Rubro breve]
   - Ejemplo:
   - [CARD_1]: Invera | Argentina - Fintech B2B
   - [CARD_2]: Invera | México - SaaS Retail
   - [CARD_3]: Invera | España - E-commerce Platform
   
3. SI encontrás UNA SOLA empresa o está CLARO cuál es:
   - PRIMERO validá con: "¿Investigando a **[Empresa]** de **[País]**, dedicada al rubro **[Rubro]**? ⚡"
   - LUEGO generá EXACTAMENTE 3 cards con preguntas BREVES para investigar (OBLIGATORIO):
   - [CARD_1]: Título Corto | Pregunta breve para investigar
   - [CARD_2]: Título Corto | Pregunta breve para investigar
   - [CARD_3]: Título Corto | Pregunta breve para investigar

EJEMPLO SI HAY AMBIGÜEDAD:
Encontré varias empresas con ese nombre 🤔 ¿Cuál querés investigar?
[CARD_1]: Invera Argentina | Argentina - Fintech B2B
[CARD_2]: Invera México | México - SaaS para retail
[CARD_3]: Invera España | España - E-commerce platform

EJEMPLO SI ESTÁ CLARO:
¿Investigando a **Invera** de **Argentina**, dedicada al rubro **Fintech B2B**? ⚡
[CARD_1]: Expansión | ¿En qué países están expandiéndose?
[CARD_2]: Tech | ¿Qué problemas tienen con sus APIs?
[CARD_3]: CEO | ¿Quién es el CEO y su LinkedIn?

REGLAS CRÍTICAS:
- SIEMPRE generá cards [CARD_X] - es OBLIGATORIO
- Máximo 2-3 líneas antes de las cards
- Cards deben ser BREVES (máximo 8 palabras)
- Usá emojis para hacerlo más divertido
- NO escribas párrafos largos
- Solo validación + 3 cards. NADA MÁS.`;
        } else {
          // Mensajes siguientes: responder la pregunta específica del usuario
          const conversationHistory = messages
            .slice(-8) // Últimos 8 mensajes para contexto
            .map((msg: any) => `${msg.role === 'user' ? 'Usuario' : 'Huma'}: ${msg.content}`)
            .join('\n');

          // Detectar el contexto del comando
          let contextInstruction = '';
          
          if (isAnalyzeURL) {
            contextInstruction = `COMANDO ESPECÍFICO: El usuario quiere ANALIZAR LA URL/WEB de una empresa para encontrar FALLAS, problemas de UX, errores técnicos, o puntos débiles en su sitio web.
            
TU TAREA:
- Pedile la URL si no la tiene en el contexto
- Si ya tiene la URL o empresa en el contexto, analizá su web buscando:
  * Problemas de UX/UI
  * Errores técnicos
  * Falta de información clave
  * Problemas de conversión
  * Falta de claridad en el mensaje
- Sé específico y breve (máximo 3-4 líneas)
- Usá emojis 🎯 🔍 💥`;
          } else if (isBriefCEO) {
            contextInstruction = `COMANDO ESPECÍFICO: El usuario quiere un BRIEF PARA CONTACTAR AL CEO, específicamente necesita un GANCHO para LinkedIn.
            
TU TAREA:
- Si no tenés info del CEO en el contexto, buscá quién es el CEO y su LinkedIn
- Armá un gancho (hook) para LinkedIn que sea:
  * Directo y personalizado
  * Basado en un trigger real (noticia, cambio, problema)
  * Sin signos de apertura (¿ o ¡)
  * Máximo 15 palabras
- Si ya tenés info del CEO, generá el gancho directamente
- Sé breve y específico (máximo 3-4 líneas)
- Usá emojis 👤 🎯 ⚡`;
          } else if (isDetectFriction) {
            // Buscar si hay empresa mencionada en el contexto
            const empresaMencionada = conversationHistory.match(/\*\*([^*]+)\*\*/)?.[1] || 
                                     conversationHistory.match(/empresa[:\s]+([^\n]+)/i)?.[1] ||
                                     '';
            
            contextInstruction = `COMANDO CRÍTICO: El usuario quiere DETECTAR FRICCIÓN - dónde la empresa está PERDIENDO PLATA o tiene DOLORES OPERATIVOS.

${empresaMencionada ? `EMPRESA A ANALIZAR: ${empresaMencionada}` : 'EMPRESA: Buscá en el contexto de la conversación'}

TU TAREA ESPECÍFICA (NO hagas otra cosa):
1. Si NO tenés el nombre de la empresa en el contexto, preguntá: "¿Qué empresa querés que analice? 💸"
2. Si YA tenés el nombre de la empresa, BUSCÁ específicamente:
   - Dónde están PERDIENDO DINERO (costos altos, ineficiencias)
   - DOLORES OPERATIVOS (procesos manuales, falta de automatización)
   - Problemas de ESCALABILIDAD
   - Fricciones en su EMBUDO DE VENTAS
   - Costos altos de ADQUISICIÓN de clientes
   - Problemas de RETENCIÓN

RESPONDE ASÍ:
"Encontré que [EMPRESA] tiene estos dolores: [problema específico 1] 💸, [problema específico 2] 🔥. ¿Querés que profundice en alguno?"

PROHIBIDO:
- NO describas qué hace la empresa (eso ya lo sabemos)
- NO expliques su modelo de negocio
- NO escribas párrafos largos
- SOLO busca DOLORES OPERATIVOS y FRICCIONES FINANCIERAS

Máximo 3-4 líneas. Usá emojis 💸 🔥 💰 ⚠️`;
          }

          prompt = `SOS HUMA. Sos un estratega de ventas B2B DIVERTIDO y CONVERSACIONAL. NO sos Wikipedia.

CONTEXTO:
${conversationHistory}

${contextInstruction || `PREGUNTA DEL USUARIO: ${trimmedContent}`}

TU ESTILO DE RESPUESTA:
- BREVE: máximo 3-4 líneas. NO párrafos largos.
- CONVERSACIONAL: escribí como si estuvieras chateando con un colega
- CON EMOJIS: usá ⚡ 🎯 💡 🔥 🚀 👤 💰 📊 para hacerlo más divertido
- INTERACTIVO: si necesitás clarificar algo, preguntá
- ESPECÍFICO: respondé directo a la pregunta/comando, sin rodeos
- SIN REPETICIONES: NO repitas información que ya mencionaste antes

EJEMPLOS DE RESPUESTAS BUENAS:
"Encontré que están en México y Uruguay 🚀 ¿Querés que profundice en alguno?"
"El CEO es Juan Pérez, LinkedIn: /in/juanperez 👤 ¿Te armo un gancho para contactarlo?"
"No encontré info sobre eso 💡 ¿Tenés algún dato adicional?"

EJEMPLOS DE RESPUESTAS MALAS (NO HAGAS ESTO):
"La empresa fue fundada en 2015 y se dedica a... [párrafo largo tipo Wikipedia]"
"Según los datos disponibles, podemos observar que... [explicación larga]"

REGLAS CRÍTICAS:
- Máximo 3-4 líneas por respuesta
- Usá emojis para hacerlo más divertido
- Preguntá para clarificar si hay ambigüedad
- NO escribas como Wikipedia o ChatGPT
- NO generes cards [CARD_X] en respuestas a preguntas
- NO repitas información ya mencionada
- NO escribas la misma respuesta dos veces
- Si ya respondiste algo, NO lo vuelvas a decir
- Si el comando es "Detectar fricción", NO describas qué hace la empresa, SOLO busca dolores operativos y pérdidas de dinero
- Si el comando es "Analizar URL", NO describas la empresa, SOLO analiza fallas en la web
- Si el comando es "Brief CEO", NO describas la empresa, SOLO busca el CEO y arma el gancho`;
        }
        
        

        const result = await model.generateContent(prompt);
        let rawText = result.response.text();
        
        // Verificar que se generaron cards si es el primer mensaje
        if (isFirstMessage && !isQuestion && rawText && !rawText.includes('[CARD_')) {
          // Si no hay cards, forzar la generación de cards por defecto
          const empresaMatch = rawText.match(/\*\*([^*]+)\*\*/);
          const empresa = empresaMatch ? empresaMatch[1] : trimmedContent;
          
          rawText = `${rawText}

[CARD_1]: Expansión | ¿En qué países están expandiéndose?
[CARD_2]: Tech Stack | ¿Qué problemas tienen con su tecnología?
[CARD_3]: CEO | ¿Quién es el CEO y cómo contactarlo?`;
        }
        
        // Post-procesamiento: eliminar duplicaciones y asegurar que sea breve
        if (rawText) {
          // Limpiar espacios múltiples y saltos de línea
          rawText = rawText.replace(/\s+/g, ' ').trim();
          
          // Detectar si hay respuestas duplicadas o muy similares
          // Dividir por oraciones completas
          const sentences = rawText.split(/[.!?]\s+/).filter(s => s.trim().length > 0);
          const uniqueSentences: string[] = [];
          const seenContent = new Set<string>();
          
          for (const sentence of sentences) {
            const normalized = sentence.trim().toLowerCase()
              .replace(/[^\w\s]/g, '') // Remover puntuación
              .replace(/\s+/g, ' '); // Normalizar espacios
            
            // Verificar similitud (si más del 60% de las palabras coinciden, es duplicado - más estricto)
            let isDuplicate = false;
            const seenArray = Array.from(seenContent);
            for (const seen of seenArray) {
              const words1 = normalized.split(' ').filter((w: string) => w.length > 2); // Bajar threshold a 2 caracteres
              const words2 = seen.split(' ').filter((w: string) => w.length > 2);
              
              if (words1.length === 0 || words2.length === 0) continue;
              
              const commonWords = words1.filter((w: string) => words2.includes(w));
              const similarity = commonWords.length / Math.max(words1.length, words2.length);
              
              // También verificar si las primeras palabras son iguales (indica repetición)
              const firstWordsMatch = words1.slice(0, 3).some(w => words2.slice(0, 3).includes(w));
              
              if (similarity > 0.6 || (firstWordsMatch && similarity > 0.5)) {
                isDuplicate = true;
                break;
              }
            }
            
            if (!isDuplicate && normalized.length > 5) {
              seenContent.add(normalized);
              uniqueSentences.push(sentence.trim());
            }
          }
          
          text = uniqueSentences.join('. ').trim();
          
          // Si quedó vacío, usar el texto original pero limitado
          if (!text || text.length < 10) {
            text = rawText.substring(0, 300).trim();
          }
          
          // Limitar longitud si es muy larga (excepto si tiene cards)
          if (!text.includes('[CARD_') && text.length > 400) {
            const limitedSentences = uniqueSentences.slice(0, 3);
            text = limitedSentences.join('. ').trim();
            if (!text.endsWith('.') && !text.endsWith('?') && !text.endsWith('!')) {
              text += '.';
            }
          }
          
          // Verificar que no sea muy similar a CUALQUIER mensaje del asistente anterior
          const assistantMessages = messages.filter((m: any) => m.role === 'assistant');
          
          if (assistantMessages.length > 0) {
            const normalizedResponse = text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
            const wordsResponse = normalizedResponse.split(' ').filter((w: string) => w.length > 3);
            
            // Comparar con los últimos 3 mensajes del asistente
            for (const assistantMsg of assistantMessages.slice(-3)) {
              const normalizedLast = assistantMsg.content.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
              const wordsLast = normalizedLast.split(' ').filter((w: string) => w.length > 3);
              const commonWords = wordsResponse.filter((w: string) => wordsLast.includes(w));
              const similarity = commonWords.length / Math.max(wordsResponse.length, wordsLast.length);
              
              // Si es más del 60% similar, usar solo la primera oración única (más estricto)
              if (similarity > 0.6) {
                // Intentar encontrar oraciones que no estén en el mensaje anterior
                const lastSentences = assistantMsg.content.split(/[.!?]\s+/).map((s: string) => s.toLowerCase().trim());
                const newSentences = sentences.filter((s: string) => {
                  const sLower = s.toLowerCase().trim();
                  return !lastSentences.some((last: string) => {
                    const sWords = sLower.replace(/[^\w\s]/g, '').split(' ').filter((w: string) => w.length > 3);
                    const lastWords = last.replace(/[^\w\s]/g, '').split(' ').filter((w: string) => w.length > 3);
                    const common = sWords.filter((w: string) => lastWords.includes(w));
                    return common.length / Math.max(sWords.length, lastWords.length) > 0.6;
                  });
                });
                
                if (newSentences.length > 0) {
                  text = newSentences.slice(0, 1).join('. ').trim();
                } else {
                  // Si no hay oraciones nuevas, usar solo la primera oración del texto original
                  text = sentences[0]?.trim() || text.substring(0, 100).trim();
                }
                break;
              }
            }
          }
        }
        
        if (text) break; 
      } catch (e: any) {
        errorLog += `[${modelName}]: ${e.message}. `;
        continue;
      }
    }

    if (!text) throw new Error("Google bloqueó todos los modelos. " + errorLog);

    return NextResponse.json({ message: text, content: text });

  } catch (error: any) {
    return NextResponse.json({ 
      error: "Huma tuvo un problema de conexión",
      details: error.message
    }, { status: 429 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'POST ONLY' }, { status: 405 });
}