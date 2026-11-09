import React, { useState } from 'react';
import { X, Sparkles, Check, Edit2, AlertCircle, FileText, RefreshCw, Save } from 'lucide-react';
import { ComparisonDoc, ExtractedProposalData, ExtractedConcept, ConceptStatus } from '../types';
import { api } from '../services/api';
import { useToast } from './Toast';

interface ExtractedDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  comparisonId: string;
  doc: ComparisonDoc;
  companyName: string;
  onSaved: () => void;
}

export const ExtractedDataModal: React.FC<ExtractedDataModalProps> = ({
  isOpen,
  onClose,
  comparisonId,
  doc,
  companyName,
  onSaved,
}) => {
  if (!isOpen) return null;

  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();
  const initialData: ExtractedProposalData = doc.extractedData || {
    documentId: doc.id,
    companyId: doc.companyId,
    companyName,
    documentTitle: doc.name,
    totalPrice: { text: 'No informado', pageNumber: 's/d' },
    executionTimeframe: { text: 'No informado', pageNumber: 's/d' },
    warranty: { text: 'No informada', pageNumber: 's/d' },
    commercialConditions: { paymentTerms: 'No informada', pageNumber: 's/d' },
    concepts: [],
    rawSummary: doc.summary || 'Sin extracción previa.',
    processedAt: new Date().toISOString(),
  };

  const [data, setData] = useState<ExtractedProposalData>(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [isReExtracting, setIsReExtracting] = useState(false);
  const [editingConceptId, setEditingConceptId] = useState<string | null>(null);

  const handleConceptChange = (conceptId: string, field: keyof ExtractedConcept, value: any) => {
    setData(prev => ({
      ...prev,
      concepts: prev.concepts.map(c => (c.id === conceptId ? { ...c, [field]: value } : c)),
    }));
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await api.updateDocumentExtractedData(comparisonId, doc.id, data);
      toastSuccess('Datos de la propuesta guardados correctamente.');
      onSaved();
      onClose();
    } catch (err: any) {
      toastError(`Error guardando datos: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReExtract = async () => {
    setIsReExtracting(true);
    toastInfo('Re-procesando documento con Gemini...');
    try {
      const res = await api.extractDocument(comparisonId, doc.id);
      if (res.doc.extractedData) {
        setData(res.doc.extractedData);
      }
      onSaved();
      toastSuccess('¡Documento re-procesado con éxito por Gemini!');
    } catch (err: any) {
      toastError(`Error al re-procesar: ${err.message}`);
    } finally {
      setIsReExtracting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
                Datos Extraídos por Gemini
              </span>
              <span className="text-xs text-slate-500 font-medium">{companyName}</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <span>{doc.name}</span>
            </h2>
            <p className="text-xs text-slate-500">
              Revisa y edita los datos leídos del documento. Cada dato incluye su página de origen.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReExtract}
              disabled={isReExtracting}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Volver a leer el PDF con Gemini"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isReExtracting ? 'animate-spin' : ''}`} />
              <span>{isReExtracting ? 'Leyendo...' : 'Re-analizar PDF'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5 text-xs">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Precio Total</span>
              <input
                type="text"
                value={data.totalPrice?.text || ''}
                onChange={(e) => setData({ ...data, totalPrice: { ...data.totalPrice, text: e.target.value } })}
                className="w-full font-bold text-slate-900 bg-white px-2 py-1 rounded border border-slate-200 text-xs"
              />
              <span className="text-[10px] text-slate-400 block">Ref: {data.totalPrice?.pageNumber || 's/d'}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Plazo de Ejecución</span>
              <input
                type="text"
                value={data.executionTimeframe?.text || ''}
                onChange={(e) => setData({ ...data, executionTimeframe: { ...data.executionTimeframe, text: e.target.value } })}
                className="w-full font-bold text-slate-900 bg-white px-2 py-1 rounded border border-slate-200 text-xs"
              />
              <span className="text-[10px] text-slate-400 block">Ref: {data.executionTimeframe?.pageNumber || 's/d'}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Garantía</span>
              <input
                type="text"
                value={data.warranty?.text || ''}
                onChange={(e) => setData({ ...data, warranty: { ...data.warranty, text: e.target.value } })}
                className="w-full font-bold text-slate-900 bg-white px-2 py-1 rounded border border-slate-200 text-xs"
              />
              <span className="text-[10px] text-slate-400 block">Ref: {data.warranty?.pageNumber || 's/d'}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Condición de Pago</span>
              <input
                type="text"
                value={data.commercialConditions?.paymentTerms || ''}
                onChange={(e) => setData({ ...data, commercialConditions: { ...data.commercialConditions, paymentTerms: e.target.value } })}
                className="w-full font-bold text-slate-900 bg-white px-2 py-1 rounded border border-slate-200 text-xs"
              />
              <span className="text-[10px] text-slate-400 block">Ref: {data.commercialConditions?.pageNumber || 's/d'}</span>
            </div>
          </div>

          {/* Concepts Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-xs">
                Conceptos Identificados ({data.concepts.length})
              </span>
              <span className="text-[11px] text-slate-500">Puedes modificar valores directamente en cada fila</span>
            </div>

            {data.concepts.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-2">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                <p className="text-slate-600 font-semibold">No se encontraron conceptos estructurados en este archivo.</p>
                <button
                  onClick={handleReExtract}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Procesar con Gemini ahora
                </button>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3 w-1/4">Concepto</th>
                      <th className="p-3 w-1/3">Descripción & Especificaciones</th>
                      <th className="p-3 w-28">Estado</th>
                      <th className="p-3 w-24">Precio</th>
                      <th className="p-3 w-20 text-center">Página</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {data.concepts.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50/70">
                        <td className="p-3 align-top font-bold text-slate-900">
                          <input
                            type="text"
                            value={c.concept}
                            onChange={(e) => handleConceptChange(c.id, 'concept', e.target.value)}
                            className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none"
                          />
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block mt-0.5">
                            {c.category}
                          </span>
                        </td>

                        <td className="p-3 align-top text-slate-600 space-y-1">
                          <textarea
                            value={c.description || ''}
                            onChange={(e) => handleConceptChange(c.id, 'description', e.target.value)}
                            rows={2}
                            className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded p-1 text-[11px] resize-none focus:outline-none"
                          />
                          {c.technicalSpecs && (
                            <div className="text-[10px] text-indigo-700 font-medium">
                              Specs: {c.technicalSpecs}
                            </div>
                          )}
                        </td>

                        <td className="p-3 align-top">
                          <select
                            value={c.status}
                            onChange={(e) => handleConceptChange(c.id, 'status', e.target.value as ConceptStatus)}
                            className="px-2 py-1 rounded border border-slate-200 bg-white text-xs font-semibold"
                          >
                            <option value="incluido">✓ Incluido</option>
                            <option value="no_incluido">✕ No incluido</option>
                            <option value="parcial">◐ Parcial</option>
                            <option value="mejora">★ Mejora</option>
                            <option value="pendiente_validacion">⏳ Pendiente</option>
                            <option value="no_informado">? No informado</option>
                          </select>
                        </td>

                        <td className="p-3 align-top font-mono font-semibold text-slate-800">
                          <input
                            type="text"
                            value={c.totalPrice || c.unitPrice || ''}
                            placeholder="-"
                            onChange={(e) => handleConceptChange(c.id, 'totalPrice', e.target.value)}
                            className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 text-xs focus:outline-none"
                          />
                        </td>

                        <td className="p-3 align-top text-center text-slate-500 font-mono text-[11px]">
                          <input
                            type="text"
                            value={c.pageNumber || ''}
                            onChange={(e) => handleConceptChange(c.id, 'pageNumber', e.target.value)}
                            className="w-16 text-center bg-slate-50 rounded px-1 py-0.5 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 pt-4 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400">
            Último procesamiento: {new Date(data.processedAt).toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs cursor-pointer"
            >
              Cerrar
            </button>
            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
