import React, { useState } from 'react';
import { Building2, Plus, Edit, Trash2, MapPin } from 'lucide-react';
import { Company, Comparison } from '../types';
import { api } from '../services/api';
import { ConfirmDialog } from './ConfirmDialog';
import { useToast } from './Toast';

interface CompaniesViewProps {
  companies: Company[];
  comparisons?: Comparison[];
  onDeleteCompany?: (id: string) => Promise<void>;
  onRefreshData: () => void;
}

export const CompaniesView: React.FC<CompaniesViewProps> = ({
  companies,
  comparisons = [],
  onDeleteCompany,
  onRefreshData,
}) => {
  const { success: toastSuccess, error: toastError } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editingComp, setEditingComp] = useState<Company | null>(null);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [deleteDialogMessage, setDeleteDialogMessage] = useState<string>('');

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    yearsInBusiness: undefined as number | undefined,
    reputation: '',
    previousRelationship: '',
    pastProjectsSummary: '',
    observations: '',
  });

  const handleOpenCreate = () => {
    setEditingComp(null);
    setFormData({
      name: '',
      address: '',
      yearsInBusiness: undefined,
      reputation: '',
      previousRelationship: '',
      pastProjectsSummary: '',
      observations: '',
    });
    setShowModal(true);
  };

  const handleOpenEdit = (comp: Company) => {
    setEditingComp(comp);
    setFormData({
      name: comp.name,
      address: comp.address,
      yearsInBusiness: comp.yearsInBusiness,
      reputation: comp.reputation || '',
      previousRelationship: comp.previousRelationship || '',
      pastProjectsSummary: comp.pastProjectsSummary || '',
      observations: comp.observations || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.address.trim()) {
      toastError('Nombre de la empresa y Dirección son obligatorios.');
      return;
    }

    try {
      if (editingComp) {
        await api.updateCompany(editingComp.id, formData);
        toastSuccess('Empresa actualizada correctamente.');
      } else {
        await api.createCompany(formData);
        toastSuccess('Empresa registrada con éxito.');
      }
      setShowModal(false);
      onRefreshData();
    } catch (err: any) {
      toastError(`Error guardando empresa: ${err.message}`);
    }
  };

  const handleRequestDelete = (comp: Company) => {
    const linked = comparisons.filter((c) => c.companyIds.includes(comp.id));
    let message = `¿Estás seguro de eliminar la empresa "${comp.name}"? Esta acción no se puede deshacer.`;

    if (linked.length > 0) {
      const titles = linked.map((c) => `• ${c.title}`).join('\n');
      message = `ATENCIÓN: La empresa "${comp.name}" está vinculada a ${linked.length} obra(s) o comparación(es):\n${titles}\n\nSi la eliminas, se desvinculará automáticamente de estas comparaciones. ¿Deseas continuar?`;
    }

    setDeleteDialogMessage(message);
    setCompanyToDelete(comp);
  };

  const handleConfirmDelete = async () => {
    if (!companyToDelete) return;
    const targetComp = companyToDelete;
    setCompanyToDelete(null);

    try {
      if (onDeleteCompany) {
        await onDeleteCompany(targetComp.id);
      } else {
        await api.deleteCompany(targetComp.id);
        toastSuccess(`Empresa "${targetComp.name}" eliminada.`);
        onRefreshData();
      }
    } catch (err: any) {
      toastError(`Error eliminando empresa: ${err.message}`);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Title & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight sm:text-2xl">
            Empresas
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Registro de contratistas, proveedores y antecedentes comerciales.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-2 cursor-pointer shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Cargar empresa</span>
        </button>
      </div>

      {/* Companies List or Empty State */}
      {companies.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
          <Building2 className="w-10 h-10 text-slate-400 mx-auto" />
          <p className="text-sm text-slate-600 font-medium">
            Todavía no hay empresas registradas. Creá una para comenzar.
          </p>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Cargar empresa</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {companies.map((comp) => (
            <div
              key={comp.id}
              className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-bold text-slate-900 text-base">{comp.name}</h2>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{comp.address}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEdit(comp)}
                      className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                      title="Editar ficha"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRequestDelete(comp)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer transition-colors"
                      title="Eliminar empresa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Trayectoria */}
                {comp.yearsInBusiness && (
                  <div className="text-[11px] font-medium text-slate-600">
                    <span className="text-slate-400">Trayectoria:</span> {comp.yearsInBusiness} años
                  </div>
                )}

                {/* Reconocimiento y reputación */}
                {comp.reputation && (
                  <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                      Reconocimiento
                    </span>
                    <p className="leading-snug">{comp.reputation}</p>
                  </div>
                )}

                {/* Relación previa */}
                {comp.previousRelationship && (
                  <div className="text-xs text-slate-700">
                    <span className="font-semibold text-slate-800 text-[11px] block">Relación previa:</span>
                    <p className="text-slate-600 leading-snug">{comp.previousRelationship}</p>
                  </div>
                )}

                {/* Obras realizadas */}
                {comp.pastProjectsSummary && (
                  <div className="text-xs text-slate-700">
                    <span className="font-semibold text-slate-800 text-[11px] block">Obras realizadas:</span>
                    <p className="text-slate-600 leading-snug">{comp.pastProjectsSummary}</p>
                  </div>
                )}

                {/* Observaciones */}
                {comp.observations && (
                  <div className="text-[11px] text-slate-500 italic pt-2 border-t border-slate-100">
                    Obs: {comp.observations}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Crear / Editar Empresa */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-slate-900 text-base">
              {editingComp ? 'Editar Empresa' : 'Nueva Empresa'}
            </h3>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              {/* Obligatorios */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nombre de la Empresa *:</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="p. ej. Calle San Martín 1234, Rosario"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 bg-white"
                  required
                />
              </div>

              {/* Opcionales */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Años de Trayectoria:</label>
                <input
                  type="number"
                  value={formData.yearsInBusiness ?? ''}
                  onChange={(e) => setFormData({ ...formData, yearsInBusiness: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="p. ej. 15"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Reconocimiento y Reputación:</label>
                <input
                  type="text"
                  value={formData.reputation}
                  onChange={(e) => setFormData({ ...formData, reputation: e.target.value })}
                  placeholder="Especialistas en montaje industrial, buena reputación..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Relación Previa con la Organización:</label>
                <input
                  type="text"
                  value={formData.previousRelationship}
                  onChange={(e) => setFormData({ ...formData, previousRelationship: e.target.value })}
                  placeholder="Excelente, contratista habitual, obras previas sin litigios..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Obras Realizadas Anteriormente:</label>
                <textarea
                  value={formData.pastProjectsSummary}
                  onChange={(e) => setFormData({ ...formData, pastProjectsSummary: e.target.value })}
                  placeholder="Montaje de nave industrial en 2024, ampliación de depósito..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Observaciones:</label>
                <textarea
                  value={formData.observations}
                  onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                  placeholder="Cuadrilla propia, equipamiento propio..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                >
                  {editingComp ? 'Guardar Cambios' : 'Registrar Empresa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Company Deletion */}
      <ConfirmDialog
        isOpen={Boolean(companyToDelete)}
        title="Eliminar Empresa"
        message={deleteDialogMessage}
        confirmLabel="Eliminar Empresa"
        cancelLabel="Cancelar"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setCompanyToDelete(null)}
      />
    </div>
  );
};
