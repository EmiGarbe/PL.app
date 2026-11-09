import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

import {
  Company,
  ComparisonDoc,
  ComparisonItem,
  ComparisonDifferences,
  PriceConvenienceAnalysis,
  AiConclusion,
  ExtractedProposalData,
  ExtractedConcept,
  ProposalSummary,
} from './types.js';

const ai = new GoogleGenAI({
  apiKey: "AQ.Ab8RN6IkZU2Wgrgw9HwOoy6_Xbdv_nlmJzWlgkTZ6nfwIF5ysg",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

function parseCleanJson<T>(rawText: string, fallback: T): T {
  try {
    let clean = rawText.trim();
    if (clean.startsWith('```json')) {
      clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (clean.startsWith('```')) {
      clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    return JSON.parse(clean) as T;
  } catch (err) {
    console.error('Failed to parse Gemini JSON output:', err, '\nRaw text was:\n', rawText);
    return fallback;
  }
}

/**
 * Executes a Gemini request with automatic fast execution using gemini-3.1-flash-lite
 * and fallback to gemini-3.8-flash.
 */
async function generateWithRetry(params: any): Promise<any> {
  const primaryModel = params.model || 'gemini-3.1-flash-lite';
  const modelsToTry = [
    primaryModel,
    primaryModel === 'gemini-3.1-flash-lite' ? 'gemini-3.8-flash' : 'gemini-3.1-flash-lite',
  ];

  let lastError: any = null;

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const config = { ...params.config };
        if (model === 'gemini-3.8-flash') {
          config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
        } else {
          delete config.thinkingConfig;
        }

        const res = await ai.models.generateContent({
          ...params,
          model,
          config,
        });

        if (res && res.text) {
          return res;
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || '';
        const isTransient =
          errMsg.includes('503') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('high demand') ||
          errMsg.includes('429') ||
          errMsg.includes('RESOURCE_EXHAUSTED') ||
          errMsg.includes('fetch failed');

        if (isTransient) {
          console.warn(`[Gemini] ${model} experimentó alta demanda. Cambiando a modelo alternativo...`);
          await new Promise(r => setTimeout(r, 800));
          break; // Switch to next model in list immediately
        }
        throw err;
      }
    }
  }

  throw lastError;
}

/**
 * Prepares the Part to send to Gemini:
 * - If it's a PDF or image, sends as inlineData with raw base64.
 * - If text or other formats, sends as text Part.
 */
function prepareDocumentPart(doc: ComparisonDoc): { inlineData: { mimeType: string; data: string } } | { text: string } {
  if (doc.fileData && typeof doc.fileData === 'string' && doc.fileData.trim().length > 0) {
    let mimeType = doc.mimeType || 'application/pdf';
    let base64Data = doc.fileData;

    // If it's a data URL, e.g. "data:application/pdf;base64,JVBERi0..."
    if (base64Data.includes(',')) {
      const parts = base64Data.split(',');
      const match = parts[0].match(/:(.*?);/);
      if (match && match[1]) {
        mimeType = match[1];
      }
      base64Data = parts[1];
    }

    // Clean whitespace
    base64Data = base64Data.trim().replace(/\s/g, '');

    // Supported inline MIME types in Gemini 3.8 Flash
    const isPdfOrImage =
      mimeType === 'application/pdf' ||
      mimeType.startsWith('image/');

    if (isPdfOrImage && base64Data.length > 50) {
      return {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      };
    } else {
      // Decode text-based base64 (txt, csv, markdown, etc.)
      try {
        const textContent = Buffer.from(base64Data, 'base64').toString('utf-8');
        return {
          text: `[CONTENIDO COMPLETO DEL ARCHIVO "${doc.name}"]:\n${textContent}`,
        };
      } catch {
        return {
          text: `[DOCUMENTO "${doc.name}"]: ${doc.summary || ''}`,
        };
      }
    }
  }

  // Fallback if summary exists
  return {
    text: `[DOCUMENTO "${doc.name}"]: ${doc.summary || 'Sin contenido de archivo adjunto.'}`,
  };
}

/**
 * Stage 1: Reads a real PDF/document with Gemini 3.8 Flash and extracts structured data.
 * Reads ALL pages, tables, amounts, quantities, units, specifications, and citations.
 */
export async function extractDocumentDataWithGemini(
  doc: ComparisonDoc,
  companyName: string,
  isPliego: boolean = false
): Promise<ExtractedProposalData> {
  const docPart = prepareDocumentPart(doc);

  const extractionPrompt = `
Eres un Ingeniero y Auditor Experto en Análisis Técnico y Económico de Licitaciones, Pliegos y Presupuestos.
Tu tarea es leer y procesar de punta a punta este documento real: "${doc.name}".
Tipo de documento: ${isPliego ? 'PLIEGO / SOLICITUD ORIGINAL DEL COMITENTE' : `PROPUESTA / PRESUPUESTO DE LA EMPRESA "${companyName}"`}.

REGLAS ESTRICTAS DE LECTURA:
1. Lee TODAS las páginas del documento: textos, cuadros, tablas de cómputo y presupuesto, membretes, notas al pie, anexos técnicos y cláusulas comerciales.
2. Si el documento es un PDF escaneado o imagen, usa reconocimiento visual OCR para extraer con fidelidad importes y descripciones.
3. NO INVENTES DATOS. Si un importe, plazo, unidad o condición no figura en el documento, indícalo expresamente como "NO INFORMADO" o deja el campo numérico en null.
4. Si no puedes determinar con certeza si un trabajo está incluido o excluido debido a redacción ambigua, asígnale status "pendiente_validacion".
5. Identifica SIEMPRE el número de página o sección exacta del documento donde aparece cada dato (ej: "Pág. 1", "Pág. 4 - Tabla 2.1").
6. Extrae TODOS los conceptos o rubros cotizados (trabajos civiles, estructurales, mecánicos, eléctricos, materiales, mano de obra, equipos, ensayos, seguros, exclusiones).

Estructura de respuesta requerida (JSON ÚNICAMENTE):
{
  "companyName": "${companyName}",
  "documentTitle": "${doc.name}",
  "totalPrice": {
    "amount": 0, // número sin signos ni comas (o null si no figura)
    "currency": "USD" | "ARS" | "EUR" | "OTRA",
    "text": "Texto exacto del total (ej: USD 825.000 sin IVA)",
    "pageNumber": "Pág. X"
  },
  "executionTimeframe": {
    "text": "Texto del plazo (ej: 18 semanas a partir del anticipo)",
    "daysOrWeeks": "18 semanas" // o días
    "pageNumber": "Pág. X"
  },
  "warranty": {
    "text": "Garantía ofrecida (ej: 24 meses sobre equipos y montajes)",
    "pageNumber": "Pág. X"
  },
  "commercialConditions": {
    "paymentTerms": "Condición de pago (ej: 20% anticipo, certificaciones mensuales)",
    "validityDays": "Validez de la oferta (ej: 30 días)",
    "advancePayment": "Anticipo requerido (ej: 20%)",
    "pageNumber": "Pág. X"
  },
  "concepts": [
    {
      "id": "c-1",
      "concept": "Nombre claro del trabajo, material o rubro cotizado",
      "description": "Descripción técnica detallada o extracto textual de lo ofrecido",
      "category": "precio" | "trabajos" | "materiales" | "equipamiento" | "plazos" | "garantias" | "condiciones" | "exclusiones" | "otro",
      "quantity": "Cantidad (ej: 1.800) o null si es global",
      "unit": "Unidad (ej: m2, ml, kg, un, gl) o null",
      "unitPrice": "Precio unitario con moneda o null",
      "totalPrice": "Precio total del ítem con moneda o null",
      "technicalSpecs": "Especificaciones técnicas (marcas, modelos, normas, calidades)",
      "status": "incluido" | "no_incluido" | "parcial" | "mejora" | "no_informado" | "pendiente_validacion",
      "observations": "Observaciones relevantes, omisiones o advertencias",
      "pageNumber": "Pág. X"
    }
  ],
  "rawSummary": "Resumen fáctico de 2 a 3 oraciones con el alcance global y aspectos clave de la propuesta."
}
`;

  try {
    const contents: any[] = [docPart, { text: extractionPrompt }];

    const response = await generateWithRetry({
      model: 'gemini-3.1-flash-lite',
      contents,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = parseCleanJson<Partial<ExtractedProposalData>>(response.text ?? '{}', {});

    const result: ExtractedProposalData = {
      documentId: doc.id,
      companyId: doc.companyId,
      companyName: parsed.companyName || companyName,
      documentTitle: doc.name,
      totalPrice: parsed.totalPrice || { text: 'No informado', pageNumber: 'No especificada' },
      executionTimeframe: parsed.executionTimeframe || { text: 'No informado', pageNumber: 'No especificada' },
      warranty: parsed.warranty || { text: 'No informada', pageNumber: 'No especificada' },
      commercialConditions: parsed.commercialConditions || { paymentTerms: 'No informada', pageNumber: 'No especificada' },
      concepts: Array.isArray(parsed.concepts)
        ? parsed.concepts.map((c, idx) => ({
            id: c.id || `concept-${idx + 1}`,
            concept: c.concept || 'Concepto no especificado',
            description: c.description || '',
            category: c.category || 'trabajos',
            quantity: c.quantity || null,
            unit: c.unit || null,
            unitPrice: c.unitPrice || null,
            totalPrice: c.totalPrice || null,
            technicalSpecs: c.technicalSpecs || '',
            status: c.status || 'no_informado',
            observations: c.observations || '',
            pageNumber: c.pageNumber || 'Pág. s/d',
          }))
        : [],
      rawSummary: parsed.rawSummary || 'Documento procesado correctamente.',
      processedAt: new Date().toISOString(),
    };

    return result;
  } catch (err: any) {
    console.error(`Error processing document "${doc.name}" with Gemini:`, err);
    throw new Error(`No se pudo leer el archivo "${doc.name}". ${err.message || ''}`);
  }
}

/**
 * Stage 2: Cross-Proposal Comparative Matrix Synthesis.
 * Compares the real extracted proposals from all participating companies,
 * builds the summary cards, the single comparison matrix, the key differences,
 * the price-to-scope evaluation, and the grounded AI recommendation.
 */
export async function synthesizeProposalsComparison(
  title: string,
  description: string,
  companies: Company[],
  extractedProposals: ExtractedProposalData[],
  pliegoDoc?: ComparisonDoc
): Promise<{
  proposalSummaries: ProposalSummary[];
  items: ComparisonItem[];
  differences: ComparisonDifferences;
  priceAnalysis: PriceConvenienceAnalysis;
  conclusion: AiConclusion;
}> {
  // Format structured extraction per company
  const proposalsFormatted = companies.map(comp => {
    const compProposals = extractedProposals.filter(p => p.companyId === comp.id);
    const combinedConcepts = compProposals.flatMap(p => p.concepts);
    const firstProp = compProposals[0];

    return `
========================================================================
EMPRESA: "${comp.name}" (ID: ${comp.id})
Dirección: ${comp.address}
Antecedentes: ${comp.yearsInBusiness ? `${comp.yearsInBusiness} años de trayectoria.` : 'Trayectoria no informada.'}
Reputación: ${comp.reputation || 'No informada.'}
Relación previa: ${comp.previousRelationship || 'Sin antecedentes directos.'} (Obras anteriores con nosotros: ${comp.pastProjectsCount ?? 0})
Observaciones: ${comp.observations || 'Sin observaciones.'}

RESUMEN DE PROPUESTA EXTRAÍDO DEL DOCUMENTO:
- Precio Total: ${firstProp?.totalPrice?.text || 'No informado'} (Página: ${firstProp?.totalPrice?.pageNumber || 's/d'})
- Plazo de Ejecución: ${firstProp?.executionTimeframe?.text || 'No informado'} (Página: ${firstProp?.executionTimeframe?.pageNumber || 's/d'})
- Garantía: ${firstProp?.warranty?.text || 'No informada'} (Página: ${firstProp?.warranty?.pageNumber || 's/d'})
- Condiciones Comerciales: ${firstProp?.commercialConditions?.paymentTerms || 'No informadas'} (Página: ${firstProp?.commercialConditions?.pageNumber || 's/d'})

CONCEPTOS EXTRAÍDOS DEL PRESUPUESTO (${combinedConcepts.length} ítems):
${combinedConcepts
  .map(
    (c, idx) =>
      `${idx + 1}. [${c.category.toUpperCase()}] "${c.concept}": ${c.description || ''} | Estado: ${c.status} | Cantidad: ${c.quantity || '-'} ${c.unit || ''} | P.Unit: ${c.unitPrice || '-'} | P.Total: ${c.totalPrice || '-'} | Specs: ${c.technicalSpecs || '-'} | Ref: ${c.pageNumber || 's/d'}`
  )
  .join('\n')}
========================================================================
`;
  }).join('\n\n');

  const pliegoContext = pliegoDoc?.extractedData
    ? `
INFORMACIÓN DEL PLIEGO ORIGINAL:
${pliegoDoc.extractedData.rawSummary || ''}
Conceptos solicitados en pliego:
${pliegoDoc.extractedData.concepts.map(c => `- ${c.concept} (${c.technicalSpecs || ''})`).join('\n')}
`
    : '';

  const synthesisPrompt = `
Eres un Ingeniero y Auditor de Licitaciones.
Debes realizar la comparación final y síntesis técnica-económica para la obra o proyecto: "${title}".
Descripción de la obra: "${description || 'Sin descripción adicional'}".

${pliegoContext}

PROPUESTAS REALES EXTRAÍDAS DE CADA EMPRESA:
${proposalsFormatted}

REQUERIMIENTOS INNEGOCIABLES:
1. CONSTRUCCIÓN DE LA MATRIZ COMPARATIVA (items):
   - Cada fila representa un concepto, trabajo, equipo, material o condición evaluada.
   - Las columnas son las empresas participantes.
   - Debe incluir obligatoriamente filas para: "Precio Total Ofertado", "Plazo Total de Ejecución", "Garantía Técnica", "Condiciones y Anticipo de Pago", seguidas por todos los trabajos, materiales y especificaciones técnicas relevantes encontrados en las propuestas.
   - Para cada celda asigna:
     * status: "incluido" (✓), "no_incluido" (✕), "parcial" (◐), "mejora" (★), "pendiente_validacion" (⏳) o "no_informado" (?).
     * displayValue: valor sintético y legible (ej: "USD 825.000", "18 semanas", "✓ Incluido", "✕ No incluido", "24 meses").
     * detail: detalle textual de lo que ofrece o excluye la empresa en este concepto.
     * price: precio del ítem si figura.
     * quantity: cantidad y unidad si figura.
     * technicalSpecs: especificaciones técnicas (marcas, normas, espesores).
     * sourceDoc: nombre del documento de donde se extrajo.
     * sourcePage: página exacta donde figura en el PDF.
2. RESUMEN DE PROPUESTAS (proposalSummaries):
   - Una tarjeta por empresa con: companyId, companyName, totalPriceText, executionTimeframeText, warrantyText, conceptsCount.
3. DIFERENCIAS IMPORTANTES (keyDifferences):
   - Una lista BREVE, PRECISA y DIRECTA de viñetas con las diferencias esenciales que impactan en la decisión (ejemplos: "Empresa A incluye instalación eléctrica; Empresa B no la contempla.", "Empresa C ofrece una garantía superior de 3 años.", "Empresa B presenta un plazo de ejecución menor de 18 semanas.", "Empresa A incluye materiales y grúa que Empresa C cotiza por separado.").
   - NO repetir toda la matriz. Destacar solo lo relevante.
4. PRECIO Y CONVENIENCIA (priceAnalysis):
   - lowestPriceCompany, highestPriceCompany, priceSpread.
   - scopeAnalysis: análisis crítico de si el precio más bajo es realmente el más conveniente o si omitió trabajos obligatorios que obligarán a pagar sobrecostos.
   - bestValueAssessment: qué empresa ofrece más valor real por el dinero invertido.
5. CONCLUSIÓN Y RECOMENDACIÓN FUNDAMENTADA (conclusion):
   - cheapestProposal: cuál es la más económica (nominal y real con alcances).
   - mostCompleteProposal: cuál es la más completa técnica y documentalmente.
   - bestConditions: cuál presenta mejores plazos, garantías y forma de pago.
   - priceDifferencesJustification: qué diferencias técnicas o de alcance justifican la dispersión de precios.
   - groundedRecommendation: conclusión fundamentada para el responsable de contratación explicando cuál alternativa conviene elegir y por qué (NO recomendar automáticamente la más barata si tiene omisiones o mayores riesgos).
   - recommendedCompanyId: ID de la empresa recomendada.

Responde ÚNICAMENTE en JSON válido con la siguiente estructura:
{
  "proposalSummaries": [
    {
      "companyId": "...",
      "companyName": "...",
      "totalPriceText": "...",
      "executionTimeframeText": "...",
      "warrantyText": "...",
      "conceptsCount": 0
    }
  ],
  "items": [
    {
      "id": "item-1",
      "category": "precio" | "plazos" | "garantias" | "condiciones" | "trabajos" | "materiales" | "equipamiento" | "exclusiones",
      "concept": "Nombre del concepto o trabajo",
      "isMandatory": true,
      "values": {
        "${companies[0]?.id || 'comp-1'}": {
          "status": "incluido",
          "displayValue": "...",
          "detail": "...",
          "price": "...",
          "quantity": "...",
          "technicalSpecs": "...",
          "sourceDoc": "...",
          "sourcePage": "Pág. X"
        }
      }
    }
  ],
  "differences": {
    "keyDifferences": [
      "Empresa A incluye ...; Empresa B no lo contempla.",
      "Empresa C ofrece ... superior a ..."
    ]
  },
  "priceAnalysis": {
    "lowestPriceCompany": { "id": "...", "name": "...", "priceText": "...", "numericPrice": 0 },
    "highestPriceCompany": { "id": "...", "name": "...", "priceText": "...", "numericPrice": 0 },
    "priceSpread": "...",
    "scopeAnalysis": "...",
    "bestValueAssessment": "..."
  },
  "conclusion": {
    "cheapestProposal": "...",
    "mostCompleteProposal": "...",
    "bestConditions": "...",
    "priceDifferencesJustification": "...",
    "groundedRecommendation": "...",
    "recommendedCompanyId": "..."
  }
}
`;

  try {
    const response = await generateWithRetry({
      model: 'gemini-3.1-flash-lite',
      contents: synthesisPrompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = parseCleanJson<{
      proposalSummaries?: ProposalSummary[];
      items: ComparisonItem[];
      differences: ComparisonDifferences;
      priceAnalysis: PriceConvenienceAnalysis;
      conclusion: AiConclusion;
    }>(response.text ?? '{}', {
      proposalSummaries: [],
      items: [],
      differences: { keyDifferences: [] },
      priceAnalysis: {
        lowestPriceCompany: { id: '', name: '', priceText: 'No informado', numericPrice: 0 },
        highestPriceCompany: { id: '', name: '', priceText: 'No informado', numericPrice: 0 },
        priceSpread: 'Pendiente',
        scopeAnalysis: 'Sin información suficiente.',
        bestValueAssessment: 'Pendiente de análisis.',
      },
      conclusion: {
        cheapestProposal: 'No determinado',
        mostCompleteProposal: 'No determinado',
        bestConditions: 'No determinado',
        priceDifferencesJustification: 'No determinado',
        groundedRecommendation: 'Se requiere procesar los presupuestos para emitir dictamen.',
      },
    });

    // Ensure proposalSummaries is populated
    const proposalSummaries: ProposalSummary[] =
      parsed.proposalSummaries && parsed.proposalSummaries.length > 0
        ? parsed.proposalSummaries
        : companies.map(c => {
            const p = extractedProposals.find(ep => ep.companyId === c.id);
            return {
              companyId: c.id,
              companyName: c.name,
              totalPriceText: p?.totalPrice?.text || 'No informado',
              executionTimeframeText: p?.executionTimeframe?.text || 'No informado',
              warrantyText: p?.warranty?.text || 'No informada',
              conceptsCount: p?.concepts?.length || 0,
            };
          });

    return {
      proposalSummaries,
      items: parsed.items || [],
      differences: {
        keyDifferences: parsed.differences?.keyDifferences || [],
      },
      priceAnalysis: parsed.priceAnalysis || {
        lowestPriceCompany: { id: '', name: '', priceText: 'No informado', numericPrice: 0 },
        highestPriceCompany: { id: '', name: '', priceText: 'No informado', numericPrice: 0 },
        priceSpread: 'No calculado',
        scopeAnalysis: 'Revisar datos individuales.',
        bestValueAssessment: 'Pendiente de verificación.',
      },
      conclusion: parsed.conclusion || {
        cheapestProposal: 'No determinado',
        mostCompleteProposal: 'No determinado',
        bestConditions: 'No determinado',
        priceDifferencesJustification: 'No determinado',
        groundedRecommendation: 'Sin recomendación disponible.',
      },
    };
  } catch (err: any) {
    console.error('Error synthesizing comparison in Gemini:', err);
    throw new Error(`Error generando matriz comparativa con Gemini: ${err.message}`);
  }
}
