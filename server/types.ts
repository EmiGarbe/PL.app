export type ConceptStatus = 
  | 'incluido'              // ✓ Incluido
  | 'no_incluido'           // ✕ No incluido
  | 'parcial'               // ◐ Incluido parcialmente
  | 'mejora'                // ★ Adicional o mejora
  | 'no_informado'          // ? No informado
  | 'pendiente_validacion'; // ⏳ Pendiente de validación

export interface Company {
  id: string;
  name: string;
  address: string;
  // Ficha de antecedentes y confianza
  yearsInBusiness?: number;
  reputation?: string;
  previousRelationship?: string;
  pastProjectsCount?: number;
  pastProjectsSummary?: string;
  experienceSummary?: string;
  complianceHistory?: string;
  observations?: string;
  createdAt: string;
}

export interface ExtractedConcept {
  id: string;
  concept: string; // Nombre del trabajo o concepto
  description?: string;
  category: 'precio' | 'trabajos' | 'materiales' | 'equipamiento' | 'plazos' | 'garantias' | 'condiciones' | 'exclusiones' | 'otro';
  quantity?: string | null;
  unit?: string | null;
  unitPrice?: string | null;
  totalPrice?: string | null;
  technicalSpecs?: string;
  status: ConceptStatus;
  observations?: string;
  pageNumber?: string | number;
}

export interface ExtractedProposalData {
  documentId: string;
  companyId: string;
  companyName: string;
  documentTitle: string;
  totalPrice?: {
    amount?: number | null;
    currency?: string;
    text: string;
    pageNumber?: string | number;
  };
  executionTimeframe?: {
    text: string;
    daysOrWeeks?: string;
    pageNumber?: string | number;
  };
  warranty?: {
    text: string;
    pageNumber?: string | number;
  };
  commercialConditions?: {
    paymentTerms?: string;
    validityDays?: string;
    advancePayment?: string;
    pageNumber?: string | number;
  };
  concepts: ExtractedConcept[];
  rawSummary?: string;
  processedAt: string;
}

export interface ComparisonDoc {
  id: string;
  name: string;
  companyId: string; // 'pliego' si es el documento base, o el id de la empresa
  size: number;
  mimeType: string;
  uploadedAt: string;
  summary?: string;
  fileData?: string; // Data URL o base64
  extractedData?: ExtractedProposalData;
  processingStatus?: 'pending' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
}

export interface CellValue {
  status: ConceptStatus;
  displayValue: string; // Texto breve visible en celda (ej: "$825.000", "✓ Incluido", "18 semanas")
  detail: string;       // Detalle textual extraído
  price?: string;
  quantity?: string;
  technicalSpecs?: string;
  sourceDoc?: string;   // Archivo de origen
  sourcePage?: string | number;  // Página o sección
  observations?: string;
  verifiedByUser?: boolean;
  userNotes?: string;
}

export interface ComparisonItem {
  id: string;
  category: 'precio' | 'trabajos' | 'materiales' | 'equipamiento' | 'plazos' | 'garantias' | 'condiciones' | 'exclusiones' | 'otro';
  concept: string; // Nombre de la fila
  isMandatory?: boolean;
  values: Record<string, CellValue>; // key es companyId
}

export interface ProposalSummary {
  companyId: string;
  companyName: string;
  totalPriceText: string;
  executionTimeframeText: string;
  warrantyText: string;
  conceptsCount: number;
}

export interface ComparisonDifferences {
  keyDifferences: string[]; // Lista breve y clara con las diferencias importantes
  exclusivePerCompany?: Array<{
    companyId: string;
    companyName: string;
    items: string[];
  }>;
  missingPerCompany?: Array<{
    companyId: string;
    companyName: string;
    missingItems: string[];
  }>;
  specificationDifferences?: Array<{
    concept: string;
    comparison: string;
  }>;
  improvements?: Array<{
    companyId: string;
    companyName: string;
    improvement: string;
  }>;
  itemsToConfirm?: string[];
}

export interface PriceConvenienceAnalysis {
  lowestPriceCompany: {
    id: string;
    name: string;
    priceText: string;
    numericPrice: number;
  };
  highestPriceCompany: {
    id: string;
    name: string;
    priceText: string;
    numericPrice: number;
  };
  priceSpread: string;
  scopeAnalysis: string; // Explica si el precio más bajo omite trabajos esenciales
  identifiedAdditionalCosts?: Array<{
    companyName: string;
    item: string;
    estimatedCost?: string;
    note: string;
  }>;
  bestValueAssessment: string;
}

export interface AiConclusion {
  cheapestProposal: string;
  mostCompleteProposal: string;
  bestConditions: string;
  priceDifferencesJustification: string;
  highestRiskProposal?: string;
  bestValueRatio?: string;
  clarificationsNeeded?: string[];
  groundedRecommendation: string;
  recommendedCompanyId?: string;
}

export interface Comparison {
  id: string;
  title: string;
  description?: string;
  date: string;
  companyIds: string[];
  documents: ComparisonDoc[];
  proposalSummaries?: ProposalSummary[];
  items: ComparisonItem[];
  differences: ComparisonDifferences;
  priceAnalysis?: PriceConvenienceAnalysis;
  conclusion: AiConclusion;
  createdAt: string;
  updatedAt: string;
}

export interface AppDatabase {
  companies: Company[];
  comparisons: Comparison[];
}
