import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Clock,
  DollarSign,
  Layers,
} from 'lucide-react';
import { Company, ComparisonDoc } from '../types';
import { api } from '../services/api';

interface UploadDocModalProps {
  isOpen: boolean;
  onClose: () => void;
  comparisonId: string;
  companies: Company[];
  initialCompanyId?: string;
  existingDocuments?: ComparisonDoc[];
  onDocumentUploaded: () => void;
}

type StepState = 'idle' | 'uploading' | 'processing' | 'extracting' | 'completed' | 'error';

export const UploadDocModal: React.FC<UploadDocModalProps> = ({
  isOpen,
  onClose,
  comparisonId,
  companies,
  initialCompanyId = 'pliego',
  existingDocuments = [],
  onDocumentUploaded,
}) => {
  if (!isOpen) return null;

  const [companyId, setCompanyId] = useState<string>(initialCompanyId);
  const [docName, setDocName] = useState('');
  const [file, setFile] = useState<File | null>(null);

  // Pipeline Step State
  const [step, setStep] = useState<StepState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedDoc, setUploadedDoc] = useState<ComparisonDoc | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Timer for active elapsed time
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (step === 'uploading' || step === 'processing' || step === 'extracting') {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step]);

  // Clean state when modal opens
  useEffect(() => {
    setCompanyId(initialCompanyId);
    setDocName('');
    setFile(null);
    setStep('idle');
    setErrorMessage(null);
    setUploadedDoc(null);
    setElapsedSeconds(0);
  }, [isOpen, initialCompanyId]);

  // Process the file through the 4 steps
  const processPipeline = async (selectedFile: File, selectedCompanyId: string, customName?: string) => {
    const finalDocName = customName || selectedFile.name;
    setErrorMessage(null);
    setElapsedSeconds(0);

    // If user selected a file with the same name, proceed with update
    const isDuplicate = existingDocuments.some(
      (d) =>
        d.companyId === selectedCompanyId &&
        d.name.toLowerCase() === finalDocName.toLowerCase() &&
        d.size === selectedFile.size
    );
    if (isDuplicate) {
      console.log(`Reemplazando o reprocesando archivo existente: ${finalDocName}`);
    }

    try {
      // ==========================================
      // PASO 1: SUBIENDO ARCHIVO
      // ==========================================
      setStep('uploading');

      // Read file into memory as base64
      const reader = new FileReader();
      const fileDataPromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Error al leer el archivo en el navegador.'));
      });
      reader.readAsDataURL(selectedFile);
      const fileData = await fileDataPromise;

      const createdDoc = await api.uploadDocument(comparisonId, {
        name: finalDocName,
        companyId: selectedCompanyId,
        size: selectedFile.size,
        mimeType: selectedFile.type || 'application/pdf',
        fileData,
        extractImmediately: false, // Save fast, then trigger Gemini extraction with step feedback
      });

      setUploadedDoc(createdDoc);

      // ==========================================
      // PASO 2: PROCESANDO PDF CON GEMINI
      // ==========================================
      setStep('processing');

      // Start extraction call
      const extractPromise = api.extractDocument(comparisonId, createdDoc.id);

      // Transition to Step 3 after brief initial connection
      const step3Timer = setTimeout(() => {
        setStep((current) => (current === 'processing' ? 'extracting' : current));
      }, 1400);

      const res = await extractPromise;
      clearTimeout(step3Timer);

      if (!res.success || !res.doc) {
        throw new Error('No se recibió confirmación del análisis del documento.');
      }

      // ==========================================
      // PASO 4: ANÁLISIS TERMINADO
      // ==========================================
      setUploadedDoc(res.doc);
      setStep('completed');
      onDocumentUploaded();
    } catch (err: any) {
      console.error('Error en pipeline de subida/lectura:', err);
      setErrorMessage(err.message || 'Error desconocido al procesar el archivo.');
      setStep('error');
    }
  };

  // Trigger retry of extraction without re-uploading
  const handleRetryExtraction = async () => {
    if (!uploadedDoc) {
      if (file) {
        processPipeline(file, companyId, docName);
      }
      return;
    }

    setErrorMessage(null);
    setStep('processing');

    try {
      const step3Timer = setTimeout(() => {
        setStep((current) => (current === 'processing' ? 'extracting' : current));
      }, 1200);

      const res = await api.extractDocument(comparisonId, uploadedDoc.id);
      clearTimeout(step3Timer);

      setUploadedDoc(res.doc);
      setStep('completed');
      onDocumentUploaded();
    } catch (err: any) {
      console.error('Error en reintento:', err);
      setErrorMessage(err.message || 'Error reintentando el análisis con Gemini.');
      setStep('error');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      const nameToUse = docName || selected.name;
      setDocName(nameToUse);
      // Auto-start pipeline immediately upon file selection as requested
      processPipeline(selected, companyId, nameToUse);
    }
  };

  const isWorking = step === 'uploading' || step === 'processing' || step === 'extracting';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              Cargar y Analizar Presupuesto
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Gemini leerá el documento completo, tablas y condiciones comerciales.
            </p>
          </div>
          {!isWorking && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Company Association Picker (disabled while working) */}
        <div className="space-y-1.5 text-xs">
          <label className="font-semibold text-slate-700 block">
            Asociar presupuesto a:
          </label>
          <select
            value={companyId}
            disabled={isWorking}
            onChange={(e) => setCompanyId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 bg-white font-medium disabled:bg-slate-100 disabled:text-slate-500"
          >
            <option value="pliego">📑 Pliego / Solicitud Original del Comitente</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                🏢 {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* =========================================================================
            PROGRESO CLARO DE 4 PASOS
        ========================================================================= */}
        {step !== 'idle' && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Estado del Procesamiento</span>
              </span>
              {isWorking && (
                <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {elapsedSeconds}s
                </span>
              )}
            </div>

            {/* Stepper Visual List */}
            <div className="space-y-2 text-xs">
              {/* Paso 1 */}
              <div className="flex items-center gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 transition-colors ${
                    step === 'uploading'
                      ? 'bg-indigo-600 text-white animate-pulse'
                      : step === 'processing' || step === 'extracting' || step === 'completed'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {step === 'processing' || step === 'extracting' || step === 'completed' ? (
                    '✓'
                  ) : step === 'uploading' ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    '1'
                  )}
                </div>
                <div className="flex-1">
                  <span
                    className={`font-semibold block ${
                      step === 'uploading'
                        ? 'text-indigo-900 font-bold'
                        : step === 'processing' || step === 'extracting' || step === 'completed'
                        ? 'text-emerald-900'
                        : 'text-slate-400'
                    }`}
                  >
                    1. Subiendo archivo
                  </span>
                  {step === 'uploading' && (
                    <span className="text-[10px] text-indigo-600 block">
                      Cargando documento en el servidor de forma segura...
                    </span>
                  )}
                </div>
              </div>

              {/* Paso 2 */}
              <div className="flex items-center gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 transition-colors ${
                    step === 'processing'
                      ? 'bg-indigo-600 text-white animate-pulse'
                      : step === 'extracting' || step === 'completed'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {step === 'extracting' || step === 'completed' ? (
                    '✓'
                  ) : step === 'processing' ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    '2'
                  )}
                </div>
                <div className="flex-1">
                  <span
                    className={`font-semibold block ${
                      step === 'processing'
                        ? 'text-indigo-900 font-bold'
                        : step === 'extracting' || step === 'completed'
                        ? 'text-emerald-900'
                        : 'text-slate-400'
                    }`}
                  >
                    2. Procesando PDF con Gemini
                  </span>
                  {step === 'processing' && (
                    <span className="text-[10px] text-indigo-600 block">
                      Enviando documento original y conectando con el modelo...
                    </span>
                  )}
                </div>
              </div>

              {/* Paso 3 */}
              <div className="flex items-center gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 transition-colors ${
                    step === 'extracting'
                      ? 'bg-indigo-600 text-white animate-pulse'
                      : step === 'completed'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {step === 'completed' ? (
                    '✓'
                  ) : step === 'extracting' ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    '3'
                  )}
                </div>
                <div className="flex-1">
                  <span
                    className={`font-semibold block ${
                      step === 'extracting'
                        ? 'text-indigo-900 font-bold'
                        : step === 'completed'
                        ? 'text-emerald-900'
                        : 'text-slate-400'
                    }`}
                  >
                    3. Extrayendo información
                  </span>
                  {step === 'extracting' && (
                    <span className="text-[10px] text-indigo-600 block">
                      Analizando tablas, precios, cantidades, plazos y especificaciones...
                    </span>
                  )}
                </div>
              </div>

              {/* Paso 4 */}
              <div className="flex items-center gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 transition-colors ${
                    step === 'completed'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {step === 'completed' ? '✓' : '4'}
                </div>
                <div className="flex-1">
                  <span
                    className={`font-semibold block ${
                      step === 'completed' ? 'text-emerald-900 font-bold' : 'text-slate-400'
                    }`}
                  >
                    4. Análisis terminado
                  </span>
                  {step === 'completed' && (
                    <span className="text-[10px] text-emerald-700 block">
                      Información extraída y guardada en la base de datos.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Error View */}
            {step === 'error' && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-rose-800 font-bold">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Error durante el procesamiento</span>
                </div>
                <p className="text-rose-700 text-[11px] leading-relaxed">
                  {errorMessage || 'No se pudo completar la extracción del documento.'}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleRetryExtraction}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reintentar con Gemini</span>
                  </button>
                  <button
                    onClick={() => setStep('idle')}
                    className="px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 font-semibold text-xs cursor-pointer hover:bg-rose-100"
                  >
                    Cambiar archivo
                  </button>
                </div>
              </div>
            )}

            {/* Completed Summary Snapshot */}
            {step === 'completed' && uploadedDoc?.extractedData && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 space-y-2 text-xs">
                <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Datos Extraídos con Éxito</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
                  <div className="bg-white/80 p-2 rounded border border-emerald-200/60">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Precio Total</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {uploadedDoc.extractedData.totalPrice?.text || 'No informado'}
                    </span>
                  </div>

                  <div className="bg-white/80 p-2 rounded border border-emerald-200/60">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Plazo</span>
                    <span className="font-bold text-slate-800">
                      {uploadedDoc.extractedData.executionTimeframe?.text || 'No informado'}
                    </span>
                  </div>

                  <div className="bg-white/80 p-2 rounded border border-emerald-200/60">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Conceptos</span>
                    <span className="font-bold text-indigo-700">
                      {uploadedDoc.extractedData.concepts.length} ítems
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={onClose}
                    className="px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>Listo y ver en la obra</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* File Picker Zone (visible when idle or allows re-picking) */}
        {step === 'idle' && (
          <div className="space-y-3">
            <div>
              <label className="font-semibold text-slate-700 block text-xs mb-1">
                Seleccionar archivo PDF, Excel, Word o Imagen:
              </label>
              <div className="border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-xl p-6 text-center cursor-pointer bg-slate-50 transition-colors">
                <input
                  type="file"
                  id="modal-file-upload"
                  onChange={handleFileChange}
                  accept=".pdf,.xlsx,.xls,.docx,.doc,.jpg,.jpeg,.png,.txt"
                  className="hidden"
                />
                <label
                  htmlFor="modal-file-upload"
                  className="cursor-pointer flex flex-col items-center space-y-1.5"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 mb-1">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-slate-900 text-sm">
                    {file ? file.name : 'Haz clic para seleccionar el archivo'}
                  </span>
                  <p className="text-xs text-slate-500 max-w-xs">
                    Al seleccionar el archivo, la carga y el análisis con Gemini iniciarán de inmediato mostrando el progreso paso a paso.
                  </p>
                  <span className="text-[10px] text-slate-400 pt-1">
                    Formatos soportados: PDF, Excel, Word, Imágenes
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
