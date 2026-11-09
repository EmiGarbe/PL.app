import { AppDatabase, Company, Comparison, ComparisonDoc } from '../types';

export const api = {
  getDatabase: async (): Promise<AppDatabase> => {
    const res = await fetch('/api/db');
    if (!res.ok) throw new Error('Error al conectar con la base de datos');
    return res.json();
  },

  resetDatabase: async (): Promise<{ message: string; db: AppDatabase }> => {
    const res = await fetch('/api/db/reset', { method: 'POST' });
    if (!res.ok) throw new Error('Error al reiniciar datos de prueba');
    return res.json();
  },

  // Empresas (only Name and Address mandatory)
  getCompanies: async (): Promise<Company[]> => {
    const res = await fetch('/api/companies');
    if (!res.ok) throw new Error('Error obteniendo empresas');
    return res.json();
  },

  createCompany: async (data: { name: string; address: string } & Partial<Company>): Promise<Company> => {
    const res = await fetch('/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error creando empresa');
    }
    return res.json();
  },

  updateCompany: async (id: string, data: Partial<Company>): Promise<Company> => {
    const res = await fetch(`/api/companies/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Error actualizando empresa');
    return res.json();
  },

  deleteCompany: async (id: string): Promise<void> => {
    const res = await fetch(`/api/companies/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Error eliminando empresa');
  },

  // Comparaciones
  getComparisons: async (): Promise<Comparison[]> => {
    const res = await fetch('/api/comparisons');
    if (!res.ok) throw new Error('Error obteniendo comparaciones');
    return res.json();
  },

  getComparisonById: async (id: string): Promise<Comparison> => {
    const res = await fetch(`/api/comparisons/${id}`);
    if (!res.ok) throw new Error('Error cargando comparación');
    return res.json();
  },

  createComparison: async (data: {
    title: string;
    companyIds: string[];
    description?: string;
    date?: string;
  }): Promise<Comparison> => {
    const res = await fetch('/api/comparisons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error creando comparación');
    }
    return res.json();
  },

  updateComparison: async (id: string, data: Partial<Comparison>): Promise<Comparison> => {
    const res = await fetch(`/api/comparisons/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Error actualizando comparación');
    return res.json();
  },

  deleteComparison: async (id: string): Promise<void> => {
    const res = await fetch(`/api/comparisons/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Error eliminando comparación');
  },

  uploadDocument: async (
    comparisonId: string,
    docData: {
      name: string;
      companyId: string;
      summary?: string;
      size?: number;
      mimeType?: string;
      fileData?: string;
      extractImmediately?: boolean;
    }
  ): Promise<ComparisonDoc> => {
    const res = await fetch(`/api/comparisons/${comparisonId}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(docData),
    });
    if (!res.ok) throw new Error('Error subiendo documento');
    return res.json();
  },

  deleteDocument: async (comparisonId: string, docId: string): Promise<void> => {
    const res = await fetch(`/api/comparisons/${comparisonId}/documents/${docId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Error eliminando documento');
  },

  addCompanyToComparison: async (
    comparisonId: string,
    companyData: {
      companyId?: string;
      name?: string;
      address?: string;
      yearsInBusiness?: number;
      reputation?: string;
      previousRelationship?: string;
      pastProjectsCount?: number;
      complianceHistory?: string;
      observations?: string;
    }
  ): Promise<Comparison> => {
    const res = await fetch(`/api/comparisons/${comparisonId}/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(companyData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error asociando empresa a la obra');
    }
    return res.json();
  },

  removeCompanyFromComparison: async (comparisonId: string, companyId: string): Promise<Comparison> => {
    const res = await fetch(`/api/comparisons/${comparisonId}/companies/${companyId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Error quitando empresa de la obra');
    return res.json();
  },

  analyzeComparisonWithAi: async (comparisonId: string, customNotes?: string): Promise<Comparison> => {
    const res = await fetch(`/api/comparisons/${comparisonId}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customNotes }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al analizar presupuestos con IA');
    }
    return res.json();
  },

  extractDocument: async (comparisonId: string, docId: string): Promise<{ success: boolean; doc: ComparisonDoc }> => {
    const res = await fetch(`/api/comparisons/${comparisonId}/documents/${docId}/extract`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error leyendo el documento');
    }
    return res.json();
  },

  updateDocumentExtractedData: async (comparisonId: string, docId: string, data: any): Promise<{ success: boolean; doc: ComparisonDoc }> => {
    const res = await fetch(`/api/comparisons/${comparisonId}/documents/${docId}/extracted-data`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error guardando datos extraídos');
    }
    return res.json();
  },
};
