import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  RefreshCw,
  Search,
  Users,
  LayoutGrid,
  Download,
  Filter,
} from 'lucide-react';

type EmpleadoBD = {
  id: number;
  nombre_completo: string;
  documento: string;
  cargo: string;
  estado: string;
};

type TurnoExternoApiRow = {
  id: number;
  empleado_id: number | null;
  sucursal_id: number;
  fecha: string | Date;
  hora_inicio: string | null;
  hora_fin: string | null;
  horas_totales: number | null;
  empresa?: string;
  sucursal?: string;
};

type PpyApiRow = {
  empleado_id: number;
  sucursal_id: number;
  fecha_inicio_semana: string | Date;
  sabado?: string | null;
  domingo?: string | null;
  lunes?: string | null;
  martes?: string | null;
  miercoles?: string | null;
  jueves?: string | null;
  viernes?: string | null;
  nombre_empleado?: string | null;
  nombre_sucursal?: string | null;
};

type CeldaCobertura = {
  fecha: string;
  conteoTurnos: number;
  horas: number;
  detalle: string;
  esDescanso: boolean; // PPY o EXTERNOS
  tieneProgramacion: boolean; // turno o descanso (según config)
};

type FilaCobertura = {
  empleadoId: number;
  empleado: string;
  cc: string;
  cargo: string;
  estado: string;

  dias: Record<string, CeldaCobertura>;

  totalTurnosSemana: number;
  totalHorasSemana: number;

  diasConTurno: number;
  diasProgramados: number;
};

function toISODateOnly(v: unknown): string {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function sumarDias(fechaISO: string, dias: number): string {
  const d = new Date(fechaISO + 'T00:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function semanaSabado(fechaISO: string): string {
  const d = new Date(fechaISO + 'T00:00:00');
  const day = d.getDay(); // 0 dom ... 6 sab
  const offset = day === 6 ? 0 : day + 1;
  const inicio = new Date(d);
  inicio.setDate(d.getDate() - offset);
  return inicio.toISOString().slice(0, 10);
}

function horaADecimal(hhmm: string): number | null {
  if (!hhmm || typeof hhmm !== 'string' || !hhmm.includes(':')) return null;
  const [hh, mm] = hhmm.split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh + mm / 60;
}

function horasEntre(hIni: string, hFin: string): number {
  const ini = horaADecimal(hIni);
  const fin = horaADecimal(hFin);
  if (ini == null || fin == null) return 0;
  let total = fin - ini;
  if (total < 0) total += 24;
  return Math.round(total * 10) / 10;
}

function esTextoDescanso(texto: string): boolean {
  const t = texto.toUpperCase().trim();
  // agrega aquí más alias si en tu empresa usan otros códigos
  return t === 'DESC' || t === 'DESCANSO' || t === 'D' || t === 'OFF';
}

// ✅ Descanso en turnos EXTERNOS (como tu captura: "MULTICARRIER - DESCANSO", 0h, 00:00:00)
function esDescansoExterno(t: TurnoExternoApiRow): boolean {
  const emp = String(t.empresa ?? '').toUpperCase();
  const suc = String(t.sucursal ?? '').toUpperCase();

  if (emp.includes('DESC') || suc.includes('DESC')) return true;

  if (typeof t.horas_totales === 'number' && t.horas_totales === 0) return true;

  const hIni = String(t.hora_inicio ?? '').trim();
  const hFin = String(t.hora_fin ?? '').trim();
  if (hIni.startsWith('00:00') && (!hFin || hFin.startsWith('00:00'))) return true;

  return false;
}

function obtenerRangoHorario(textoTurno: string | undefined): { inicio: number; fin: number } | null {
  if (!textoTurno) return null;
  const turno = textoTurno.toUpperCase().trim();

  if (turno === 'AM') return { inicio: 6, fin: 15 };
  if (turno === 'PM') return { inicio: 13, fin: 21 };
  if (turno === 'AM Y PM') return { inicio: 6, fin: 21 };

  if (esTextoDescanso(turno)) return null;

  const nums = turno
    .replace(/[^0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .map((n) => parseInt(n, 10))
    .filter((n) => !Number.isNaN(n));

  if (nums.length === 2) {
    let [ini, fin] = nums;
    if (ini < 6) ini += 12;
    if (fin < 6) fin += 12;
    return { inicio: ini, fin };
  }
  return null;
}

const BASE = 'http://localhost:3001';

export default function DashboardCoberturaTurnos() {
  const [fechaSemana, setFechaSemana] = useState(() => semanaSabado(new Date().toISOString().slice(0, 10)));

  // Estricto
  const [soloActivos, setSoloActivos] = useState(true);
  const [minHorasDia, setMinHorasDia] = useState(6);
  const [minDiasSemana, setMinDiasSemana] = useState(7);

  // descanso cuenta como “programado”
  const [descansoCuentaComoDia, setDescansoCuentaComoDia] = useState(true);

  // filtro cargos (multi)
  const [cargoTerm, setCargoTerm] = useState('');
  const [cargosSeleccionados, setCargosSeleccionados] = useState<string[]>([]);

  // UI
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const [empleados, setEmpleados] = useState<EmpleadoBD[]>([]);
  const [externos, setExternos] = useState<TurnoExternoApiRow[]>([]);
  const [ppys, setPpys] = useState<PpyApiRow[]>([]);

  const rango = useMemo(() => {
    const inicio = fechaSemana;
    const fechas = Array.from({ length: 7 }, (_, i) => sumarDias(inicio, i));
    const fin = fechas[6];
    return { inicio, fin, fechas };
  }, [fechaSemana]);

  const cargar = async () => {
    setCargando(true);
    setError('');
    try {
      const [resEmp, resExt, resPPY] = await Promise.all([
        fetch(`${BASE}/empleados`),
        fetch(`${BASE}/turnos-externos`),
        fetch(`${BASE}/programacion-semanal?fecha=${fechaSemana}`),
      ]);

      if (!resEmp.ok) throw new Error(`Error empleados: ${resEmp.status}`);
      if (!resExt.ok) throw new Error(`Error externos: ${resExt.status}`);
      if (!resPPY.ok) throw new Error(`Error PPY: ${resPPY.status}`);

      const empData = (await resEmp.json()) as EmpleadoBD[];
      const extData = (await resExt.json()) as TurnoExternoApiRow[];
      const ppyData = (await resPPY.json()) as PpyApiRow[];

      setEmpleados(empData);
      setExternos(extData);
      setPpys(ppyData);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error cargando datos';
      console.error(e);
      setError(msg);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaSemana]);

  // cargos disponibles
  const cargosDisponibles = useMemo(() => {
    const set = new Set<string>();
    empleados.forEach((e) => {
      const c = String(e.cargo || '').trim();
      if (c) set.add(c);
    });

    const term = cargoTerm.trim().toLowerCase();
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .filter((c) => (term ? c.toLowerCase().includes(term) : true));
  }, [empleados, cargoTerm]);

  const toggleCargo = (cargo: string) => {
    setCargosSeleccionados((prev) => {
      if (prev.includes(cargo)) return prev.filter((x) => x !== cargo);
      return [...prev, cargo];
    });
  };

  const seleccionarSolo = (cargo: string) => setCargosSeleccionados([cargo]);
  const limpiarCargos = () => setCargosSeleccionados([]);

  // Matriz
  const grid = useMemo(() => {
    const fechas = rango.fechas;

    const initDias = () => {
      const obj: Record<string, CeldaCobertura> = {};
      fechas.forEach((f) => {
        obj[f] = {
          fecha: f,
          conteoTurnos: 0,
          horas: 0,
          detalle: '',
          esDescanso: false,
          tieneProgramacion: false,
        };
      });
      return obj;
    };

    const filasBase: FilaCobertura[] = empleados
      .filter((e) => (soloActivos ? String(e.estado || '').toLowerCase() === 'activo' : true))
      .filter((e) => {
        if (cargosSeleccionados.length === 0) return true;
        return cargosSeleccionados.includes(String(e.cargo || '').trim());
      })
      .map((e) => ({
        empleadoId: e.id,
        empleado: e.nombre_completo,
        cc: e.documento,
        cargo: e.cargo,
        estado: e.estado,
        dias: initDias(),
        totalTurnosSemana: 0,
        totalHorasSemana: 0,
        diasConTurno: 0,
        diasProgramados: 0,
      }));

    const mapFila = new Map<number, FilaCobertura>();
    filasBase.forEach((f) => mapFila.set(f.empleadoId, f));

    // EXTERNOS
    externos.forEach((t) => {
      if (!t.empleado_id) return;

      const fecha = toISODateOnly(t.fecha);
      if (!fecha || fecha < rango.inicio || fecha > rango.fin) return;

      const fila = mapFila.get(t.empleado_id);
      if (!fila) return;

      const celda = fila.dias[fecha];
      if (!celda) return;

      const suc = `${t.empresa ?? ''} ${t.sucursal ?? ''}`.trim() || `Sucursal ${t.sucursal_id}`;

      // ✅ descanso en EXTERNOS
      if (esDescansoExterno(t)) {
        celda.esDescanso = true;
        celda.tieneProgramacion = descansoCuentaComoDia ? true : celda.tieneProgramacion;
        const det = `EXTERNO: ${suc} DESCANSO`;
        celda.detalle = celda.detalle ? `${celda.detalle}\n${det}` : det;
        return; // no suma turnos ni horas
      }

      const horas =
        typeof t.horas_totales === 'number'
          ? t.horas_totales
          : horasEntre(String(t.hora_inicio || ''), String(t.hora_fin || ''));

      celda.conteoTurnos += 1;
      celda.horas += horas;
      celda.tieneProgramacion = true;

      const det = `EXTERNO: ${suc} ${t.hora_inicio ?? ''}-${t.hora_fin ?? ''} (${horas}h)`;
      celda.detalle = celda.detalle ? `${celda.detalle}\n${det}` : det;
    });

    // PPY
    ppys.forEach((p) => {
      const empId = p.empleado_id;
      const inicioSemana = toISODateOnly(p.fecha_inicio_semana);
      if (!inicioSemana) return;

      for (let i = 0; i < 7; i++) {
        const fecha = sumarDias(inicioSemana, i);
        if (fecha < rango.inicio || fecha > rango.fin) continue;

        const fila = mapFila.get(empId);
        if (!fila) continue;

        const keys: Array<keyof PpyApiRow> = ['sabado', 'domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
        const k = keys[i];

        const raw = p[k];
        const textoTurno = raw == null ? '' : String(raw).trim();
        if (!textoTurno) continue;

        const celda = fila.dias[fecha];
        if (!celda) continue;

        if (esTextoDescanso(textoTurno)) {
          celda.esDescanso = true;
          celda.tieneProgramacion = descansoCuentaComoDia ? true : celda.tieneProgramacion;
          const suc = p.nombre_sucursal ?? `Sucursal ${p.sucursal_id}`;
          const det = `PPY: ${suc} DESCANSO`;
          celda.detalle = celda.detalle ? `${celda.detalle}\n${det}` : det;
          continue;
        }

        const rangoHor = obtenerRangoHorario(textoTurno);
        if (!rangoHor) continue;

        const horas = Math.max(0, rangoHor.fin - rangoHor.inicio);

        celda.conteoTurnos += 1;
        celda.horas += horas;
        celda.tieneProgramacion = true;

        const suc = p.nombre_sucursal ?? `Sucursal ${p.sucursal_id}`;
        const det = `PPY: ${suc} ${textoTurno} (${horas}h aprox)`;
        celda.detalle = celda.detalle ? `${celda.detalle}\n${det}` : det;
      }
    });

    // Totales
    filasBase.forEach((f) => {
      const dias = Object.values(f.dias);

      f.totalTurnosSemana = dias.reduce((acc, d) => acc + d.conteoTurnos, 0);
      f.totalHorasSemana = Math.round(dias.reduce((acc, d) => acc + d.horas, 0) * 10) / 10;

      f.diasConTurno = dias.filter((d) => d.conteoTurnos > 0).length;
      f.diasProgramados = dias.filter((d) => d.tieneProgramacion || (descansoCuentaComoDia && d.esDescanso)).length;
    });

    return filasBase;
  }, [
    empleados,
    externos,
    ppys,
    rango.inicio,
    rango.fin,
    rango.fechas,
    soloActivos,
    descansoCuentaComoDia,
    cargosSeleccionados,
  ]);

  const filasFiltradas = useMemo(() => {
    const term = texto.trim().toLowerCase();
    return grid
      .filter((f) => (term ? `${f.empleado} ${f.cc} ${f.cargo}`.toLowerCase().includes(term) : true))
      .sort((a, b) => {
        const aSin = a.diasProgramados === 0 ? 1 : 0;
        const bSin = b.diasProgramados === 0 ? 1 : 0;
        if (aSin !== bSin) return bSin - aSin;

        const aFalt = a.diasProgramados < minDiasSemana ? 1 : 0;
        const bFalt = b.diasProgramados < minDiasSemana ? 1 : 0;
        if (aFalt !== bFalt) return bFalt - aFalt;

        return a.totalHorasSemana - b.totalHorasSemana;
      });
  }, [grid, texto, minDiasSemana]);

  const totalesPorDia = useMemo(() => {
    const out: Record<string, number> = {};
    rango.fechas.forEach((f) => (out[f] = 0));
    filasFiltradas.forEach((row) => {
      rango.fechas.forEach((f) => {
        const celda = row.dias[f];
        const cuenta = celda ? (celda.tieneProgramacion || (descansoCuentaComoDia && celda.esDescanso) ? 1 : 0) : 0;
        out[f] += cuenta;
      });
    });
    return out;
  }, [filasFiltradas, rango.fechas, descansoCuentaComoDia]);

  const kpis = useMemo(() => {
    const sin = filasFiltradas.filter((f) => f.diasProgramados === 0).length;
    const faltanDias = filasFiltradas.filter((f) => f.diasProgramados > 0 && f.diasProgramados < minDiasSemana).length;

    const diasIncompletos = filasFiltradas.filter((f) =>
      rango.fechas.some((d) => {
        const celda = f.dias[d];
        return celda && celda.conteoTurnos > 0 && celda.horas > 0 && celda.horas < minHorasDia;
      })
    ).length;

    return { sin, faltanDias, diasIncompletos, total: filasFiltradas.length };
  }, [filasFiltradas, minDiasSemana, minHorasDia, rango.fechas]);

  const exportarCSV = () => {
    const headers = [
      'NOMBRE',
      'CC',
      'CARGO',
      ...rango.fechas.map((f) => f.slice(5)),
      'DIAS_PROGRAMADOS',
      'DIAS_CON_TURNO',
      'TURNOS_SEMANA',
      'HORAS_SEMANA',
    ];
    const lines = [headers.join(',')];

    filasFiltradas.forEach((r) => {
      const cols = [
        `"${r.empleado.replace(/"/g, '""')}"`,
        `"${r.cc}"`,
        `"${(r.cargo || '').replace(/"/g, '""')}"`,
        ...rango.fechas.map((f) => {
          const c = r.dias[f];
          if (!c) return '0';
          if (c.esDescanso) return 'DESC';
          return String(c.conteoTurnos ?? 0);
        }),
        String(r.diasProgramados),
        String(r.diasConTurno),
        String(r.totalTurnosSemana),
        String(r.totalHorasSemana),
      ];
      lines.push(cols.join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cobertura_${rango.inicio}_a_${rango.fin}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const Card = ({
    title,
    value,
    subtitle,
    tone,
  }: {
    title: string;
    value: number;
    subtitle: string;
    tone: 'red' | 'amber' | 'blue';
  }) => {
    const cls =
      tone === 'red'
        ? 'border-red-200 bg-red-50 text-red-700'
        : tone === 'amber'
          ? 'border-amber-200 bg-amber-50 text-amber-800'
          : 'border-blue-200 bg-blue-50 text-blue-700';
    return (
      <div className={`rounded-2xl border p-4 ${cls}`}>
        <div className="text-xs font-extrabold uppercase tracking-wide opacity-80">{title}</div>
        <div className="text-3xl font-black mt-1">{value}</div>
        <div className="text-xs font-semibold mt-1 opacity-80">{subtitle}</div>
      </div>
    );
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-2xl border shadow-sm p-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <LayoutGrid className="text-slate-700" /> Matriz de cobertura semanal (7 días)
            </div>
            <div className="text-sm text-slate-500">
              Semana: <span className="font-bold">{rango.inicio}</span> a <span className="font-bold">{rango.fin}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:flex gap-2">
            <div className="col-span-2 md:col-span-1">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Fecha inicio semana (sábado)</label>
              <div className="flex items-center gap-2">
                <CalendarDays size={18} className="text-slate-500" />
                <input type="date" value={fechaSemana} onChange={(e) => setFechaSemana(e.target.value)} className="border rounded-xl p-2 w-full" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Mín. días semana</label>
              <input type="number" min={1} max={7} value={minDiasSemana} onChange={(e) => setMinDiasSemana(Number(e.target.value))} className="border rounded-xl p-2 w-full" />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Mín. horas por día</label>
              <input type="number" min={1} max={12} value={minHorasDia} onChange={(e) => setMinHorasDia(Number(e.target.value))} className="border rounded-xl p-2 w-full" />
            </div>

            <div className="flex items-end">
              <button onClick={cargar} className="w-full md:w-auto px-4 py-2 rounded-xl bg-slate-900 text-white font-extrabold hover:bg-slate-800 flex items-center gap-2">
                <RefreshCw size={18} /> {cargando ? 'Cargando...' : 'Actualizar'}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar empleado (nombre / CC / cargo)..." className="w-full pl-10 pr-3 py-2 border rounded-xl" />
          </div>

          <label className="flex items-center gap-2 text-sm font-bold text-slate-700 border rounded-xl p-3 bg-slate-50">
            <input type="checkbox" checked={soloActivos} onChange={(e) => setSoloActivos(e.target.checked)} />
            Solo activos
          </label>

          <button onClick={exportarCSV} className="flex items-center justify-center gap-2 text-sm font-extrabold border rounded-xl p-3 bg-white hover:bg-slate-50" title="Exportar matriz a CSV">
            <Download size={18} /> Exportar CSV
          </button>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-700 border rounded-xl p-3 bg-slate-50">
          <input type="checkbox" checked={descansoCuentaComoDia} onChange={(e) => setDescansoCuentaComoDia(e.target.checked)} />
          En PPY y externos, el descanso cuenta como “día programado” (para cumplir los 7 días)
        </label>

        {/* FILTRO CARGOS */}
        <div className="mt-3 rounded-2xl border bg-white p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-extrabold text-slate-900">
              <Filter size={18} className="text-slate-700" />
              Filtrar por cargos
              <span className="text-xs font-bold text-slate-500">
                ({cargosSeleccionados.length === 0 ? 'Todos' : `${cargosSeleccionados.length} seleccionado(s)`})
              </span>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setCargosSeleccionados(['FDS', 'TC', 'PPY'])} className="px-3 py-2 rounded-xl border font-extrabold text-sm hover:bg-slate-50">
                Solo FDS + TC + PPY
              </button>
              <button onClick={limpiarCargos} className="px-3 py-2 rounded-xl border font-extrabold text-sm hover:bg-slate-50">
                Limpiar
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={cargoTerm}
              onChange={(e) => setCargoTerm(e.target.value)}
              placeholder="Buscar cargo... (ej: FDS, TC, PPY)"
              className="w-full border rounded-xl p-2"
            />

            <div className="text-xs text-slate-500 flex items-center">
              Tip: puedes seleccionar varios cargos. Botón “Solo” para ver solo uno rápido.
            </div>
          </div>

          <div className="mt-3 max-h-44 overflow-auto border rounded-xl">
            {cargosDisponibles.length === 0 && <div className="p-3 text-sm text-slate-500">No hay cargos para mostrar.</div>}

            {cargosDisponibles.map((c) => {
              const checked = cargosSeleccionados.includes(c);
              return (
                <div key={c} className="flex items-center justify-between gap-2 px-3 py-2 border-b last:border-b-0 hover:bg-slate-50">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={checked} onChange={() => toggleCargo(c)} />
                    <span className="font-extrabold">{c}</span>
                  </label>

                  <button onClick={() => seleccionarSolo(c)} className="text-xs font-extrabold px-2 py-1 rounded-lg border hover:bg-white">
                    Solo
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-semibold">
            {error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="rounded-2xl border p-4 bg-white">
          <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Total (filtrado)</div>
          <div className="text-3xl font-black text-slate-900 mt-1">{kpis.total}</div>
          <div className="text-xs font-semibold text-slate-500 mt-1 flex items-center gap-1">
            <CheckCircle2 size={16} className="text-green-600" /> PPY + Externos
          </div>
        </div>

        <Card title="Sin programación" value={kpis.sin} subtitle="0 días con turno o descanso" tone="red" />
        <Card title="Faltan días" value={kpis.faltanDias} subtitle={`< ${minDiasSemana} días programados`} tone="amber" />
        <Card title="Días incompletos" value={kpis.diasIncompletos} subtitle={`algún día con < ${minHorasDia}h`} tone="blue" />
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="p-4">
          <div className="text-lg font-extrabold text-slate-900">Matriz por empleado</div>
          <div className="text-xs text-slate-500">
            Celda: <span className="font-bold">--</span> sin nada · <span className="font-bold">DESC</span> descanso · <span className="font-bold">1/2</span> turnos.
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-white text-xs uppercase">
              <tr>
                <th className="p-3 text-left sticky left-0 bg-slate-900 z-10">Nombre</th>
                {rango.fechas.map((f) => (
                  <th key={f} className="p-3 text-center whitespace-nowrap">
                    {f.slice(5)}
                  </th>
                ))}
                <th className="p-3 text-center whitespace-nowrap">Prog</th>
                <th className="p-3 text-center whitespace-nowrap">Turnos</th>
                <th className="p-3 text-center whitespace-nowrap">Horas</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {filasFiltradas.map((row) => (
                <tr key={row.empleadoId} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900 uppercase sticky left-0 bg-white z-10 border-r">
                    <div className="leading-tight">{row.empleado}</div>
                    <div className="text-[11px] text-slate-500 font-semibold">
                      CC {row.cc} · {row.cargo}
                    </div>
                  </td>

                  {rango.fechas.map((f) => {
                    const celda = row.dias[f];
                    const c = celda?.conteoTurnos ?? 0;
                    const h = Math.round((celda?.horas ?? 0) * 10) / 10;

                    const bg = celda?.esDescanso
                      ? 'bg-slate-100 text-slate-700 border-slate-200'
                      : c === 0
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : h > 0 && h < minHorasDia
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-green-50 text-green-700 border-green-200';

                    const label = celda?.esDescanso ? 'DESC' : c === 0 ? '--' : String(c);
                    const sub = celda?.esDescanso ? '' : c === 0 ? '' : `${h}h`;

                    return (
                      <td key={f} className={`p-2 text-center font-extrabold border ${bg}`} title={celda?.detalle || 'Sin programación'}>
                        {label}
                        <div className="text-[10px] font-bold opacity-70">{sub}</div>
                      </td>
                    );
                  })}

                  <td className={`p-3 text-center font-extrabold ${row.diasProgramados < minDiasSemana ? 'text-amber-700' : 'text-slate-900'}`}>
                    {row.diasProgramados}
                  </td>
                  <td className="p-3 text-center font-extrabold text-slate-900">{row.totalTurnosSemana}</td>
                  <td className="p-3 text-center font-extrabold text-slate-900">{row.totalHorasSemana}</td>
                </tr>
              ))}

              <tr className="bg-slate-50 border-t-2">
                <td className="p-3 font-extrabold text-slate-900 sticky left-0 bg-slate-50 z-10 border-r">Total general (programados por día)</td>
                {rango.fechas.map((f) => (
                  <td key={f} className="p-3 text-center font-black text-slate-900">
                    {totalesPorDia[f]}
                  </td>
                ))}
                <td className="p-3" colSpan={3}></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-slate-50 border-t flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Users size={16} />
            <span className="font-semibold">Cargos activos:</span> {cargosSeleccionados.length === 0 ? 'Todos' : cargosSeleccionados.join(', ')}
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600" />
            Estricto: min días = <span className="font-bold">{minDiasSemana}</span> · min horas/día = <span className="font-bold">{minHorasDia}</span>
          </div>
        </div>
      </div>
    </div>
  );
}