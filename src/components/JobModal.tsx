import React, { useState } from 'react';
import { RenovationJob, JobCategory, CostModel, JobStatus } from '../types';
import { ALL_JOB_CATEGORIES, getISDEConfig } from '../utils/isde';
import { X, ExternalLink, Leaf, Info, ShieldCheck } from 'lucide-react';

interface JobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (job: Omit<RenovationJob, 'id' | 'assignedItemIds'>) => void;
  initialJob?: RenovationJob | null;
  initialItemCount?: number;
}

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6', '#ef4444'];

export const JobModal: React.FC<JobModalProps> = ({ isOpen, onClose, onSave, initialJob, initialItemCount = 0 }) => {
  const [title, setTitle] = useState(initialJob?.title || '');
  const [category, setCategory] = useState<JobCategory>(initialJob?.category || ALL_JOB_CATEGORIES[0]);
  const [color, setColor] = useState(initialJob?.color || '#10b981');
  const [costModel, setCostModel] = useState<CostModel>(initialJob?.costModel || 'per_m2');
  const [unitPrice, setUnitPrice] = useState<number>(initialJob?.unitPrice || 65);
  const [fixedPrice, setFixedPrice] = useState<number>(initialJob?.fixedPrice || 0);
  const [status, setStatus] = useState<JobStatus>(initialJob?.status || 'todo');
  const [notes, setNotes] = useState(initialJob?.notes || '');

  React.useEffect(() => {
    if (isOpen) {
      if (initialJob) {
        setTitle(initialJob.title);
        setCategory(initialJob.category);
        setColor(initialJob.color);
        setCostModel(initialJob.costModel);
        setUnitPrice(initialJob.unitPrice);
        setFixedPrice(initialJob.fixedPrice);
        setStatus(initialJob.status);
        setNotes(initialJob.notes || '');
      } else {
        const defaultCat = ALL_JOB_CATEGORIES[0];
        const isdeCfg = getISDEConfig(defaultCat);
        setTitle(isdeCfg ? isdeCfg.shortLabel : '');
        setCategory(defaultCat);
        setColor('#10b981');
        setCostModel(isdeCfg ? isdeCfg.defaultCostModel : 'per_m2');
        setUnitPrice(isdeCfg ? isdeCfg.defaultUnitPrice : 25);
        setFixedPrice(isdeCfg ? isdeCfg.defaultFixedPrice : 0);
        setStatus('todo');
        setNotes('');
      }
    }
  }, [isOpen, initialJob]);

  const handleCategoryChange = (newCat: JobCategory) => {
    setCategory(newCat);
    const isdeCfg = getISDEConfig(newCat);
    if (isdeCfg) {
      if (!initialJob || !title) {
        setTitle(isdeCfg.shortLabel);
      }
      setCostModel(isdeCfg.defaultCostModel);
      setUnitPrice(isdeCfg.defaultUnitPrice);
      setFixedPrice(isdeCfg.defaultFixedPrice);
      if (!initialJob) setColor('#10b981');
    }
  };

  if (!isOpen) return null;

  const currentISDE = getISDEConfig(category);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      title,
      category,
      color,
      costModel,
      unitPrice,
      fixedPrice,
      status,
      notes,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-lg text-amber-400">
              {initialJob
                ? 'Klus Bewerken'
                : initialItemCount > 0
                ? `Nieuwe Klus (${initialItemCount} item${initialItemCount > 1 ? 's' : ''})`
                : 'Nieuwe Klus Toevoegen'}
            </h3>
            {currentISDE && (
              <span className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <Leaf className="w-3 h-3 text-emerald-400" />
                <span>ISDE Subsidie</span>
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Categorie</label>
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value as JobCategory)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-100 outline-none focus:border-amber-500"
            >
              <optgroup label="🍃 ISDE Subsidie Maatregelen (RVO)">
                {ALL_JOB_CATEGORIES.filter((c) => c.startsWith('🍃')).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </optgroup>
              <optgroup label="🔨 Reguliere Verbouwklussen">
                {ALL_JOB_CATEGORIES.filter((c) => !c.startsWith('🍃')).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* ISDE Subsidie Info Box */}
          {currentISDE && (
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>RVO ISDE Subsidie Voorwaarden</span>
                </div>
                <a
                  href={currentISDE.rvoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 hover:underline bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md transition"
                >
                  <span>Bron: RVO.nl</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <p className="text-slate-300 text-[11px] leading-relaxed">{currentISDE.description}</p>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="bg-slate-950/80 p-2 rounded-xl border border-emerald-500/20">
                  <div className="text-[10px] text-slate-400">Subsidietarief</div>
                  <div className="font-bold text-emerald-300 text-xs">
                    € {currentISDE.singleRate.toFixed(2)} / {currentISDE.unit}
                    {currentISDE.singleRate !== currentISDE.doubleRate && (
                      <div className="text-[10px] text-emerald-400 font-extrabold mt-0.5">
                        € {currentISDE.doubleRate.toFixed(2)} bij 2+ maatregelen
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-slate-950/80 p-2 rounded-xl border border-emerald-500/20">
                  <div className="text-[10px] text-slate-400">Min. Oppervlakte</div>
                  <div className="font-bold text-slate-200 text-xs">
                    {currentISDE.minQuantity} {currentISDE.unit}
                  </div>
                </div>

                <div className="bg-slate-950/80 p-2 rounded-xl border border-emerald-500/20">
                  <div className="text-[10px] text-slate-400">Max. Oppervlakte</div>
                  <div className="font-bold text-slate-200 text-xs">
                    {currentISDE.maxQuantity ? `${currentISDE.maxQuantity} ${currentISDE.unit}` : 'Geen max.'}
                  </div>
                </div>
              </div>

              <div className="text-xs bg-slate-950/90 p-2.5 rounded-xl border border-emerald-500/20 space-y-1">
                <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Vereiste Isolatiewaarde & Eisen</span>
                </div>
                <div className="font-semibold text-slate-200 text-xs pl-5">
                  {currentISDE.rdValueRequirement}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Titel van de Klus</label>
            <input
              type="text"
              placeholder="bijv. Buitengevel Isolatie met HR Parels"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Kleur Label</label>
            <div className="flex gap-2">
              {COLORS.map((col) => (
                <button
                  type="button"
                  key={col}
                  onClick={() => setColor(col)}
                  className={`w-6 h-6 rounded-full border-2 transition ${
                    color === col ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Prijsmodel</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCostModel('per_m2')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition border ${
                  costModel === 'per_m2'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                Per m² (€ / m²)
              </button>

              <button
                type="button"
                onClick={() => setCostModel('per_m1')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition border ${
                  costModel === 'per_m1'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                Per m1 (€ / m1)
              </button>

              <button
                type="button"
                onClick={() => setCostModel('per_piece')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition border ${
                  costModel === 'per_piece'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                Per Stuk (€ / st.)
              </button>

              <button
                type="button"
                onClick={() => setCostModel('fixed')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition border ${
                  costModel === 'fixed'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                Vaste Prijs (€)
              </button>
            </div>
          </div>

          {costModel === 'fixed' ? (
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Totaal Vaste Prijs (€)</label>
              <input
                type="number"
                step="5"
                value={fixedPrice}
                onChange={(e) => setFixedPrice(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500"
              />
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Eenheidsprijs (€ / {costModel === 'per_m2' ? 'm²' : costModel === 'per_m1' ? 'm1' : 'stuk'})
              </label>
              <input
                type="number"
                step="0.50"
                value={unitPrice}
                onChange={(e) => setUnitPrice(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Notities & Specificaties</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Aanvullende specificaties, isolatiemateriaal, meldcodes of offerte details..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-amber-500 resize-none"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800 transition"
            >
              Annuleren
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow-md"
            >
              Klus Opslaan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

