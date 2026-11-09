import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AppDatabase, Company, Comparison } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.resolve(DATA_DIR, 'store.json');

function ensureDirectoryExists(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getEmptyDatabase(): AppDatabase {
  return {
    companies: [],
    comparisons: [],
  };
}

class DatabaseService {
  private db: AppDatabase;

  constructor() {
    ensureDirectoryExists(DATA_DIR);
    this.db = this.load();
  }

  private load(): AppDatabase {
    try {
      if (fs.existsSync(DB_FILE)) {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed.comparisons) && Array.isArray(parsed.companies)) {
          return parsed as AppDatabase;
        }
      }
    } catch (err) {
      console.error('Error cargando base de datos, inicializando vacía:', err);
    }

    const empty = getEmptyDatabase();
    this.saveDirect(empty);
    return empty;
  }

  private saveDirect(data: AppDatabase) {
    try {
      ensureDirectoryExists(DATA_DIR);
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error guardando base de datos en disco:', err);
    }
  }

  public save() {
    this.saveDirect(this.db);
  }

  public clearAll(): AppDatabase {
    this.db = getEmptyDatabase();
    this.save();
    return this.db;
  }

  public getAll(): AppDatabase {
    return this.db;
  }

  // Companies (only 2 mandatory: name & address)
  public getCompanies(): Company[] {
    return this.db.companies;
  }

  public getCompanyById(id: string): Company | undefined {
    return this.db.companies.find(c => c.id === id);
  }

  public createCompany(data: { name: string; address: string } & Partial<Company>): Company {
    const company: Company = {
      ...data,
      id: `comp-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.db.companies.push(company);
    this.save();
    return company;
  }

  public updateCompany(id: string, data: Partial<Company>): Company | undefined {
    const idx = this.db.companies.findIndex(c => c.id === id);
    if (idx === -1) return undefined;
    this.db.companies[idx] = { ...this.db.companies[idx], ...data };
    this.save();
    return this.db.companies[idx];
  }

  public deleteCompany(id: string): boolean {
    const initialLen = this.db.companies.length;
    this.db.companies = this.db.companies.filter(c => c.id !== id);
    if (this.db.companies.length !== initialLen) {
      // Cascade unlinking: remove from comparisons
      this.db.comparisons.forEach(comp => {
        comp.companyIds = comp.companyIds.filter(cid => cid !== id);
        if (comp.proposalSummaries) {
          comp.proposalSummaries = comp.proposalSummaries.filter(ps => ps.companyId !== id);
        }
        if (comp.documents) {
          comp.documents = comp.documents.filter(doc => doc.companyId !== id);
        }
        if (comp.items) {
          comp.items.forEach(it => {
            if (it.values && it.values[id]) {
              delete it.values[id];
            }
          });
        }
        if (comp.conclusion && comp.conclusion.recommendedCompanyId === id) {
          comp.conclusion.recommendedCompanyId = undefined;
        }
        comp.updatedAt = new Date().toISOString();
      });
      this.save();
      return true;
    }
    return false;
  }

  // Comparisons
  public getComparisons(): Comparison[] {
    return this.db.comparisons;
  }

  public getComparisonById(id: string): Comparison | undefined {
    return this.db.comparisons.find(c => c.id === id);
  }

  public createComparison(data: {
    title: string;
    description?: string;
    date?: string;
    companyIds: string[];
  }): Comparison {
    const newComp: Comparison = {
      id: `comp-${Date.now()}`,
      title: data.title,
      description: data.description || '',
      date: data.date || new Date().toISOString().split('T')[0],
      companyIds: data.companyIds || [],
      documents: [],
      proposalSummaries: [],
      items: [],
      differences: {
        keyDifferences: [],
        exclusivePerCompany: [],
        missingPerCompany: [],
        specificationDifferences: [],
        improvements: [],
        itemsToConfirm: [],
      },
      priceAnalysis: {
        lowestPriceCompany: { id: '', name: '', priceText: 'No informado', numericPrice: 0 },
        highestPriceCompany: { id: '', name: '', priceText: 'No informado', numericPrice: 0 },
        priceSpread: 'Pendiente de análisis',
        scopeAnalysis: 'Carga los presupuestos para comparar alcances.',
        identifiedAdditionalCosts: [],
        bestValueAssessment: 'Pendiente de extracción de documentos.',
      },
      conclusion: {
        cheapestProposal: 'Pendiente de análisis',
        mostCompleteProposal: 'Pendiente de análisis',
        bestConditions: 'Pendiente de análisis',
        priceDifferencesJustification: 'Pendiente de análisis',
        highestRiskProposal: 'Pendiente de análisis',
        bestValueRatio: 'Pendiente de análisis',
        clarificationsNeeded: [],
        groundedRecommendation: 'Carga los presupuestos para que Gemini genere la recomendación fundamentada.',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.db.comparisons.unshift(newComp);
    this.save();
    return newComp;
  }

  public updateComparison(id: string, data: Partial<Comparison>): Comparison | undefined {
    const idx = this.db.comparisons.findIndex(c => c.id === id);
    if (idx === -1) return undefined;
    this.db.comparisons[idx] = {
      ...this.db.comparisons[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.db.comparisons[idx];
  }

  public deleteComparison(id: string): boolean {
    const initialLen = this.db.comparisons.length;
    this.db.comparisons = this.db.comparisons.filter(c => c.id !== id);
    if (this.db.comparisons.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  public deleteDocument(comparisonId: string, docId: string): boolean {
    const comp = this.getComparisonById(comparisonId);
    if (!comp) return false;
    const initialLen = comp.documents.length;
    comp.documents = comp.documents.filter(d => d.id !== docId);
    if (comp.documents.length !== initialLen) {
      comp.updatedAt = new Date().toISOString();
      this.save();
      return true;
    }
    return false;
  }
}

export const dbService = new DatabaseService();
