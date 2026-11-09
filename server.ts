import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { dbService } from './server/db.js';
import { extractDocumentDataWithGemini, synthesizeProposalsComparison } from './server/gemini.js';
import { ComparisonDoc } from './server/types.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === 'production';
const PORT = 3000;

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // ==========================================
  // API Routes
  // ==========================================

  // Health
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasGeminiApiKey: Boolean(process.env.GEMINI_API_KEY),
      timestamp: new Date().toISOString(),
    });
  });

  // Full DB State
  app.get('/api/db', (req, res) => {
    try {
      res.json(dbService.getAll());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Clear database
  app.post('/api/db/reset', (req, res) => {
    try {
      const db = dbService.clearAll();
      res.json({ message: 'Base de datos vaciada.', db });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- EMPRESAS (Only name and address mandatory) ---
  app.get('/api/companies', (req, res) => {
    res.json(dbService.getCompanies());
  });

  app.get('/api/companies/:id', (req, res) => {
    const comp = dbService.getCompanyById(req.params.id);
    if (!comp) return res.status(404).json({ error: 'Empresa no encontrada' });
    res.json(comp);
  });

  app.post('/api/companies', (req, res) => {
    try {
      const { name, address } = req.body;
      if (!name || !address) {
        return res.status(400).json({ error: 'Nombre de la empresa y Dirección son obligatorios' });
      }
      const company = dbService.createCompany(req.body);
      res.status(201).json(company);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/companies/:id', (req, res) => {
    const updated = dbService.updateCompany(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Empresa no encontrada' });
    res.json(updated);
  });

  app.delete('/api/companies/:id', (req, res) => {
    const success = dbService.deleteCompany(req.params.id);
    if (!success) return res.status(404).json({ error: 'Empresa no encontrada' });
    res.json({ success: true });
  });

  // --- COMPARACIONES (Cuadro Comparativo de Presupuestos) ---
  app.get('/api/comparisons', (req, res) => {
    res.json(dbService.getComparisons());
  });

  app.get('/api/comparisons/:id', (req, res) => {
    const comp = dbService.getComparisonById(req.params.id);
    if (!comp) return res.status(404).json({ error: 'Comparación no encontrada' });
    res.json(comp);
  });

  app.post('/api/comparisons', (req, res) => {
    try {
      const { title, companyIds, description, date } = req.body;
      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'El nombre de la obra o proyecto es obligatorio' });
      }
      const newComp = dbService.createComparison({
        title: title.trim(),
        companyIds: Array.isArray(companyIds) ? companyIds : [],
        description,
        date,
      });
      res.status(201).json(newComp);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/comparisons/:id', (req, res) => {
    const updated = dbService.updateComparison(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Comparación no encontrada' });
    res.json(updated);
  });

  app.delete('/api/comparisons/:id', (req, res) => {
    const success = dbService.deleteComparison(req.params.id);
    if (!success) return res.status(404).json({ error: 'Comparación no encontrada' });
    res.json({ success: true });
  });

  // Cargar / Asociar una empresa dentro de esta obra o proyecto
  app.post('/api/comparisons/:id/companies', (req, res) => {
    const comparison = dbService.getComparisonById(req.params.id);
    if (!comparison) return res.status(404).json({ error: 'Obra o proyecto no encontrado' });

    let companyIdToAdd = req.body.companyId;

    // Si viene con datos para crear nueva empresa directamente dentro de la obra
    if (!companyIdToAdd && req.body.name && req.body.address) {
      const newCompany = dbService.createCompany({
        name: req.body.name.trim(),
        address: req.body.address.trim(),
        yearsInBusiness: req.body.yearsInBusiness,
        reputation: req.body.reputation,
        previousRelationship: req.body.previousRelationship,
        pastProjectsCount: req.body.pastProjectsCount,
        complianceHistory: req.body.complianceHistory,
        observations: req.body.observations,
      });
      companyIdToAdd = newCompany.id;
    }

    if (!companyIdToAdd) {
      return res.status(400).json({ error: 'Debes seleccionar una empresa o indicar Nombre y Dirección' });
    }

    if (!comparison.companyIds.includes(companyIdToAdd)) {
      comparison.companyIds.push(companyIdToAdd);
      comparison.updatedAt = new Date().toISOString();
      dbService.save();
    }

    res.json(comparison);
  });

  // Quitar una empresa de esta obra o proyecto
  app.delete('/api/comparisons/:id/companies/:companyId', (req, res) => {
    const comparison = dbService.getComparisonById(req.params.id);
    if (!comparison) return res.status(404).json({ error: 'Obra o proyecto no encontrado' });

    comparison.companyIds = comparison.companyIds.filter(cId => cId !== req.params.companyId);
    comparison.updatedAt = new Date().toISOString();
    dbService.save();

    res.json(comparison);
  });

  // Subir documento a una comparación
  app.post('/api/comparisons/:id/documents', async (req, res) => {
    const comparison = dbService.getComparisonById(req.params.id);
    if (!comparison) return res.status(404).json({ error: 'Comparación no encontrada' });

    const { name, companyId, summary, size, mimeType, fileData, extractImmediately = true } = req.body;
    const doc: ComparisonDoc = {
      id: `doc-${Date.now()}`,
      name: name || 'Documento de presupuesto',
      companyId: companyId || 'pliego',
      size: size || 1024,
      mimeType: mimeType || 'application/pdf',
      uploadedAt: new Date().toISOString(),
      summary: summary || '',
      fileData: fileData || '',
      processingStatus: 'pending',
      errorMessage: undefined,
    };

    comparison.documents.push(doc);
    comparison.updatedAt = new Date().toISOString();
    dbService.save();

    // Optionally extract immediately with Gemini
    if (extractImmediately) {
      try {
        const companyName = doc.companyId === 'pliego'
          ? 'Pliego de Bases y Condiciones'
          : dbService.getCompanyById(doc.companyId)?.name || 'Empresa Cotizante';

        const extracted = await extractDocumentDataWithGemini(
          doc,
          companyName,
          doc.companyId === 'pliego'
        );

        doc.extractedData = extracted;
        doc.processingStatus = 'completed';
        comparison.updatedAt = new Date().toISOString();
        dbService.save();
      } catch (extractErr: any) {
        console.error(`Error procesando documento ${doc.name} en subida:`, extractErr);
        doc.processingStatus = 'error';
        doc.errorMessage = extractErr.message || 'Error al procesar el archivo con Gemini.';
        dbService.save();
      }
    }

    res.status(201).json(doc);
  });

  // Extraer o reintentar lectura de un documento con Gemini
  app.post('/api/comparisons/:id/documents/:docId/extract', async (req, res) => {
    try {
      const comparison = dbService.getComparisonById(req.params.id);
      if (!comparison) return res.status(404).json({ error: 'Comparación no encontrada' });

      const doc = comparison.documents.find(d => d.id === req.params.docId);
      if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

      const companyName = doc.companyId === 'pliego'
        ? 'Pliego de Bases y Condiciones'
        : dbService.getCompanyById(doc.companyId)?.name || 'Empresa Cotizante';

      doc.processingStatus = 'processing';
      dbService.save();

      const extracted = await extractDocumentDataWithGemini(
        doc,
        companyName,
        doc.companyId === 'pliego'
      );

      doc.extractedData = extracted;
      doc.processingStatus = 'completed';
      doc.errorMessage = undefined;
      comparison.updatedAt = new Date().toISOString();
      dbService.save();

      res.json({ success: true, doc });
    } catch (err: any) {
      console.error('Error re-extrayendo documento:', err);
      const comparison = dbService.getComparisonById(req.params.id);
      if (comparison) {
        const doc = comparison.documents.find(d => d.id === req.params.docId);
        if (doc) {
          doc.processingStatus = 'error';
          doc.errorMessage = err.message || 'Error procesando documento con Gemini';
          dbService.save();
        }
      }
      res.status(500).json({ error: err.message });
    }
  });

  // Guardar correcciones del usuario sobre los datos extraídos de un documento
  app.put('/api/comparisons/:id/documents/:docId/extracted-data', (req, res) => {
    const comparison = dbService.getComparisonById(req.params.id);
    if (!comparison) return res.status(404).json({ error: 'Comparación no encontrada' });

    const doc = comparison.documents.find(d => d.id === req.params.docId);
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

    doc.extractedData = req.body;
    doc.processingStatus = 'completed';
    comparison.updatedAt = new Date().toISOString();
    dbService.save();

    res.json({ success: true, doc });
  });

  // Eliminar documento
  app.delete('/api/comparisons/:id/documents/:docId', (req, res) => {
    const success = dbService.deleteDocument(req.params.id, req.params.docId);
    if (!success) return res.status(404).json({ error: 'Documento o comparación no encontrada' });
    res.json({ success: true });
  });

  // Ejecutar Análisis y Síntesis de Presupuestos con Gemini
  app.post('/api/comparisons/:id/analyze', async (req, res) => {
    try {
      const comparison = dbService.getComparisonById(req.params.id);
      if (!comparison) return res.status(404).json({ error: 'Comparación no encontrada' });

      const allCompanies = dbService.getCompanies();
      const participatingCompanies = allCompanies.filter(c => comparison.companyIds.includes(c.id));

      if (participatingCompanies.length === 0) {
        return res.status(400).json({ error: 'Debes tener al menos una empresa cargada para comparar presupuestos.' });
      }

      // Step 1: Ensure all company documents have been extracted with Gemini
      for (const doc of comparison.documents) {
        if (!doc.extractedData || doc.processingStatus === 'error') {
          const companyName = doc.companyId === 'pliego'
            ? 'Pliego de Bases y Condiciones'
            : dbService.getCompanyById(doc.companyId)?.name || 'Empresa Cotizante';

          try {
            console.log(`[Gemini] Leyendo documento "${doc.name}" de ${companyName}...`);
            const extracted = await extractDocumentDataWithGemini(
              doc,
              companyName,
              doc.companyId === 'pliego'
            );
            doc.extractedData = extracted;
            doc.processingStatus = 'completed';
            doc.errorMessage = undefined;
          } catch (extractErr: any) {
            console.error(`Error leyendo documento ${doc.name}:`, extractErr);
            doc.processingStatus = 'error';
            doc.errorMessage = extractErr.message;
            // Throw so the user gets informed of which document could not be read
            throw new Error(`Error leyendo el archivo "${doc.name}": ${extractErr.message}`);
          }
        }
      }

      dbService.save();

      // Collect all extracted proposals for participating companies
      const companyProposals = comparison.documents
        .filter(d => d.companyId !== 'pliego' && d.extractedData && comparison.companyIds.includes(d.companyId))
        .map(d => d.extractedData!);

      const pliegoDoc = comparison.documents.find(d => d.companyId === 'pliego');

      if (companyProposals.length === 0) {
        return res.status(400).json({
          error: 'No se encontraron documentos procesados de las empresas participantes. Por favor sube los presupuestos en PDF antes de presionar ANALIZAR.',
        });
      }

      // Step 2: Run Comparative Synthesis with Gemini 3.8 Flash
      console.log(`[Gemini] Generando cuadro comparativo para "${comparison.title}"...`);
      const synthesis = await synthesizeProposalsComparison(
        comparison.title,
        comparison.description || '',
        participatingCompanies,
        companyProposals,
        pliegoDoc
      );

      // Save comparison results
      comparison.proposalSummaries = synthesis.proposalSummaries;
      comparison.items = synthesis.items;
      comparison.differences = synthesis.differences;
      comparison.priceAnalysis = synthesis.priceAnalysis;
      comparison.conclusion = synthesis.conclusion;
      comparison.updatedAt = new Date().toISOString();
      dbService.save();

      res.json(comparison);
    } catch (err: any) {
      console.error('Error running comparison analysis:', err);
      res.status(500).json({ error: err.message || 'Error desconocido analizando propuestas.' });
    }
  });

  // ==========================================
  // Vite Middleware / Static Server
  // ==========================================
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Presupuestos] Servidor activo en http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
