import React, { useState } from 'react';
import { X, TableProperties, Sparkles, Building2, Plus, ArrowRight } from 'lucide-react';
import { Company, Comparison } from '../types';
import { api } from '../services/api';
import { useToast } from './Toast';

interface NewComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: Company[];
  onComparisonCreated: (newComp: Comparison) => void;
  onQuickCreateCompany: () => void;
}

export const NewComparisonModal: React.FC<NewComparisonModalProps> = ({
  isOpen,
  onClose,
  companies,
  onComparisonCreated,
  onQuickCreateCompany,
}) => {
  if (!isOpen) return null;

  const { success: toastSuccess, error: toastError } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleCompany = (id: string) => {
    if (selectedCompanyIds.includes(id)) {
      setSelectedCompanyIds(selectedCompanyIds.filter(cId => cId !== id));
    } else {
      setSelectedCompanyIds([...selectedCompanyIds, id]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toastError('Por favor indica el nombre de la obra o proyecto.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await api.createComparison({
        title: title.trim(),
        description: description.trim(),
        date,
        companyIds: selectedCompanyIds,
      });

      toastSuccess(`Obra "${created.title}" creada con éxito.`);
      onComparisonCreated(created);
      onClose();
    } catch (err: any) {
      toastError(`Error creando la obra: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Crear Nueva Obra o Proyecto</h3>
            <p className="text-xs text-slate-500">
              Ingresa el nombre de la obra. Dentro de ella podrás cargar las empresas que van a brindar el servicio y sus presupuestos.
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Main Field: Nombre de la obra o proyecto */}
          <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-150 space-y-1.5">
            <label className="font-bold text-indigo-950 text-xs block">
              1. Nombre de la Obra o Proyecto *:
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="p. ej. Instalación Eléctrica e Iluminación LED Nave 2"
              className="w-full px-3.5 py-2.5 rounded-lg border border-indigo-300 text-slate-900 font-semibold bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
              autoFocus
            />
            <p className="text-[11px] text-indigo-800/80">
              Este es el identificador principal de la obra donde se cargarán las empresas participantes y los presupuestos.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Fecha de la Comparación:</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 bg-white"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Descripción Opcional:</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="p. ej. Nave industrial Sauce Viejo..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 bg-white"
              />
            </div>
          </div>

          {/* Optional: Pre-select companies if already registered */}
          {companies.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 block text-[11px]">
                  Empresas a asociar (opcional, también las puedes cargar una por una dentro de la obra):
                </span>
                <span className="text-[10px] text-slate-400">{selectedCompanyIds.length} seleccionadas</span>
              </div>

              <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50 space-y-1.5 max-h-36 overflow-y-auto">
                {companies.map(c => {
                  const isSelected = selectedCompanyIds.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-white border-indigo-400 shadow-xs'
                          : 'bg-white/60 border-slate-200 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleCompany(c.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span className="font-bold text-slate-800 text-[11px]">{c.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 truncate max-w-[150px]">{c.address}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Creando Obra...' : 'Crear Obra y Cargar Empresas'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
