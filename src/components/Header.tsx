import React from 'react';
import { PlusCircle, Layers, Building2, TableProperties } from 'lucide-react';

interface HeaderProps {
  currentView: 'comparisons' | 'detail' | 'companies';
  onNavigate: (view: 'comparisons' | 'companies') => void;
  onOpenNewComparison: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  onOpenNewComparison,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center gap-6">
          <div
            onClick={() => onNavigate('comparisons')}
            className="flex items-center gap-2.5 cursor-pointer select-none"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xs">
              <TableProperties className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-slate-900 tracking-tight text-base leading-none block">
                Presupuestos & Licitaciones
              </span>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Comparador Inteligente de Propuestas
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1 text-xs font-semibold">
            <button
              onClick={() => onNavigate('comparisons')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                currentView === 'comparisons' || currentView === 'detail'
                  ? 'bg-slate-100 text-slate-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-slate-600" />
              <span>Comparaciones</span>
            </button>
            <button
              onClick={() => onNavigate('companies')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                currentView === 'companies'
                  ? 'bg-slate-100 text-slate-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-slate-600" />
              <span>Empresas</span>
            </button>
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenNewComparison}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 px-3.5 py-2 rounded-xl transition-colors shadow-xs cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nueva Comparación</span>
          </button>
        </div>
      </div>
    </header>
  );
};
