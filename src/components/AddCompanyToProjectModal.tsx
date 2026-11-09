import React, { useState } from 'react';
import { X, Building2, Plus, Check } from 'lucide-react';
import { Company } from '../types';
import { api } from '../services/api';
import { useToast } from './Toast';

interface AddCompanyToProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  comparisonId: string;
  existingCompanies: Company[];
  alreadyAddedCompanyIds: string[];
  onCompanyAdded: () => void;
}

export const AddCompanyToProjectModal: React.FC<AddCompanyToProjectModalProps> = ({
  isOpen,
  onClose,
  comparisonId,
  existingCompanies,
  alreadyAddedCompanyIds,
  onCompanyAdded,
}) => {
  if (!isOpen) return null;

  const { success: toastSuccess, error: toastError } = useToast();
  const [mode, setMode] = useState<'select' | 'create'>('create');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  // Form for new company
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [yearsInBusiness, setYearsInBusiness] = useState<number | undefined>(undefined);
  const [reputation, setReputation] = useState('');
  const [previousRelationship, setPreviousRelationship] = useState('');
  const [pastProjectsCount, setPastProjectsCount] = useState<number | undefined>(undefined);
  const [complianceHistory, setComplianceHistory] = useState('');
  const [observations, setObservations] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableToSelect = existingCompanies.filter(c => !alreadyAddedCompanyIds.includes(c.id));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (mode === 'select') {
        if (!selectedCompanyId) {
          toastError('Por favor selecciona una empresa de la lista.');
          setIsSubmitting(false);
          return;
        }
        await api.addCompanyToComparison(comparisonId, { companyId: selectedCompanyId });
      } else {
        if (!name.trim() || !address.trim()) {
          toastError('Nombre de la empresa y Dirección son obligatorios.');
          setIsSubmitting(false);
          return;
        }
        await api.addCompanyToComparison(comparisonId, {
          name: name.trim(),
          address: address.trim(),
          yearsInBusiness,
          reputation,
          previousRelationship,
          pastProjectsCount,
          complianceHistory,
          observations,
        });
      }

      toastSuccess('Empresa asociada a la obra con éxito.');
      onCompanyAdded();
      onClose();
    } catch (err: any) {
      toastError(`Error cargando empresa a la obra: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Cargar Empresa a esta Obra</h3>
            <p className="text-xs text-slate-500">
              Registra qué empresa brindará el servicio para comparar su propuesta.
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch: New Company vs Select Registered */}
        <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
              mode === 'create'
                ? 'bg-white text-indigo-700 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            + Cargar Nueva Empresa
          </button>
          {availableToSelect.length > 0 && (
            <button
              type="button"
              onClick={() => setMode('select')}
              className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                mode === 'select'
                  ? 'bg-white text-indigo-700 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Seleccionar del Registro ({availableToSelect.length})
            </button>
          )}
        </div>

        <form onSubmit={handleAdd} className="space-y-4 text-xs">
          {mode === 'select' ? (
            <div className="space-y-2">
              <label className="font-semibold text-slate-700 block">Selecciona la empresa participante:</label>
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-slate-800 bg-white font-medium text-xs"
              >
                <option value="">Selecciona una empresa...</option>
                {availableToSelect.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} - {c.address}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Mandatory fields */}
              <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-2.5">
                <span className="font-bold text-indigo-950 uppercase text-[10px] tracking-wider block">
                  Datos Obligatorios:
                </span>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Nombre de la Empresa *:</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="p. ej. Constructora Norte S.A."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 bg-white"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Dirección *:</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="p. ej. Calle San Martín 1234, Rosario"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 bg-white"
                    required
                  />
                </div>
              </div>

              {/* Optional Antecedents */}
              <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider block pt-1">
                Ficha de Confianza & Antecedentes (Opcional):
              </span>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Años de Trayectoria:</label>
                  <input
                    type="number"
                    value={yearsInBusiness ?? ''}
                    onChange={(e) => setYearsInBusiness(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="p. ej. 15"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Obras previas con nosotros:</label>
                  <input
                    type="number"
                    value={pastProjectsCount ?? ''}
                    onChange={(e) => setPastProjectsCount(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="p. ej. 2"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Reconocimiento y Reputación:</label>
                <input
                  type="text"
                  value={reputation}
                  onChange={(e) => setReputation(e.target.value)}
                  placeholder="Especialistas en montaje industrial, buena reputación..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Relación Previa con la Contratante:</label>
                <input
                  type="text"
                  value={previousRelationship}
                  onChange={(e) => setPreviousRelationship(e.target.value)}
                  placeholder="Cumplieron en plazo, buena calidad..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Observaciones Generales:</label>
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Equipos propios, soldadores matriculados..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                />
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
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? 'Cargando...' : 'Cargar Empresa a la Obra'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
