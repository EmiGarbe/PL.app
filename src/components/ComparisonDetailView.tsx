import React, { useState } from 'react';
import {
  TableProperties,
  Sparkles,
  Upload,
  Download,
  Printer,
  ArrowLeft,
  CheckCircle2,
  FileText,
  DollarSign,
  Scale,
  Award,
  Clock,
  Building2,
  Trash2,
  Plus,
  Eye,
  Calendar,
  AlertCircle,
  FileCode,
} from 'lucide-react';
import {
  Comparison,
  Company,
  CellValue,
  ComparisonDoc,
} from '../types';
import { CellDetailModal } from './CellDetailModal';
import { UploadDocModal } from './UploadDocModal';
import { AddCompanyToProjectModal } from './AddCompanyToProjectModal';
import { ExtractedDataModal } from './ExtractedDataModal';
import { ConfirmDialog } from './ConfirmDialog';
import { useToast } from './Toast';
import { api } from '../services/api';

interface ComparisonDetailViewProps {
  comparison: Comparison;
  companies: Company[];
  onBack: () => void;
  onUpdateComparison: (updated: Comparison) => void;
  onDeleteComparison?: (id: string) => Promise<void>;
  onRefreshData: () => void;
}

export const ComparisonDetailView: React.FC<ComparisonDetailViewProps> = ({
  comparison,
  companies,
  onBack,
  onUpdateComparison,
  onDeleteComparison,
  onRefreshData,
}) => {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [preselectedCompanyForUpload, setPreselectedCompanyForUpload] = useState<string>('pliego');

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => Promise<void> | void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Eliminar',
    onConfirm: () => {},
  });

  // Selected document to inspect/edit its extracted data
  const [inspectingDoc, setInspectingDoc] = useState<{
    doc: ComparisonDoc;
    companyName: string;
  } | null>(null);

  // Selected cell for drill-down modal
  const [selectedCell, setSelectedCell] = useState<{
    isOpen: boolean;
    concept: string;
    companyName: string;
    itemId: string;
    companyId: string;
    value: CellValue;
  }>({
    isOpen: false,
    concept: '',
    companyName: '',
    itemId: '',
    companyId: '',
    value: { status: 'no_informado', displayValue: '', detail: '' },
  });

  const participatingCompanies = companies.filter(c => comparison.companyIds.includes(c.id));
  const pliegoDocs = comparison.documents.filter(d => d.companyId === 'pliego');
  const companyDocs = comparison.documents.filter(d => d.companyId !== 'pliego');
  const hasAnalysis = comparison.items && comparison.items.length > 0;

  // Trigger Gemini full comparison analysis
  const handleAnalyzeWithAi = async () => {
    if (participatingCompanies.length === 0) {
      toastError('Debes asociar al menos una empresa participante para poder analizar propuestas.');
      return;
    }

    if (companyDocs.length === 0) {
      toastError('Debes subir al menos un presupuesto en PDF o documento de las empresas antes de analizar.');
      return;
    }

    setIsAnalyzing(true);
    toastInfo('Generando cuadro comparativo con Gemini...');
    try {
      const updated = await api.analyzeComparisonWithAi(comparison.id);
      onUpdateComparison(updated);
      toastSuccess('¡Análisis completado! Se construyó la matriz comparativa.');
    } catch (err: any) {
      toastError(`Error en el análisis: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Remove company from this comparison
  const handleRemoveCompany = (companyId: string, companyName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Desvincular Empresa',
      message: `¿Deseas desvincular a "${companyName}" de esta obra?\nLos documentos asociados permanecerán en el historial.`,
      confirmLabel: 'Desvincular',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        // Optimistic removal from view
        const updatedIds = comparison.companyIds.filter(id => id !== companyId);
        onUpdateComparison({ ...comparison, companyIds: updatedIds });

        try {
          const updated = await api.removeCompanyFromComparison(comparison.id, companyId);
          onUpdateComparison(updated);
          toastSuccess(`Empresa "${companyName}" desvinculada de la obra.`);
          onRefreshData();
        } catch (err: any) {
          toastError(`Error quitando empresa: ${err.message}`);
          onRefreshData();
        }
      },
    });
  };

  // Delete uploaded document
  const handleDeleteDoc = (docId: string, docName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Documento',
      message: `¿Estás seguro de eliminar el archivo "${docName}"? Se borrará permanentemente de la obra y de la base de datos.`,
      confirmLabel: 'Eliminar Archivo',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        // Optimistic removal from view
        const updatedDocs = comparison.documents.filter(d => d.id !== docId);
        onUpdateComparison({ ...comparison, documents: updatedDocs });

        try {
          await api.deleteDocument(comparison.id, docId);
          toastSuccess(`Archivo "${docName}" eliminado correctamente.`);
          onRefreshData();
        } catch (err: any) {
          toastError(`Error eliminando documento: ${err.message}`);
          onRefreshData();
        }
      },
    });
  };

  // Delete this comparison / obra
  const handleDeleteThisObra = () => {
    const docCount = comparison.documents?.length || 0;
    const msg = docCount > 0
      ? `¿Estás seguro de eliminar la obra "${comparison.title}"?\nSe borrarán permanentemente sus ${docCount} archivo(s) y el análisis comparativo.`
      : `¿Estás seguro de eliminar la obra "${comparison.title}"? Esta acción no se puede deshacer.`;

    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Obra / Comparación',
      message: msg,
      confirmLabel: 'Eliminar Obra',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          if (onDeleteComparison) {
            await onDeleteComparison(comparison.id);
          } else {
            await api.deleteComparison(comparison.id);
            toastSuccess(`Obra "${comparison.title}" eliminada.`);
            onRefreshData();
            onBack();
          }
        } catch (err: any) {
          toastError(`Error eliminando la obra: ${err.message}`);
        }
      },
    });
  };

  // Save manual edit from CellDetailModal
  const handleSaveCellOverride = async (updatedValue: CellValue) => {
    const updatedItems = comparison.items.map(item => {
      if (item.id === selectedCell.itemId) {
        return {
          ...item,
          values: {
            ...item.values,
            [selectedCell.companyId]: updatedValue,
          },
        };
      }
      return item;
    });

    const updatedComparison = {
      ...comparison,
      items: updatedItems,
    };

    try {
      await api.updateComparison(comparison.id, updatedComparison);
      onUpdateComparison(updatedComparison);
      toastSuccess('Celda actualizada correctamente.');
    } catch (err: any) {
      toastError(`Error guardando celda: ${err.message}`);
    }
  };

  // Export to Excel (CSV)
  const handleExportCSV = () => {
    let csv = 'Concepto;Categoria;' + participatingCompanies.map(c => `"${c.name}"`).join(';') + '\n';

    for (const item of comparison.items) {
      csv += `"${item.concept}";"${item.category}";`;
      csv += participatingCompanies.map(c => {
        const val = item.values[c.id];
        return `"${val?.displayValue || '? No informado'} - ${(val?.detail || '').replace(/"/g, '""')}"`;
      }).join(';') + '\n';
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Comparacion_${comparison.title.replace(/\s+/g, '_')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Helper for indicator badge styling
  const renderIndicatorBadge = (val?: CellValue) => {
    if (!val) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
          ? No informado
        </span>
      );
    }

    switch (val.status) {
      case 'incluido':
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 w-fit">
            <span>✓</span>
            <span>{val.displayValue || 'Incluido'}</span>
          </span>
        );
      case 'no_incluido':
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1.5 w-fit">
            <span>✕</span>
            <span>{val.displayValue || 'No incluido'}</span>
          </span>
        );
      case 'parcial':
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5 w-fit">
            <span>◐</span>
            <span>{val.displayValue || 'Parcial'}</span>
          </span>
        );
      case 'mejora':
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 flex items-center gap-1.5 w-fit">
            <span>★</span>
            <span>{val.displayValue || 'Mejora'}</span>
          </span>
        );
      case 'pendiente_validacion':
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1.5 w-fit">
            <span>⏳</span>
            <span>{val.displayValue || 'Pendiente'}</span>
          </span>
        );
      case 'no_informado':
      default:
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1.5 w-fit">
            <span>?</span>
            <span>{val.displayValue || 'No informado'}</span>
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 text-slate-900">
      {/* =========================================================================
          SECCIÓN 1: NOMBRE DE LA OBRA O PROYECTO
      ========================================================================= */}
      <section className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <button
              onClick={onBack}
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1 cursor-pointer transition-colors mb-1 print:hidden"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a comparaciones</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                1. Nombre de la Obra
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                <Calendar className="w-3 h-3" />
                {comparison.date}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {comparison.title}
            </h1>
            {comparison.description && (
              <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                {comparison.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 print:hidden self-start sm:self-center">
            <button
              onClick={handleAnalyzeWithAi}
              disabled={isAnalyzing || participatingCompanies.length === 0}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-2 cursor-pointer shadow-xs transition-colors disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>{isAnalyzing ? 'Leyendo documentos...' : 'Analizar propuestas'}</span>
            </button>

            {hasAnalysis && (
              <>
                <button
                  onClick={handleExportCSV}
                  className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                  title="Exportar a CSV"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => window.print()}
                  className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                  title="Imprimir"
                >
                  <Printer className="w-4 h-4" />
                </button>
              </>
            )}

            <button
              onClick={handleDeleteThisObra}
              className="p-2 rounded-xl border border-slate-200 hover:border-rose-300 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 text-xs font-semibold cursor-pointer transition-colors"
              title="Eliminar esta obra"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECCIÓN 2: EMPRESAS PARTICIPANTES
      ========================================================================= */}
      <section className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-700" />
              <span>2. Empresas Participantes ({participatingCompanies.length})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Empresas invitadas a cotizar en esta obra o proyecto.
            </p>
          </div>

          <button
            onClick={() => setShowAddCompanyModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar empresa</span>
          </button>
        </div>

        {participatingCompanies.length === 0 ? (
          <div className="p-6 rounded-lg bg-slate-50 border border-dashed border-slate-200 text-center space-y-2">
            <p className="text-xs text-slate-500">
              Todavía no has agregado empresas a esta obra.
            </p>
            <button
              onClick={() => setShowAddCompanyModal(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar empresa</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {participatingCompanies.map(comp => (
              <div
                key={comp.id}
                className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-start justify-between gap-2"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="font-bold text-slate-900 text-xs truncate">{comp.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">{comp.address}</div>
                  {comp.yearsInBusiness && (
                    <div className="text-[10px] text-slate-400">{comp.yearsInBusiness} años de trayectoria</div>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveCompany(comp.id, comp.name)}
                  className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer transition-colors shrink-0"
                  title="Quitar empresa de esta obra"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* =========================================================================
          SECCIÓN 3: ARCHIVOS CARGADOS
      ========================================================================= */}
      <section className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-700" />
              <span>3. Archivos Cargados ({comparison.documents.length})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Presupuestos de cada empresa (PDF, Excel, Word, imágenes) y pliego opcional.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setPreselectedCompanyForUpload('pliego');
                setShowUploadModal(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1 cursor-pointer transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>+ Cargar Pliego Original</span>
            </button>

            {participatingCompanies.length > 0 && (
              <button
                onClick={() => {
                  setPreselectedCompanyForUpload(participatingCompanies[0]?.id || 'pliego');
                  setShowUploadModal(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer shadow-xs transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>+ Cargar Presupuesto</span>
              </button>
            )}
          </div>
        </div>

        {comparison.documents.length === 0 ? (
          <div className="p-6 rounded-lg bg-slate-50 border border-dashed border-slate-200 text-center space-y-2">
            <p className="text-xs text-slate-500">
              Todavía no se cargaron archivos en esta obra.
            </p>
            <button
              onClick={() => {
                setPreselectedCompanyForUpload(participatingCompanies[0]?.id || 'pliego');
                setShowUploadModal(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer inline-flex items-center gap-1"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Cargar Presupuesto</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
            {comparison.documents.map((doc) => {
              const compOwner = doc.companyId === 'pliego'
                ? { name: 'Pliego de Bases y Condiciones (Comitente)' }
                : companies.find((c) => c.id === doc.companyId);
              const isProcessed = doc.extractedData && doc.processingStatus === 'completed';
              const isError = doc.processingStatus === 'error';

              return (
                <div
                  key={doc.id}
                  className="p-3.5 bg-white hover:bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="font-bold text-slate-900">{doc.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({(doc.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Asociado a: <strong className="text-slate-700">{compOwner?.name || 'Empresa participante'}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    {/* Status */}
                    {isProcessed ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Leído ({doc.extractedData?.concepts.length || 0} conceptos)</span>
                      </span>
                    ) : isError ? (
                      <span className="text-rose-600 font-semibold flex items-center gap-1 text-[11px]" title={doc.errorMessage}>
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Error de lectura</span>
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[11px]">Pendiente de lectura</span>
                    )}

                    {/* View extracted data */}
                    {isProcessed && (
                      <button
                        onClick={() => setInspectingDoc({ doc, companyName: compOwner?.name || '' })}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-[11px] cursor-pointer flex items-center gap-1 transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Ver datos</span>
                      </button>
                    )}

                    {/* Delete document button */}
                    <button
                      onClick={() => handleDeleteDoc(doc.id, doc.name)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer transition-colors"
                      title="Eliminar archivo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* =========================================================================
          SECCIÓN 4: CUADRO COMPARATIVO DE PRESUPUESTOS (LA MATRIZ)
      ========================================================================= */}
      <section className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <TableProperties className="w-4 h-4 text-slate-700" />
              <span>4. Cuadro Comparativo de Presupuestos</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Empresas en columnas y conceptos en filas. Haz clic en una celda para ver citas del documento o modificar datos.
            </p>
          </div>

          {hasAnalysis && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-600">
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">✓ Incluido</span>
              <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">✕ No incluido</span>
              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">◐ Parcial</span>
              <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">★ Mejora</span>
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">⏳ Pendiente</span>
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">? No informado</span>
            </div>
          )}
        </div>

        {!hasAnalysis ? (
          <div className="p-8 rounded-lg bg-slate-50 border border-dashed border-slate-200 text-center space-y-3">
            <p className="text-xs text-slate-500">
              El cuadro comparativo se construirá automáticamente al presionar &quot;Analizar propuestas&quot;.
            </p>
            <button
              onClick={handleAnalyzeWithAi}
              disabled={isAnalyzing || participatingCompanies.length === 0}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isAnalyzing ? 'Leyendo...' : 'Analizar propuestas'}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Resumen Superior de Propuestas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {participatingCompanies.map(comp => {
                const summary = comparison.proposalSummaries?.find(s => s.companyId === comp.id);
                const priceItem = comparison.items.find(i => i.category === 'precio' || i.concept.toLowerCase().includes('precio'));
                const priceVal = priceItem?.values[comp.id]?.displayValue || summary?.totalPriceText || 'No informado';

                return (
                  <div
                    key={comp.id}
                    className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2"
                  >
                    <div className="font-bold text-slate-900 text-sm">{comp.name}</div>
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Precio Total</span>
                        <span className="font-bold text-slate-900 font-mono text-sm">{priceVal}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Plazo</span>
                        <span className="font-semibold text-slate-700 text-xs flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {summary?.executionTimeframeText || 'No informado'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Matriz Completa */}
            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-900 text-white text-xs">
                    <th className="p-3 w-[260px] font-bold uppercase tracking-wider text-slate-300">
                      Concepto / Trabajo
                    </th>
                    {participatingCompanies.map(comp => (
                      <th key={comp.id} className="p-3 min-w-[200px] border-l border-slate-800">
                        <div className="font-bold text-white text-xs">{comp.name}</div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 text-xs">
                  {comparison.items.map((item, idx) => {
                    const isPriceRow = item.category === 'precio' || item.concept.toLowerCase().includes('precio');

                    return (
                      <tr
                        key={item.id}
                        className={
                          isPriceRow
                            ? 'bg-slate-100 font-semibold'
                            : idx % 2 === 0
                            ? 'bg-white hover:bg-slate-50'
                            : 'bg-slate-50/50 hover:bg-slate-50'
                        }
                      >
                        <td className="p-3 align-middle">
                          <span className="font-bold text-slate-900 block text-xs">{item.concept}</span>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">
                            {item.category}
                          </span>
                        </td>

                        {participatingCompanies.map(comp => {
                          const cellVal = item.values[comp.id];

                          return (
                            <td
                              key={comp.id}
                              onClick={() => {
                                setSelectedCell({
                                  isOpen: true,
                                  concept: item.concept,
                                  companyName: comp.name,
                                  itemId: item.id,
                                  companyId: comp.id,
                                  value: cellVal || {
                                    status: 'no_informado',
                                    displayValue: '',
                                    detail: '',
                                  },
                                });
                              }}
                              className="p-3 border-l border-slate-200 align-top cursor-pointer hover:bg-slate-100/70 transition-colors"
                              title="Haga clic para ver el detalle y referencia al documento original"
                            >
                              <div className="space-y-1">
                                {renderIndicatorBadge(cellVal)}
                                {cellVal?.detail && (
                                  <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">
                                    {cellVal.detail}
                                  </p>
                                )}
                                {(cellVal?.sourcePage || cellVal?.sourceDoc) && (
                                  <div className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                                    <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span>{cellVal.sourcePage || 'Pág. s/d'}</span>
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* =========================================================================
          SECCIÓN 5: DIFERENCIAS ENTRE PROPUESTAS
      ========================================================================= */}
      {hasAnalysis && comparison.differences?.keyDifferences && comparison.differences.keyDifferences.length > 0 && (
        <section className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-3">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Scale className="w-4 h-4 text-slate-700" />
              <span>5. Diferencias entre Propuestas</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Divergencias relevantes identificadas entre las cotizaciones presentadas.
            </p>
          </div>

          <div className="space-y-2">
            {comparison.differences.keyDifferences.map((diff, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700"
              >
                <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center shrink-0 text-[10px]">
                  {idx + 1}
                </span>
                <p className="leading-relaxed">{diff}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* =========================================================================
          SECCIÓN 6: TRAYECTORIA Y ANTECEDENTES
      ========================================================================= */}
      {participatingCompanies.length > 0 && (
        <section className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-3">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4 text-slate-700" />
              <span>6. Trayectoria y Antecedentes</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Información de respaldo y relación previa con cada empresa.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {participatingCompanies.map(comp => (
              <div
                key={comp.id}
                className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2"
              >
                <div className="font-bold text-slate-900 text-sm">{comp.name}</div>
                {comp.yearsInBusiness && (
                  <div className="text-[11px] text-slate-600">
                    <span className="text-slate-400">Trayectoria:</span> {comp.yearsInBusiness} años
                  </div>
                )}
                {comp.reputation && (
                  <div className="text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-700 block">Reconocimiento:</span>
                    <p>{comp.reputation}</p>
                  </div>
                )}
                {comp.previousRelationship && (
                  <div className="text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-700 block">Relación previa:</span>
                    <p>{comp.previousRelationship}</p>
                  </div>
                )}
                {comp.pastProjectsSummary && (
                  <div className="text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-700 block">Obras realizadas:</span>
                    <p>{comp.pastProjectsSummary}</p>
                  </div>
                )}
                {comp.observations && (
                  <div className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-200">
                    Obs: {comp.observations}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* =========================================================================
          SECCIÓN 7: CONCLUSIÓN
      ========================================================================= */}
      {hasAnalysis && comparison.conclusion && (
        <section className="bg-slate-900 text-white rounded-xl p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-800 pb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-slate-300" />
              <span>7. Conclusión y Recomendación Fundamentada</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
            <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700 space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Más Económica</span>
              <p className="text-slate-200 text-xs leading-snug">{comparison.conclusion.cheapestProposal}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700 space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Más Completa</span>
              <p className="text-slate-200 text-xs leading-snug">{comparison.conclusion.mostCompleteProposal}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700 space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Mejores Condiciones</span>
              <p className="text-slate-200 text-xs leading-snug">{comparison.conclusion.bestConditions}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700 space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Justificación de Precios</span>
              <p className="text-slate-200 text-xs leading-snug">
                {comparison.conclusion.priceDifferencesJustification || 'Analizado en matriz'}
              </p>
            </div>
          </div>

          {comparison.conclusion.groundedRecommendation && (
            <div className="p-4 rounded-lg bg-slate-800 border border-slate-700 space-y-1.5">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider block">
                Alternativa Más Conveniente:
              </span>
              <p className="text-xs sm:text-sm text-slate-100 leading-relaxed font-normal">
                {comparison.conclusion.groundedRecommendation}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Cell Detail Drilldown Modal */}
      {selectedCell.isOpen && (
        <CellDetailModal
          isOpen={selectedCell.isOpen}
          onClose={() => setSelectedCell({ ...selectedCell, isOpen: false })}
          concept={selectedCell.concept}
          companyName={selectedCell.companyName}
          value={selectedCell.value}
          onSave={handleSaveCellOverride}
        />
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <UploadDocModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          comparisonId={comparison.id}
          companies={participatingCompanies}
          initialCompanyId={preselectedCompanyForUpload}
          existingDocuments={comparison.documents}
          onDocumentUploaded={onRefreshData}
        />
      )}

      {/* Add Company To Project Modal */}
      {showAddCompanyModal && (
        <AddCompanyToProjectModal
          isOpen={showAddCompanyModal}
          onClose={() => setShowAddCompanyModal(false)}
          comparisonId={comparison.id}
          existingCompanies={companies}
          alreadyAddedCompanyIds={comparison.companyIds}
          onCompanyAdded={onRefreshData}
        />
      )}

      {/* Extracted Data Inspector Modal */}
      {inspectingDoc && (
        <ExtractedDataModal
          isOpen={Boolean(inspectingDoc)}
          onClose={() => setInspectingDoc(null)}
          comparisonId={comparison.id}
          doc={inspectingDoc.doc}
          companyName={inspectingDoc.companyName}
          onSaved={onRefreshData}
        />
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        cancelLabel="Cancelar"
        isDestructive={true}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
