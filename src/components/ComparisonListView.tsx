import React, { useState } from 'react';
import { PlusCircle, Calendar, Trash2, ArrowRight, TableProperties } from 'lucide-react';
import { Comparison, Company } from '../types';
import { api } from '../services/api';
import { ConfirmDialog } from './ConfirmDialog';
import { useToast } from './Toast';

interface ComparisonListViewProps {
  comparisons: Comparison[];
  companies: Company[];
  onSelectComparison: (id: string) => void;
  onOpenNewComparison: () => void;
  onDeleteComparison?: (id: string) => Promise<void>;
  onRefreshData: () => void;
}

export const ComparisonListView: React.FC<ComparisonListViewProps> = ({
  comparisons,
  companies,
  onSelectComparison,
  onOpenNewComparison,
  onDeleteComparison,
  onRefreshData,
}) => {
  const { error: toastError, success: toastSuccess } = useToast();
  const [comparisonToDelete, setComparisonToDelete] = useState<Comparison | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<string>('');

  const handleRequestDelete = (comp: Comparison, e: React.MouseEvent) => {
    e.stopPropagation();
    const docCount = comp.documents?.length || 0;
    const msg = docCount > 0
      ? `¿Estás seguro de eliminar la comparación "${comp.title}"?\nEsta acción eliminará permanentemente sus ${docCount} documento(s) adjunto(s) y el análisis comparativo.`
      : `¿Estás seguro de eliminar la comparación "${comp.title}"? Esta acción no se puede deshacer.`;

    setDeleteMessage(msg);
    setComparisonToDelete(comp);
  };

  const handleConfirmDelete = async () => {
    if (!comparisonToDelete) return;
    const targetComp = comparisonToDelete;
    setComparisonToDelete(null);

    try {
      if (onDeleteComparison) {
        await onDeleteComparison(targetComp.id);
      } else {
        await api.deleteComparison(targetComp.id);
        toastSuccess(`Comparación "${targetComp.title}" eliminada.`);
        onRefreshData();
      }
    } catch (err: any) {
      toastError(`Error al eliminar la comparación: ${err.message}`);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Title & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight sm:text-2xl">
            Comparaciones
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Análisis y comparación visual de presupuestos y propuestas.
          </p>
        </div>

        <button
          onClick={onOpenNewComparison}
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-2 cursor-pointer shadow-xs transition-colors self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Nueva comparación</span>
        </button>
      </div>

      {/* Comparisons List or Clean Empty State */}
      {comparisons.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
          <TableProperties className="w-10 h-10 text-slate-400 mx-auto" />
          <p className="text-sm text-slate-600 font-medium">
            Todavía no hay comparaciones. Creá una para comenzar.
          </p>
          <button
            onClick={onOpenNewComparison}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nueva comparación</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {comparisons.map((comp) => {
            const participating = companies.filter((c) => comp.companyIds.includes(c.id));
            const hasAnalysis = comp.items && comp.items.length > 0;
            const docCount = comp.documents?.length || 0;

            return (
              <div
                key={comp.id}
                onClick={() => onSelectComparison(comp.id)}
                className="bg-white rounded-xl p-5 border border-slate-200 hover:border-slate-400 hover:shadow-xs transition-all cursor-pointer space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                        <Calendar className="w-3 h-3" />
                        {comp.date}
                      </span>
                      {hasAnalysis ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Analizado ({comp.items.length} conceptos)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          {docCount > 0 ? `${docCount} archivo(s) - Pendiente de análisis` : 'Sin archivos'}
                        </span>
                      )}
                    </div>

                    <h2 className="text-base font-bold text-slate-900 hover:text-indigo-600 transition-colors">
                      {comp.title}
                    </h2>
                    {comp.description && (
                      <p className="text-xs text-slate-500 line-clamp-1">{comp.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      onClick={(e) => handleRequestDelete(comp, e)}
                      className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                      title="Eliminar comparación"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onSelectComparison(comp.id)}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Abrir</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {participating.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
                    <span className="text-[11px] text-slate-400 font-medium">Empresas:</span>
                    {participating.map((c) => (
                      <span
                        key={c.id}
                        className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium"
                      >
                        {c.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Dialog for Comparison Deletion */}
      <ConfirmDialog
        isOpen={Boolean(comparisonToDelete)}
        title="Eliminar Comparación"
        message={deleteMessage}
        confirmLabel="Eliminar Definitivamente"
        cancelLabel="Cancelar"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setComparisonToDelete(null)}
      />
    </div>
  );
};
