import React, { useState } from 'react';
import { X, FileText, Quote, Check, Save } from 'lucide-react';
import { CellValue, ConceptStatus } from '../types';

interface CellDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  concept: string;
  companyName: string;
  value: CellValue;
  onSave: (updated: CellValue) => void;
}

export const CellDetailModal: React.FC<CellDetailModalProps> = ({
  isOpen,
  onClose,
  concept,
  companyName,
  value,
  onSave,
}) => {
  if (!isOpen) return null;

  const [status, setStatus] = useState<ConceptStatus>(value?.status || 'no_informado');
  const [displayValue, setDisplayValue] = useState(value?.displayValue || '');
  const [detail, setDetail] = useState(value?.detail || '');
  const [price, setPrice] = useState(value?.price || '');
  const [quantity, setQuantity] = useState(value?.quantity || '');
  const [technicalSpecs, setTechnicalSpecs] = useState(value?.technicalSpecs || '');
  const [sourceDoc, setSourceDoc] = useState(value?.sourceDoc || '');
  const [sourcePage, setSourcePage] = useState(value?.sourcePage || '');
  const [userNotes, setUserNotes] = useState(value?.userNotes || '');

  const handleSave = () => {
    onSave({
      status,
      displayValue,
      detail,
      price,
      quantity,
      technicalSpecs,
      sourceDoc,
      sourcePage,
      verifiedByUser: true,
      userNotes,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-start justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
              Detalle del Concepto en la Propuesta
            </span>
            <h2 className="text-base font-bold text-slate-900 mt-1">{concept}</h2>
            <p className="text-xs text-slate-500 font-medium">Empresa: <span className="text-slate-900 font-bold">{companyName}</span></p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Status selector */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Estado de Inclusión:</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'incluido', label: '✓ Incluido', color: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
                { id: 'no_incluido', label: '✕ No incluido', color: 'bg-rose-50 text-rose-800 border-rose-300' },
                { id: 'parcial', label: '◐ Parcial', color: 'bg-amber-50 text-amber-800 border-amber-300' },
                { id: 'mejora', label: '★ Mejora / Adicional', color: 'bg-indigo-50 text-indigo-800 border-indigo-300' },
                { id: 'pendiente_validacion', label: '⏳ Pendiente', color: 'bg-amber-100 text-amber-900 border-amber-300' },
                { id: 'no_informado', label: '? No informado', color: 'bg-slate-50 text-slate-700 border-slate-300' },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setStatus(opt.id as ConceptStatus)}
                  className={`p-2 rounded-lg border text-center font-bold text-xs cursor-pointer transition-all ${
                    status === opt.id
                      ? `${opt.color} ring-2 ring-indigo-500`
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Display text in table */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Texto Visible en la Tabla:</label>
            <input
              type="text"
              value={displayValue}
              onChange={(e) => setDisplayValue(e.target.value)}
              placeholder="p. ej. USD 825.000, ✓ Incluido, 18 semanas..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 font-medium"
            />
          </div>

          {/* Extracted Detail */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Descripción / Qué dice la propuesta:</label>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={3}
              placeholder="Descripción textual de lo ofertado..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
            />
          </div>

          {/* Price, Quantity, Specs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Precio Ofertado (si aplica):</label>
              <input
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="p. ej. USD 50.000"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-800"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Cantidad / Unidad (si aplica):</label>
              <input
                type="text"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="p. ej. 1.800 m2"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-800"
              />
            </div>
          </div>

          {/* Document Citation */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              Referencia al Documento Original:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-500 block">Archivo:</span>
                <input
                  type="text"
                  value={sourceDoc}
                  onChange={(e) => setSourceDoc(e.target.value)}
                  placeholder="p. ej. Propuesta_Comercial.pdf"
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 text-slate-800 bg-white"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Página o Sección:</span>
                <input
                  type="text"
                  value={sourcePage}
                  onChange={(e) => setSourcePage(e.target.value)}
                  placeholder="Pág. 8, Cláusula 4..."
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 text-slate-800 bg-white font-mono font-bold text-indigo-700"
                />
              </div>
            </div>
          </div>

          {/* Manual User Notes */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Notas u Observaciones del Ingeniero (Opcional):</label>
            <input
              type="text"
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              placeholder="Confirmado telefónicamente, requiere revisión técnica..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Guardar Corrección</span>
          </button>
        </div>
      </div>
    </div>
  );
};
