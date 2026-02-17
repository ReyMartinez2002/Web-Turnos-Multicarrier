import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Search, CalendarDays, RefreshCw, Users, Clock } from 'lucide-react';

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

type MiniTurno = {
  empleadoId: number;
  empleado: string;
  cc: string;
  fecha: string; // YYYY-MM-DD
  sucursal: string;
  horaIni: string;
  horaFin: string;
  horas: number;
};

type ResumenEmpleado = {
  empleadoId: number;
  empleado: string;
  cc: string;
  cargo: string;
  estado: string;

  totalHoras: number;
  totalTurnos: number;
  diasConTurno: number;
  diasEsperados: number;

  sinTurnos: boolean;
  leFaltanDias: boolean;
  medioTurno: boolean;

  mini: MiniTurno[];
};

const DIAS_COLS: Array<{ key: keyof PpyApiRow; label: string }> = [
  { key: 'sabado', label: 'SÁB' },
  { key: 'domingo', label: 'DOM' },
  { key: 'lunes', label: 'LUN' },
  { key: 'martes', label: 'MAR' },
  { key: 'miercoles', label: 'MIÉ' },
  { key: 'jueves', label: 'JUE' },
  { key: 'viernes', label: 'VIE' },
];

function toISODateOnly(v: unknown): string {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function horaADecimal(hhmm: string): number | null {
  if (!hhmm || typeof hhmm !== 'string' || !hhmm.includes(':')) return null;
  const [hh, mm] = hhmm.split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh + mm / 60;
}

function obtenerRangoHorario(textoTurno: string | undefined): { inicio: number; fin: number } | null {
  if (!textoTurno) return null;
  const turno = textoTurno.toUpperCase().trim();

  if (turno === 'AM') return { inicio: 6, fin: 15 };
  if (turno === 'PM') return { inicio: 13, fin: 21 };
  if (turno === 'AM Y PM') return { inicio: 6, fin: 21 };
  if (turno === 'DESC' || turno === 'DESCANSO') return null;

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

function horasEntre(hIni: string, hFin: string): number {
  const ini = horaADecimal(hIni);
  const fin = horaADecimal(hFin);
  if (ini == null || fin == null) return 0;
  let total = fin - ini;
  if (total < 0) total += 24;
  return Math.round(total * 10) / 10;
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

const BASE = 'http://localhost:3001';

export default function DashboardCoberturaTurnos() {
  const [fechaSemana, setFechaSemana] = useState(() => semanaSabado(new Date().toISOString().slice(0, 10)));
  const [diasEsperados, setDiasEsperados] = useState(6);
  const [umbralMedioTurnoHoras, setUmbralMedioTurnoHoras] = useState(4);

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string>('');

  const [empleados, setEmpleados] = useState<EmpleadoBD[]>([]);
  const [externos, setExternos] = useState<TurnoExternoApiRow[]>([]);
  const [ppys, setPpys] = useState<PpyApiRow[]>([]);

  const [texto, setTexto] = useState('');
  const [soloActivos, setSoloActivos] = useState(true);

  const [vista, setVista] = useState<'SIN_TURNOS' | 'FALTANTES' | 'MEDIO_TURNO'>('SIN_TURNOS');

  const rango = useMemo(() => {
    const inicio = fechaSemana;
    const fin = sumarDias(fechaSemana, 6);
    return { inicio, fin };
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

      const extSemana = (extData || [])
        .map((t) => ({
          ...t,
          fecha: toISODateOnly(t.fecha),
        }))
        .filter((t) => String(t.fecha) >= rango.inicio && String(t.fecha) <= rango.fin);

      setExternos(extSemana);

      const ppyNorm = (ppyData || []).map((p) => ({
        ...p,
        fecha_inicio_semana: toISODateOnly(p.fecha_inicio_semana),
      }));

      setPpys(ppyNorm);
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

  const miniTurnosPorEmpleado = useMemo(() => {
    const map = new Map<number, MiniTurno[]>();

    // EXTERNOS
    for (const t of externos) {
      if (!t.empleado_id) continue;
      const fecha = toISODateOnly(t.fecha);
      if (!fecha) continue;

      const horas = typeof t.horas_totales === 'number' ? t.horas_totales : horasEntre(String(t.hora_inicio || ''), String(t.hora_fin || ''));

      const mini: MiniTurno = {
        empleadoId: t.empleado_id,
        empleado: '',
        cc: '',
        fecha,
        sucursal: `${t.empresa ?? ''} ${t.sucursal ?? ''}`.trim() || `Sucursal ${t.sucursal_id}`,
        horaIni: String(t.hora_inicio || ''),
        horaFin: String(t.hora_fin || ''),
        horas,
      };

      if (!map.has(t.empleado_id)) map.set(t.empleado_id, []);
      map.get(t.empleado_id)!.push(mini);
    }

    // PPY
    for (const p of ppys) {
      const empId = p.empleado_id;
      const inicioSemana = toISODateOnly(p.fecha_inicio_semana);
      if (!inicioSemana) continue;

      for (let i = 0; i < 7; i++) {
        const col = DIAS_COLS[i].key;
        const raw = p[col];
        const textoTurno = raw == null ? '' : String(raw).trim();
        if (!textoTurno) continue;

        const rangoHor = obtenerRangoHorario(textoTurno);
        if (!rangoHor) continue;

        const fecha = sumarDias(inicioSemana, i);
        if (fecha < rango.inicio || fecha > rango.fin) continue;

        const horas = Math.max(0, rangoHor.fin - rangoHor.inicio);

        const mini: MiniTurno = {
          empleadoId: empId,
          empleado: '',
          cc: '',
          fecha,
          sucursal: p.nombre_sucursal ?? `Sucursal ${p.sucursal_id}`,
          horaIni: `${String(rangoHor.inicio).padStart(2, '0')}:00`,
          horaFin: `${String(rangoHor.fin).padStart(2, '0')}:00`,
          horas,
        };

        if (!map.has(empId)) map.set(empId, []);
        map.get(empId)!.push(mini);
      }
    }

    // ordenar
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => {
        const fa = a.fecha.localeCompare(b.fecha);
        if (fa !== 0) return fa;
        return a.horaIni.localeCompare(b.horaIni);
      });
      map.set(k, arr);
    }

    return map;
  }, [externos, ppys, rango.inicio, rango.fin]);

  const resumen = useMemo(() => {
    const term = texto.trim().toLowerCase();

    const lista = empleados
      .filter((e) => (soloActivos ? String(e.estado || '').toLowerCase() === 'activo' : true))
      .map((e) => {
        const mini = miniTurnosPorEmpleado.get(e.id) || [];

        const totalHoras = mini.reduce((acc, t) => acc + (t.horas || 0), 0);
        const totalTurnos = mini.length;

        const diasSet = new Set(mini.map((t) => t.fecha));
        const diasConTurno = diasSet.size;

        const sinTurnos = totalTurnos === 0;
        const leFaltanDias = diasConTurno < diasEsperados;
        const medioTurno = totalHoras > 0 && totalHoras <= umbralMedioTurnoHoras;

        const item: ResumenEmpleado = {
          empleadoId: e.id,
          empleado: e.nombre_completo,
          cc: e.documento,
          cargo: e.cargo,
          estado: e.estado,

          totalHoras: Math.round(totalHoras * 10) / 10,
          totalTurnos,
          diasConTurno,
          diasEsperados,

          sinTurnos,
          leFaltanDias,
          medioTurno,

          mini: mini.map((m) => ({ ...m, empleado: e.nombre_completo, cc: e.documento })),
        };

        return item;
      })
      .filter((r) => {
        if (!term) return true;
        const blob = `${r.empleado} ${r.cc} ${r.cargo}`.toLowerCase();
        return blob.includes(term);
      })
      .sort((a, b) => a.empleado.localeCompare(b.empleado));

    const sin = lista.filter((x) => x.sinTurnos);
    const falt = lista.filter((x) => !x.sinTurnos && x.leFaltanDias);
    const medio = lista.filter((x) => x.medioTurno);

    return { lista, sin, falt, medio };
  }, [empleados, miniTurnosPorEmpleado, texto, soloActivos, diasEsperados, umbralMedioTurnoHoras]);

  const miniTabla = useMemo(() => {
    const selected = vista === 'SIN_TURNOS' ? resumen.sin : vista === 'FALTANTES' ? resumen.falt : resumen.medio;

    if (vista === 'SIN_TURNOS') {
      return selected.map((e) => ({
        empleado: e.empleado,
        fecha: `${rango.inicio} a ${rango.fin}`,
        sucursal: '-',
        horaIni: '-',
        horaFin: '-',
        horas: '0',
      }));
    }

    const rows: Array<{ empleado: string; fecha: string; sucursal: string; horaIni: string; horaFin: string; horas: string }> = [];
    selected.forEach((e) => {
      e.mini.forEach((t) => {
        rows.push({
          empleado: e.empleado,
          fecha: t.fecha,
          sucursal: t.sucursal,
          horaIni: t.horaIni,
          horaFin: t.horaFin,
          horas: String(t.horas),
        });
      });
    });

    return rows.slice(0, 120);
  }, [vista, resumen.sin, resumen.falt, resumen.medio, rango.inicio, rango.fin]);

  const Card = ({
    title,
    value,
    subtitle,
    color,
    icon,
    active,
    onClick,
  }: {
    title: string;
    value: number;
    subtitle: string;
    color: 'red' | 'amber' | 'blue' | 'green';
    icon: React.ReactNode;
    active?: boolean;
    onClick?: () => void;
  }) => {
    const styles =
      color === 'red'
        ? 'border-red-200 bg-red-50 text-red-700'
        : color === 'amber'
          ? 'border-amber-200 bg-amber-50 text-amber-800'
          : color === 'blue'
            ? 'border-blue-200 bg-blue-50 text-blue-700'
            : 'border-green-200 bg-green-50 text-green-700';

    const ring = active ? 'ring-2 ring-offset-2 ring-slate-900' : '';

    return (
      <button onClick={onClick} className={`w-full text-left rounded-2xl border p-4 transition hover:shadow-sm ${styles} ${ring}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wide opacity-80">{title}</div>
            <div className="text-3xl font-black mt-1">{value}</div>
            <div className="text-xs font-semibold mt-1 opacity-80">{subtitle}</div>
          </div>
          <div className="p-3 rounded-2xl bg-white/70 border">{icon}</div>
        </div>
      </button>
    );
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-2xl border shadow-sm p-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="text-slate-700" /> Cobertura de turnos (Semanal)
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
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Días esperados</label>
              <input type="number" min={1} max={7} value={diasEsperados} onChange={(e) => setDiasEsperados(Number(e.target.value))} className="border rounded-xl p-2 w-full" />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Umbral medio turno (h)</label>
              <input type="number" min={1} max={12} value={umbralMedioTurnoHoras} onChange={(e) => setUmbralMedioTurnoHoras(Number(e.target.value))} className="border rounded-xl p-2 w-full" />
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

          <div className="text-sm text-slate-600 border rounded-xl p-3 bg-white flex items-center gap-2">
            <Clock className="text-slate-500" size={18} />
            Total empleados en análisis: <span className="font-extrabold text-slate-900">{resumen.lista.length}</span>
          </div>
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-semibold">
            {error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card
          title="Sin turnos"
          value={resumen.sin.length}
          subtitle="No tiene nada asignado (PPY + externos)"
          color="red"
          icon={<AlertTriangle />}
          active={vista === 'SIN_TURNOS'}
          onClick={() => setVista('SIN_TURNOS')}
        />
        <Card
          title="Faltan días"
          value={resumen.falt.length}
          subtitle={`Tiene menos de ${diasEsperados} días con turno`}
          color="amber"
          icon={<AlertTriangle />}
          active={vista === 'FALTANTES'}
          onClick={() => setVista('FALTANTES')}
        />
        <Card
          title="Medio turno"
          value={resumen.medio.length}
          subtitle={`Total horas en semana ≤ ${umbralMedioTurnoHoras}h`}
          color="blue"
          icon={<AlertTriangle />}
          active={vista === 'MEDIO_TURNO'}
          onClick={() => setVista('MEDIO_TURNO')}
        />
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="text-lg font-extrabold text-slate-900">
            {vista === 'SIN_TURNOS'
              ? 'Empleados SIN turnos'
              : vista === 'FALTANTES'
                ? 'Empleados con turnos incompletos (faltan días)'
                : 'Empleados con medio turno (pocas horas)'}
          </div>
          <div className="text-xs text-slate-500">Tip: esta tabla es “modo pantallazo” (resumen compacto).</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-white text-xs uppercase">
              <tr>
                <th className="p-3 text-left">Nombre</th>
                <th className="p-3 text-left">Fecha</th>
                <th className="p-3 text-left">Sucursal</th>
                <th className="p-3 text-left">Hora inicial</th>
                <th className="p-3 text-left">Hora final</th>
                <th className="p-3 text-left">Horas</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {miniTabla.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500">
                    No hay registros para mostrar.
                  </td>
                </tr>
              )}

              {miniTabla.map((r, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900 uppercase">{r.empleado}</td>
                  <td className="p-3">{r.fecha}</td>
                  <td className="p-3">{r.sucursal}</td>
                  <td className="p-3 font-mono">{r.horaIni}</td>
                  <td className="p-3 font-mono">{r.horaFin}</td>
                  <td className="p-3 font-extrabold">{r.horas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-slate-50 border-t flex items-center justify-between text-xs text-slate-600">
          <div>
            Semana: <span className="font-bold">{rango.inicio}</span> a <span className="font-bold">{rango.fin}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">PPY + Externos</span>
            <span className="inline-flex items-center gap-1 text-green-700">
              <CheckCircle2 size={16} /> consolidado
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}