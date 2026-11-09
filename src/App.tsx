import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ComparisonListView } from './components/ComparisonListView';
import { ComparisonDetailView } from './components/ComparisonDetailView';
import { CompaniesView } from './components/CompaniesView';
import { NewComparisonModal } from './components/NewComparisonModal';
import { ToastProvider, useToast } from './components/Toast';
import { AppDatabase, Comparison } from './types';
import { api } from './services/api';
import { RefreshCw, AlertCircle } from 'lucide-react';

function AppContent() {
  const { error: toastError, success: toastSuccess } = useToast();
  const [db, setDb] = useState<AppDatabase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Navigation
  const [currentView, setCurrentView] = useState<'comparisons' | 'detail' | 'companies'>('comparisons');
  const [selectedComparisonId, setSelectedComparisonId] = useState<string | null>(null);

  // Modals
  const [showNewComparisonModal, setShowNewComparisonModal] = useState(false);

  // Load data without flickering full-screen spinner on background updates
  const loadData = async (showSpinner = false) => {
    try {
      if (showSpinner) setIsLoading(true);
      setError(null);
      const data = await api.getDatabase();
      setDb(data);
    } catch (err: any) {
      console.error('Error cargando datos:', err);
      setError(err.message || 'Error cargando datos del servidor.');
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
  }, []);

  // Update a comparison in local state
  const handleUpdateComparison = (updated: Comparison) => {
    if (!db) return;
    const updatedList = db.comparisons.map(c => (c.id === updated.id ? updated : c));
    setDb({ ...db, comparisons: updatedList });
  };

  // Immediate optimistic deletion of a comparison
  const handleDeleteComparison = async (id: string) => {
    if (!db) return;
    // 1. Instant optimistic removal from UI
    setDb(prev => (prev ? { ...prev, comparisons: prev.comparisons.filter(c => c.id !== id) } : null));
    if (selectedComparisonId === id) {
      setSelectedComparisonId(null);
      setCurrentView('comparisons');
    }

    // 2. Perform backend deletion
    try {
      await api.deleteComparison(id);
      toastSuccess('Obra / comparación eliminada definitivamente.');
      await loadData(false);
    } catch (err: any) {
      toastError(`Error al eliminar comparación: ${err.message}`);
      await loadData(false);
    }
  };

  // Immediate optimistic deletion of a company
  const handleDeleteCompany = async (id: string) => {
    if (!db) return;
    // 1. Instant optimistic removal from UI
    setDb(prev => {
      if (!prev) return null;
      return {
        ...prev,
        companies: prev.companies.filter(c => c.id !== id),
        comparisons: prev.comparisons.map(comp => ({
          ...comp,
          companyIds: comp.companyIds.filter(cid => cid !== id),
        })),
      };
    });

    // 2. Perform backend deletion
    try {
      await api.deleteCompany(id);
      toastSuccess('Empresa eliminada correctamente.');
      await loadData(false);
    } catch (err: any) {
      toastError(`Error al eliminar empresa: ${err.message}`);
      await loadData(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-800 space-y-3">
        <RefreshCw className="w-6 h-6 animate-spin text-slate-600" />
        <span className="text-xs font-semibold text-slate-500">Iniciando aplicación...</span>
      </div>
    );
  }

  if (error || !db) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-800">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-sm border border-slate-200 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h2 className="text-base font-bold text-slate-900">Error de Conexión</h2>
          <p className="text-xs text-slate-600">{error || 'No se pudo inicializar la aplicación.'}</p>
          <button
            onClick={() => loadData(true)}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const selectedComparison = selectedComparisonId
    ? db.comparisons.find(c => c.id === selectedComparisonId)
    : null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans antialiased selection:bg-slate-900 selection:text-white">
      {/* Header */}
      <Header
        currentView={currentView}
        onNavigate={(view) => {
          setCurrentView(view);
          if (view === 'comparisons') {
            setSelectedComparisonId(null);
          }
        }}
        onOpenNewComparison={() => setShowNewComparisonModal(true)}
      />

      {/* Main View Area */}
      <main className="flex-1 pb-16">
        {currentView === 'comparisons' && (
          <ComparisonListView
            comparisons={db.comparisons}
            companies={db.companies}
            onSelectComparison={(id) => {
              setSelectedComparisonId(id);
              setCurrentView('detail');
            }}
            onOpenNewComparison={() => setShowNewComparisonModal(true)}
            onDeleteComparison={handleDeleteComparison}
            onRefreshData={() => loadData(false)}
          />
        )}

        {currentView === 'detail' && selectedComparison && (
          <ComparisonDetailView
            comparison={selectedComparison}
            companies={db.companies}
            onBack={() => {
              setCurrentView('comparisons');
              setSelectedComparisonId(null);
            }}
            onUpdateComparison={handleUpdateComparison}
            onDeleteComparison={handleDeleteComparison}
            onRefreshData={() => loadData(false)}
          />
        )}

        {currentView === 'companies' && (
          <CompaniesView
            companies={db.companies}
            comparisons={db.comparisons}
            onDeleteCompany={handleDeleteCompany}
            onRefreshData={() => loadData(false)}
          />
        )}
      </main>

      {/* New Comparison Modal */}
      {showNewComparisonModal && (
        <NewComparisonModal
          isOpen={showNewComparisonModal}
          onClose={() => setShowNewComparisonModal(false)}
          companies={db.companies}
          onComparisonCreated={(newComp) => {
            setDb({ ...db, comparisons: [newComp, ...db.comparisons] });
            setSelectedComparisonId(newComp.id);
            setCurrentView('detail');
          }}
          onQuickCreateCompany={() => {
            setShowNewComparisonModal(false);
            setCurrentView('companies');
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
