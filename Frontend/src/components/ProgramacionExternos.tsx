import React, { useMemo, useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Plus,
  Edit,
  Trash2,
  X,
  Calendar,
  Search,
  Check,
  ArrowUp,
  ArrowDown,
  UserMinus,
  AlertTriangle,
  Upload,
  Filter,
  Layers,
  Copy,
} from 'lucide-react';

interface EmpleadoBD {
  id: number;
  nombre_completo: string;
  documento: string;
  id_interwap: string;
  cargo: string;
  estado: string;
}

interface SucursalBD {
  id: number;
  empresa: string;
  sucursal: string;
  id_interwap: string;
  id_cliente_interno: string;
}

interface TurnoExterno {
  id: number;
  empleadoId: number | null;
  sucursalId: number;

  nombre?: string;
  cc?: string;
  cargo?: string;
  idInterMen?: string;

  empresa?: string;
  sucursal?: string;
  idSucursalInterwap?: string;

  idTurno: string;
  fecha: string;
  semana: number;
  dia: string;
  mes: string;
  anio: number;

  horaIni: string;
  horaFin: string;
  horasTotales: number;

  asignacion: string;
  tipoTurno: string;
  franjaHoraria: string;

  estadoTurno: string;
  estadoEjecucion: string;
}

type ErrorDetalleCruce = {
  titulo: string;
  mensaje: string;
  campos: { label: string; value: string }[];
};

type ExcelRow = Record<string, unknown>;

type TurnoImportRow = {
  empleadoId?: number;
  documento?: string;
  sucursalId: number;
  fecha: string;
  horaIni: string;
  horaFin: string;
};

type DiaKey = 'sabado' | 'domingo' | 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes';

const DIAS: { key: DiaKey; label: string }[] = [
  { key: 'sabado', label: 'Sáb' },
  { key: 'domingo', label: 'Dom' },
  { key: 'lunes', label: 'Lun' },
  { key: 'martes', label: 'Mar' },
  { key: 'miercoles', label: 'Mié' },
  { key: 'jueves', label: 'Jue' },
  { key: 'viernes', label: 'Vie' },
];

const API = 'http://localhost:3001';

function esDescansoLocal(hIni: string, hFin: string, horasTotales?: number) {
  const ini = String(hIni ?? '').trim();
  const fin = String(hFin ?? '').trim();

  if (typeof horasTotales === 'number' && horasTotales === 0) return true;
  if (ini.startsWith('00:00') && (!fin || fin.startsWith('00:00'))) return true;

  // si el usuario deja horas en 0 sin poner 00:00, igual lo tratamos como descanso
  // (esto es una ayuda UI, el backend es el que manda)
  return false;
}

const ProgramacionExternos = () => {
  const [listaEmpleados, setListaEmpleados] = useState<EmpleadoBD[]>([]);
  const [listaSucursales, setListaSucursales] = useState<SucursalBD[]>([]);
  const [turnos, setTurnos] = useState<TurnoExterno[]>([]);
  const [fijosDeLaSede, setFijosDeLaSede] = useState<EmpleadoBD[]>([]);

  const [busqueda, setBusqueda] = useState('');
  const [ordenFecha, setOrdenFecha] = useState<'asc' | 'desc'>('desc');

  // filtros avanzados
  const [fEmpresa, setFEmpresa] = useState<string>('');
  const [fSucursalId, setFSucursalId] = useState<string>('');
  const [fVacantes, setFVacantes] = useState(false);
  const [fDesde, setFDesde] = useState<string>('');
  const [fHasta, setFHasta] = useState<string>('');
  const [buscarSucursalFiltro, setBuscarSucursalFiltro] = useState('');

  const [modalAbierto, setModalAbierto] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // modal masivo
  const [modalMasivo, setModalMasivo] = useState(false);
  const [masivoSucursalTerm, setMasivoSucursalTerm] = useState('');
  const [masivoSucursalId, setMasivoSucursalId] = useState<number | null>(null);
  const [masivoFechaInicio, setMasivoFechaInicio] = useState('');
  const [masivoFechaFin, setMasivoFechaFin] = useState('');
  const [masivoDias, setMasivoDias] = useState<Record<DiaKey, boolean>>({
    sabado: true,
    domingo: true,
    lunes: true,
    martes: true,
    miercoles: true,
    jueves: true,
    viernes: true,
  });
  const [masivoHoraIni, setMasivoHoraIni] = useState('10:00');
  const [masivoHoraFin, setMasivoHoraFin] = useState('20:00');
  const [masivoEmpleadoTerm, setMasivoEmpleadoTerm] = useState('');
  const [masivoEmpleadoId, setMasivoEmpleadoId] = useState<number | null>(null);
  const [creandoMasivo, setCreandoMasivo] = useState(false);

  // modal clonar
  const [modalClonar, setModalClonar] = useState(false);
  const [clonarSucursalTerm, setClonarSucursalTerm] = useState('');
  const [clonarSucursalId, setClonarSucursalId] = useState<number | null>(null); // opcional
  const [clonarOrigenIni, setClonarOrigenIni] = useState('');
  const [clonarOrigenFin, setClonarOrigenFin] = useState('');
  const [clonarDestinoIni, setClonarDestinoIni] = useState('');
  const [clonarIncluirVacantes, setClonarIncluirVacantes] = useState(true);
  const [clonarIncluirAsignados, setClonarIncluirAsignados] = useState(true);
  const [clonando, setClonando] = useState(false);

  const [buscarEmpleado, setBuscarEmpleado] = useState('');
  const [errorModal, setErrorModal] = useState<ErrorDetalleCruce | null>(null);

  const [importando, setImportando] = useState(false);

  const turnoVacio: TurnoExterno = {
    id: 0,
    empleadoId: 0,
    sucursalId: 0,
    nombre: '',
    cc: '',
    idInterMen: '',
    cargo: '',
    empresa: '',
    sucursal: '',
    idSucursalInterwap: '',
    idTurno: 'No Cargar',
    fecha: '',
    semana: 0,
    dia: '',
    mes: '',
    anio: 2026,
    horaIni: '',
    horaFin: '',
    horasTotales: 0,
    asignacion: '',
    tipoTurno: '',
    franjaHoraria: '',
    estadoTurno: 'OK',
    estadoEjecucion: 'Pendiente',
  };

  const [formulario, setFormulario] = useState<TurnoExterno>(turnoVacio);

  // --- CARGA ---
  const cargarDatosMaestros = useCallback(async () => {
    try {
      const resEmp = await fetch(`${API}/empleados`);
      const dataEmp = await resEmp.json();
      setListaEmpleados(dataEmp);

      const resSuc = await fetch(`${API}/clientes-filtro?tipo=EXTERNOS`);
      const dataSuc = await resSuc.json();
      setListaSucursales(dataSuc);
    } catch (error) {
      console.error('Error cargando listas', error);
      setErrorModal({
        titulo: 'Error cargando datos',
        mensaje: 'No se pudieron cargar empleados / sucursales.',
        campos: [],
      });
    }
  }, []);

  const cargarTurnos = useCallback(async () => {
    try {
      const res = await fetch(`${API}/turnos-externos`);
      const data = await res.json();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const turnosFormateados = data.map((t: any) => ({
        id: t.id,
        empleadoId: t.empleado_id,
        sucursalId: t.sucursal_id,
        nombre: t.nombre_completo || t.nombre_empleado,
        cc: t.documento,
        idInterMen: t.emp_id_interwap,
        cargo: t.cargo,
        empresa: t.empresa,
        sucursal: t.sucursal,
        idSucursalInterwap: t.suc_id_interwap,
        fecha: t.fecha ? t.fecha.toString().split('T')[0] : '',
        semana: t.semana,
        dia: t.dia_semana,
        mes: t.mes,
        anio: t.anio,
        horaIni: t.hora_inicio,
        horaFin: t.hora_fin,
        horasTotales: t.horas_totales,
        idTurno: t.id_turno,
        asignacion: t.asignacion,
        estadoTurno: t.estado_turno,
        tipoTurno: t.tipo_turno ?? '',
        franjaHoraria: t.franja_horaria ?? '',
        estadoEjecucion: t.estado_ejecucion ?? 'Pendiente',
      }));

      setTurnos(turnosFormateados);
    } catch (error) {
      console.error('Error cargando turnos', error);
      setErrorModal({
        titulo: 'Error cargando turnos',
        mensaje: 'No se pudo cargar la tabla de turnos.',
        campos: [],
      });
    }
  }, []);

  useEffect(() => {
    let cancelado = false;

    const init = async () => {
      try {
        await cargarDatosMaestros();
        await cargarTurnos();
      } catch (e) {
        console.error(e);
      }
    };

    if (!cancelado) init();

    return () => {
      cancelado = true;
    };
  }, [cargarDatosMaestros, cargarTurnos]);

  const fechaEnRango = (fecha: string, desde: string, hasta: string) => {
    if (!fecha) return false;
    const t = new Date(fecha + 'T00:00:00').getTime();
    if (desde) {
      const td = new Date(desde + 'T00:00:00').getTime();
      if (t < td) return false;
    }
    if (hasta) {
      const th = new Date(hasta + 'T00:00:00').getTime();
      if (t > th) return false;
    }
    return true;
  };

  // --- HELPERS FORM ---
  const actualizarHoras = (hIni: string, hFin: string) => {
    const nuevoForm = { ...formulario, horaIni: hIni, horaFin: hFin };
    if (hIni && hFin) {
      const [horaI, minI] = hIni.split(':').map(Number);
      const [horaF, minF] = hFin.split(':').map(Number);
      let total = horaF + minF / 60 - (horaI + minI / 60);
      if (total < 0) total += 24;
      nuevoForm.horasTotales = Math.round(total * 10) / 10;
    }
    setFormulario(nuevoForm);
  };

  const calcularFecha = (fechaStr: string) => {
    if (!fechaStr) return;
    const date = new Date(fechaStr + 'T00:00:00');
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const meses = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ];
    const oneJan = new Date(date.getFullYear(), 0, 1);
    const numberOfDays = Math.floor((date.getTime() - oneJan.getTime()) / 86400000);
    const semana = Math.ceil((date.getDay() + 1 + numberOfDays) / 7);

    setFormulario((prev) => ({
      ...prev,
      fecha: fechaStr,
      dia: dias[date.getDay()],
      mes: meses[date.getMonth()],
      anio: date.getFullYear(),
      semana,
    }));
  };

  const limpiarFiltros = () => {
    setFEmpresa('');
    setFSucursalId('');
    setFVacantes(false);
    setFDesde('');
    setFHasta('');
    setBuscarSucursalFiltro('');
  };

  // --- SELECCIONES ---
  const handleEmpleadoSelect = (
    e: React.ChangeEvent<HTMLSelectElement> | React.MouseEvent<HTMLButtonElement>,
    idDirecto?: number
  ) => {
    const idSelec = idDirecto ? idDirecto : Number((e.target as HTMLSelectElement).value);
    const emp = listaEmpleados.find((em) => em.id === idSelec);
    if (emp) {
      setFormulario((prev) => ({
        ...prev,
        empleadoId: emp.id,
        nombre: emp.nombre_completo,
        cc: emp.documento,
        idInterMen: emp.id_interwap,
        cargo: emp.cargo,
        asignacion: emp.cargo,
      }));
    } else {
      setFormulario((prev) => ({
        ...prev,
        empleadoId: null,
        nombre: '',
        cc: '',
        idInterMen: '',
        cargo: '',
        asignacion: '',
      }));
    }
  };

  const handleSucursalSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idSelec = Number(e.target.value);
    const suc = listaSucursales.find((s) => s.id === idSelec);
    if (suc) {
      setFormulario((prev) => ({
        ...prev,
        sucursalId: suc.id,
        sucursal: suc.sucursal,
        empresa: suc.empresa,
        idSucursalInterwap: suc.id_interwap,
      }));

      try {
        const res = await fetch(`${API}/fijos/${suc.id}`);
        const dataFijos = await res.json();
        setFijosDeLaSede(dataFijos);
      } catch (error) {
        console.error(error);
      }
    }
  };

  // --- CRUD ACCIONES ---
  const abrirEditar = (turno: TurnoExterno) => {
    setFormulario(turno);
    setIsEditing(true);

    if (turno.sucursalId) {
      fetch(`${API}/fijos/${turno.sucursalId}`)
        .then((res) => res.json())
        .then((data) => setFijosDeLaSede(data))
        .catch((err) => console.error(err));
    }

    setModalAbierto(true);
  };

  const eliminarTurno = async (id: number) => {
    if (!window.confirm('¿Seguro de eliminar este turno POR COMPLETO?')) return;
    try {
      const res = await fetch(`${API}/turnos-externos/${id}`, { method: 'DELETE' });
      if (res.ok) cargarTurnos();
      else {
        setErrorModal({
          titulo: 'No se pudo eliminar',
          mensaje: `Error HTTP ${res.status}`,
          campos: [],
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const liberarTurno = async (id: number) => {
    if (!window.confirm('¿Quitar al empleado de este turno? (Quedará Vacante)')) return;
    try {
      const res = await fetch(`${API}/turnos-externos/${id}/liberar`, { method: 'PATCH' });
      if (res.ok) cargarTurnos();
      else {
        setErrorModal({
          titulo: 'No se pudo liberar',
          mensaje: 'El servidor respondió con error al intentar dejar el turno vacante.',
          campos: [],
        });
      }
    } catch (error) {
      console.error(error);
      setErrorModal({
        titulo: 'Error de conexión',
        mensaje: 'No se pudo contactar el servidor para liberar el turno.',
        campos: [],
      });
    }
  };

  // ✅ Guardar con validaciones (usa códigos del backend)
  const guardarTurnoBD = async () => {
    // Validación mínima UI (backend manda)
    if (formulario.sucursalId === 0 || !formulario.fecha) {
      setErrorModal({
        titulo: 'Faltan datos',
        mensaje: 'Sucursal y Fecha son obligatorios.',
        campos: [],
      });
      return;
    }

    // Si es "descanso", por UI exigimos 00:00 / 0h para no confundir
    const esDescansoUI = esDescansoLocal(formulario.horaIni, formulario.horaFin, formulario.horasTotales);
    if (esDescansoUI) {
      // opcional: podrías forzar a 00:00-00:00 aquí si quieres
    }

    try {
      const url = isEditing ? `${API}/turnos-externos/${formulario.id}` : `${API}/turnos-externos`;
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formulario),
      });

      if (response.ok) {
        setModalAbierto(false);
        await cargarTurnos();
        return;
      }

      const errData = await response.json().catch(() => null);

      // ✅ 1) Cruce PPY (turno con rango)
      if (response.status === 409 && errData?.code === 'CRUCE_PPY' && errData?.detalle) {
        const d = errData.detalle;
        setErrorModal({
          titulo: 'Cruce de turnos detectado (PPY)',
          mensaje: errData.message || 'El empleado ya tiene un turno asignado en otra sede (PPY).',
          campos: [
            { label: 'Sucursal (PPY)', value: String(d.sucursal ?? '-') },
            { label: 'Día', value: String(d.dia ?? '-') },
            { label: 'Turno PPY (texto)', value: String(d.turnoTexto ?? '-') },
            { label: 'Rango PPY', value: String(d.rango ?? '-') },
            { label: 'Nuevo turno', value: String(d.nuevoTurno ?? '-') },
            { label: 'Fecha', value: String(d.fecha ?? '-') },
          ],
        });
        return;
      }

      // ✅ 2) Turno vs Descanso el mismo día
      if (response.status === 409 && errData?.code === 'TURNO_DESCANSO_MISMO_DIA') {
        setErrorModal({
          titulo: 'Validación: Turno vs Descanso',
          mensaje: errData.message || 'No se puede tener TURNO y DESCANSO el mismo día para el mismo empleado.',
          campos: [
            { label: 'Empleado', value: String(formulario.nombre ?? 'Vacante') },
            { label: 'CC', value: String(formulario.cc ?? '-') },
            { label: 'Fecha', value: String(formulario.fecha ?? '-') },
            { label: 'Sucursal', value: String(formulario.sucursal ?? '-') },
            {
              label: 'Horario',
              value: `${String(formulario.horaIni ?? '')} - ${String(formulario.horaFin ?? '')}`.trim(),
            },
          ],
        });
        return;
      }

      // ✅ 3) Validación import/masivo u otras validaciones
      if (response.status === 409 && errData?.code === 'IMPORT_VALIDATION') {
        setErrorModal({
          titulo: 'Validación de importación',
          mensaje: errData.message || 'Hay inconsistencias en el archivo (turno y descanso el mismo día).',
          campos: [],
        });
        return;
      }

      // ✅ 4) Error genérico
      setErrorModal({
        titulo: 'No se pudo guardar',
        mensaje: errData?.message || errData?.mensaje || errData?.error || `Error HTTP ${response.status}`,
        campos: [],
      });
    } catch (error) {
      console.error(error);
      setErrorModal({
        titulo: 'Error de conexión',
        mensaje: `No se pudo contactar el servidor. Revisa que el backend esté corriendo en ${API}`,
        campos: [],
      });
    }
  };

  // --- IMPORTAR EXCEL (MASIVO) ---
  const normalizarHora = (h: unknown) => {
    const s = String(h ?? '').trim();
    if (!s) return '';
    const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
    return s;
  };

  const normalizarFechaExcel = (v: unknown) => {
    if (!v) return '';
    if (typeof v === 'string') {
      const s = v.trim();
      const iso = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
      if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
      return s;
    }

    if (typeof v === 'number') {
      const d = XLSX.SSF.parse_date_code(v);
      if (!d) return '';
      const mm = String(d.m).padStart(2, '0');
      const dd = String(d.d).padStart(2, '0');
      return `${d.y}-${mm}-${dd}`;
    }

    return String(v).split('T')[0];
  };

  const importarExcelMasivo = async (file: File) => {
    setImportando(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, { defval: '' });

      const normalizarKey = (k: string) =>
        k
          .toUpperCase()
          .trim()
          .replace(/\./g, '')
          .replace(/\s+/g, '')
          .replace(/_/g, '');

      const normalizarRow = (r: ExcelRow) => {
        const out: Record<string, unknown> = {};
        Object.keys(r).forEach((k) => {
          out[normalizarKey(k)] = r[k];
        });
        return out;
      };

      const turnosImport: TurnoImportRow[] = rows
        .map((raw) => {
          const r = normalizarRow(raw);

          const documento = String(r.CC ?? r.DOCUMENTO ?? '').trim();
          const empleadoIdStr = String(r.EMPLEADOID ?? '').trim();
          const empleadoId = empleadoIdStr ? Number(empleadoIdStr) : undefined;

          const sucursalIdStr = String(r.IDSUCURSAL ?? r.SUCURSALID ?? '').trim();
          const sucursalId = Number(sucursalIdStr);

          const fecha = normalizarFechaExcel(r.FECHA);
          const horaIni = normalizarHora(r.HINI ?? r.HORAINI);
          const horaFin = normalizarHora(r.HFIN ?? r.HORAFIN);

          return {
            ...(empleadoId ? { empleadoId } : {}),
            ...(documento ? { documento } : {}),
            sucursalId,
            fecha,
            horaIni,
            horaFin,
          };
        })
        .filter(
          (t) =>
            Boolean(t.sucursalId) &&
            Boolean(t.fecha) &&
            Boolean(t.horaIni) &&
            Boolean(t.horaFin) &&
            (Boolean(t.empleadoId) || Boolean(t.documento))
        );

      if (turnosImport.length === 0) {
        setErrorModal({
          titulo: 'Excel inválido',
          mensaje:
            'No se encontraron filas válidas. Requiere ID_SUCURSAL, FECHA, H. INI, H. FIN y (CC/DOCUMENTO o EMPLEADO_ID).',
          campos: [],
        });
        return;
      }

      const res = await fetch(`${API}/turnos-externos/importar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turnos: turnosImport }),
      });

      const data = (await res.json().catch(() => null)) as
        | { message?: string; resumen?: { insertados?: number; ppyMarcados?: number } }
        | { code?: string; errores?: unknown[]; message?: string }
        | null;

      if (!res.ok) {
        // si backend devuelve errores detallados
        if (res.status === 409 && (data as any)?.code === 'IMPORT_VALIDATION') {
          setErrorModal({
            titulo: 'Validación de importación',
            mensaje: (data as any)?.message || 'El archivo trae inconsistencias (turno y descanso el mismo día).',
            campos: [],
          });
          return;
        }

        setErrorModal({
          titulo: 'Error importando',
          mensaje: (data as any)?.message || `Error HTTP ${res.status}`,
          campos: [],
        });
        return;
      }

      alert(
        `Importación completa:\nInsertados: ${(data as any)?.resumen?.insertados ?? '-'}\nPPY marcados: ${
          (data as any)?.resumen?.ppyMarcados ?? '-'
        }`
      );

      await cargarTurnos();
    } catch (e) {
      console.error(e);
      setErrorModal({
        titulo: 'Error leyendo Excel',
        mensaje: 'No se pudo leer el archivo. Verifica que sea .xlsx/.xls y que tenga encabezados.',
        campos: [],
      });
    } finally {
      setImportando(false);
    }
  };

  // --- DATA PARA SELECTORES ---
  const empresasDisponibles = useMemo(() => {
    const set = new Set<string>();
    listaSucursales.forEach((s) => {
      if (s.empresa) set.add(s.empresa);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [listaSucursales]);

  const sucursalesFiltradasParaFiltro = useMemo(() => {
    const term = buscarSucursalFiltro.trim().toLowerCase();
    return listaSucursales
      .filter((s) => (fEmpresa ? s.empresa === fEmpresa : true))
      .filter((s) => (term ? `${s.empresa} ${s.sucursal}`.toLowerCase().includes(term) : true))
      .sort((a, b) => `${a.empresa} ${a.sucursal}`.localeCompare(`${b.empresa} ${b.sucursal}`));
  }, [listaSucursales, fEmpresa, buscarSucursalFiltro]);

  const empleadosFiltradosParaModal = useMemo(() => {
    const term = buscarEmpleado.trim().toLowerCase();
    if (!term) return listaEmpleados;
    return listaEmpleados.filter((e) => `${e.nombre_completo} ${e.documento}`.toLowerCase().includes(term));
  }, [listaEmpleados, buscarEmpleado]);

  const sucursalesFiltradasMasivo = useMemo(() => {
    const term = masivoSucursalTerm.trim().toLowerCase();
    if (!term) return listaSucursales.slice(0, 40);
    return listaSucursales.filter((s) => `${s.empresa} ${s.sucursal}`.toLowerCase().includes(term)).slice(0, 50);
  }, [listaSucursales, masivoSucursalTerm]);

  const empleadosFiltradosMasivo = useMemo(() => {
    const term = masivoEmpleadoTerm.trim().toLowerCase();
    if (!term) return listaEmpleados.slice(0, 40);
    return listaEmpleados
      .filter((e) => `${e.nombre_completo} ${e.documento}`.toLowerCase().includes(term))
      .slice(0, 50);
  }, [listaEmpleados, masivoEmpleadoTerm]);

  const sucursalesFiltradasClonar = useMemo(() => {
    const term = clonarSucursalTerm.trim().toLowerCase();
    if (!term) return listaSucursales.slice(0, 40);
    return listaSucursales.filter((s) => `${s.empresa} ${s.sucursal}`.toLowerCase().includes(term)).slice(0, 50);
  }, [listaSucursales, clonarSucursalTerm]);

  // --- VISUALIZACIÓN (con filtros avanzados) ---
  const procesarTurnos = () => {
    let resultado = [...turnos];

    if (busqueda) {
      const termino = busqueda.toLowerCase();
      resultado = resultado.filter(
        (t) =>
          (t.nombre && t.nombre.toLowerCase().includes(termino)) ||
          (t.empresa && t.empresa.toLowerCase().includes(termino)) ||
          (t.sucursal && t.sucursal.toLowerCase().includes(termino)) ||
          (t.cc && t.cc.includes(termino))
      );
    }

    if (fEmpresa) resultado = resultado.filter((t) => (t.empresa || '') === fEmpresa);
    if (fSucursalId) resultado = resultado.filter((t) => String(t.sucursalId) === String(fSucursalId));
    if (fVacantes) resultado = resultado.filter((t) => !t.nombre);
    if (fDesde || fHasta) resultado = resultado.filter((t) => fechaEnRango(t.fecha, fDesde, fHasta));

    resultado.sort((a, b) => {
      const fechaA = new Date(a.fecha).getTime();
      const fechaB = new Date(b.fecha).getTime();
      return ordenFecha === 'asc' ? fechaA - fechaB : fechaB - fechaA;
    });

    return resultado;
  };

  const turnosVisuales = procesarTurnos();
  const toggleOrdenFecha = () => setOrdenFecha((prev) => (prev === 'asc' ? 'desc' : 'asc'));

  // --- CREAR MASIVO ---
  const toggleMasivoDia = (k: DiaKey) => setMasivoDias((prev) => ({ ...prev, [k]: !prev[k] }));

  const resetMasivo = () => {
    setMasivoSucursalTerm('');
    setMasivoSucursalId(null);
    setMasivoFechaInicio('');
    setMasivoFechaFin('');
    setMasivoDias({
      sabado: true,
      domingo: true,
      lunes: true,
      martes: true,
      miercoles: true,
      jueves: true,
      viernes: true,
    });
    setMasivoHoraIni('10:00');
    setMasivoHoraFin('20:00');
    setMasivoEmpleadoTerm('');
    setMasivoEmpleadoId(null);
  };

  const crearMasivo = async () => {
    const diasSeleccionados = Object.entries(masivoDias)
      .filter(([, v]) => v)
      .map(([k]) => k) as DiaKey[];

    if (
      !masivoSucursalId ||
      !masivoFechaInicio ||
      !masivoFechaFin ||
      diasSeleccionados.length === 0 ||
      !masivoHoraIni ||
      !masivoHoraFin
    ) {
      setErrorModal({
        titulo: 'Faltan datos',
        mensaje: 'Sucursal, fecha inicio/fin, días y horas son obligatorios.',
        campos: [],
      });
      return;
    }

    setCreandoMasivo(true);
    try {
      const res = await fetch(`${API}/turnos-externos/masivo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sucursalId: masivoSucursalId,
          fechaInicio: masivoFechaInicio,
          fechaFin: masivoFechaFin,
          dias: diasSeleccionados,
          horaIni: masivoHoraIni,
          horaFin: masivoHoraFin,
          empleadoId: masivoEmpleadoId,
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | { message?: string; resumen?: { insertados?: number; ppyMarcados?: number } }
        | { code?: string; message?: string; errores?: unknown[] }
        | null;

      if (!res.ok) {
        setErrorModal({
          titulo: 'Error creando masivo',
          mensaje: (data as any)?.message || `Error HTTP ${res.status}`,
          campos: [],
        });
        return;
      }

      alert(
        `Creación masiva lista.\nInsertados: ${(data as any)?.resumen?.insertados ?? '-'}\nPPY marcados: ${
          (data as any)?.resumen?.ppyMarcados ?? '-'
        }`
      );

      setModalMasivo(false);
      resetMasivo();
      await cargarTurnos();
    } catch (e) {
      console.error(e);
      setErrorModal({
        titulo: 'Error de conexión',
        mensaje: 'No se pudo contactar el servidor.',
        campos: [],
      });
    } finally {
      setCreandoMasivo(false);
    }
  };

  // --- CLONAR (sin duplicar en destino) ---
  const resetClonar = () => {
    setClonarSucursalTerm('');
    setClonarSucursalId(null);
    setClonarOrigenIni('');
    setClonarOrigenFin('');
    setClonarDestinoIni('');
    setClonarIncluirVacantes(true);
    setClonarIncluirAsignados(true);
  };

  const clonarTurnos = async () => {
    if (!clonarOrigenIni || !clonarOrigenFin || !clonarDestinoIni) {
      setErrorModal({
        titulo: 'Faltan datos',
        mensaje: 'Origen inicio/fin y destino inicio son obligatorios.',
        campos: [],
      });
      return;
    }
    if (!clonarIncluirVacantes && !clonarIncluirAsignados) {
      setErrorModal({
        titulo: 'Selección inválida',
        mensaje: 'Debes incluir vacantes o incluir asignados (al menos uno).',
        campos: [],
      });
      return;
    }

    setClonando(true);
    try {
      const res = await fetch(`${API}/turnos-externos/clonar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(clonarSucursalId ? { sucursalId: clonarSucursalId } : {}),
          fechaOrigenInicio: clonarOrigenIni,
          fechaOrigenFin: clonarOrigenFin,
          fechaDestinoInicio: clonarDestinoIni,
          incluirVacantes: clonarIncluirVacantes,
          incluirAsignados: clonarIncluirAsignados,
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | {
            message?: string;
            resumen?: {
              origen?: number;
              candidatos?: number;
              omitidosPorDuplicado?: number;
              insertados?: number;
              shiftDays?: number;
              ppyMarcados?: number;
            };
          }
        | { code?: string; message?: string }
        | null;

      if (!res.ok) {
        setErrorModal({
          titulo: 'Error clonando',
          mensaje: (data as any)?.message || `Error HTTP ${res.status}`,
          campos: [],
        });
        return;
      }

      alert(
        `Clonación lista.\n` +
          `Origen: ${(data as any)?.resumen?.origen ?? '-'}\n` +
          `Candidatos: ${(data as any)?.resumen?.candidatos ?? '-'}\n` +
          `Omitidos (ya existían): ${(data as any)?.resumen?.omitidosPorDuplicado ?? '-'}\n` +
          `Insertados: ${(data as any)?.resumen?.insertados ?? '-'}\n` +
          `Shift(días): ${(data as any)?.resumen?.shiftDays ?? '-'}\n` +
          `PPY marcados: ${(data as any)?.resumen?.ppyMarcados ?? '-'}`
      );

      setModalClonar(false);
      resetClonar();
      await cargarTurnos();
    } catch (e) {
      console.error(e);
      setErrorModal({
        titulo: 'Error de conexión',
        mensaje: 'No se pudo contactar el servidor.',
        campos: [],
      });
    } finally {
      setClonando(false);
    }
  };

  return (
    <div className="space-y-6 p-1">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Programación Externos</h2>
          <p className="text-sm text-gray-500">Gestión de turnos conectada a BD</p>
        </div>

        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={() => {
              resetClonar();
              if (fSucursalId) {
                const id = Number(fSucursalId);
                const suc = listaSucursales.find((s) => s.id === id);
                if (suc) {
                  setClonarSucursalId(id);
                  setClonarSucursalTerm(`${suc.empresa} - ${suc.sucursal} (ID ${suc.id})`);
                }
              }
              setModalClonar(true);
            }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors font-medium whitespace-nowrap"
            title="Clonar turnos a otra fecha (evita duplicados)"
          >
            <Copy size={18} /> Clonar
          </button>

          <button
            onClick={() => {
              resetMasivo();
              setModalMasivo(true);
            }}
            className="bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-800 transition-colors font-medium whitespace-nowrap"
            title="Crear varios turnos al tiempo"
          >
            <Layers size={18} /> Crear Masivo
          </button>

          <label
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium cursor-pointer whitespace-nowrap ${
              importando ? 'bg-emerald-400 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
            title="Importar Excel"
          >
            <Upload size={18} /> {importando ? 'Importando...' : 'Importar Excel'}
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={importando}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importarExcelMasivo(file);
                e.currentTarget.value = '';
              }}
            />
          </label>

          <button
            onClick={() => {
              setFormulario(turnoVacio);
              setBuscarEmpleado('');
              setIsEditing(false);
              setModalAbierto(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
          >
            <Plus size={18} /> Crear Turno
          </button>
        </div>
      </div>

      {/* FILTROS AVANZADOS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3 text-gray-800 font-bold">
          <Filter size={18} className="text-slate-700" />
          Filtros
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold mb-1 text-gray-600">Empresa</label>
            <select
              value={fEmpresa}
              onChange={(e) => {
                setFEmpresa(e.target.value);
                setFSucursalId('');
              }}
              className="w-full border rounded-lg p-2 bg-white"
            >
              <option value="">-- Todas --</option>
              {empresasDisponibles.map((emp) => (
                <option key={emp} value={emp}>
                  {emp}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold mb-1 text-gray-600">Buscar sucursal</label>
            <input
              value={buscarSucursalFiltro}
              onChange={(e) => setBuscarSucursalFiltro(e.target.value)}
              placeholder="Ej: BELLA SUIZA..."
              className="w-full border rounded-lg p-2"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold mb-1 text-gray-600">Sucursal</label>
            <select
              value={fSucursalId}
              onChange={(e) => setFSucursalId(e.target.value)}
              className="w-full border rounded-lg p-2 bg-white"
            >
              <option value="">-- Todas --</option>
              {sucursalesFiltradasParaFiltro.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.empresa} - {s.sucursal} (ID {s.id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-gray-600">Desde</label>
            <input
              value={fDesde}
              onChange={(e) => setFDesde(e.target.value)}
              type="date"
              className="w-full border rounded-lg p-2"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-gray-600">Hasta</label>
            <input
              value={fHasta}
              onChange={(e) => setFHasta(e.target.value)}
              type="date"
              className="w-full border rounded-lg p-2"
            />
          </div>

          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <input
                type="checkbox"
                checked={fVacantes}
                onChange={(e) => setFVacantes(e.target.checked)}
              />
              Solo vacantes
            </label>
          </div>

          <div className="md:col-span-6 flex justify-between items-center pt-2">
            <div className="text-xs text-gray-500">
              Mostrando <span className="font-bold">{turnosVisuales.length}</span> turno(s)
            </div>
            <button onClick={limpiarFiltros} className="text-sm font-bold text-slate-700 hover:text-slate-900 underline">
              Limpiar filtros
            </button>
          </div>
        </div>
      </div>

      {/* TABLA */}
      <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-800 text-white uppercase text-xs">
              <tr>
                <th className="p-3">Empleado</th>
                <th className="p-3">Ubicación</th>
                <th className="p-3 text-center cursor-pointer hover:bg-gray-700" onClick={toggleOrdenFecha}>
                  <div className="flex items-center justify-center gap-1">
                    FECHA {ordenFecha === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                  </div>
                </th>
                <th className="p-3 text-center">Horas</th>
                <th className="p-3 text-center">Estado</th>
                <th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {turnosVisuales.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">
                    No se encontraron registros.
                  </td>
                </tr>
              )}
              {turnosVisuales.map((t) => (
                <tr key={t.id} className="hover:bg-blue-50 transition-colors">
                  <td className="p-3 border-r">
                    {t.nombre ? (
                      <>
                        <div className="font-bold text-gray-800 uppercase">{t.nombre}</div>
                        <div className="text-xs text-gray-500">
                          CC: {t.cc} | ID: {t.idInterMen}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-orange-600 bg-orange-50 p-2 rounded border border-orange-200">
                        <AlertTriangle size={16} />
                        <span className="font-bold text-xs uppercase">VACANTE (Sin Asignar)</span>
                      </div>
                    )}
                  </td>
                  <td className="p-3 border-r">
                    <div className="font-bold text-blue-700">{t.empresa}</div>
                    <div className="text-xs font-semibold text-gray-600">{t.sucursal}</div>
                    <div className="text-[11px] text-gray-400">ID Sucursal: {t.sucursalId}</div>
                  </td>
                  <td className="p-3 text-center border-r">
                    <div className="font-medium text-gray-800">{t.fecha}</div>
                    <div className="text-xs text-gray-500 capitalize">{t.dia}</div>
                  </td>
                  <td className="p-3 text-center border-r font-mono text-gray-600">
                    {t.horaIni} - {t.horaFin} <br />
                    <span className="font-bold text-blue-600">({t.horasTotales}h)</span>
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold border ${
                        t.nombre
                          ? 'bg-green-100 text-green-700 border-green-200'
                          : 'bg-orange-100 text-orange-600 border-orange-200'
                      }`}
                    >
                      {t.nombre ? t.estadoTurno : 'PENDIENTE'}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex justify-center gap-2">
                      {t.nombre && (
                        <button
                          onClick={() => liberarTurno(t.id)}
                          className="text-orange-500 hover:bg-orange-100 p-1.5 rounded transition-colors"
                          title="Quitar empleado (Dejar Vacante)"
                        >
                          <UserMinus size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => abrirEditar(t)}
                        className="text-blue-600 hover:bg-blue-100 p-1.5 rounded transition-colors"
                        title="Editar"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => eliminarTurno(t.id)}
                        className="text-red-500 hover:bg-red-100 p-1.5 rounded transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CLONAR */}
      {modalClonar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-gray-200">
            <div className="bg-gradient-to-r from-indigo-700 to-indigo-600 p-4 flex justify-between items-center text-white">
              <h3 className="font-extrabold text-lg flex gap-2 items-center">
                <Copy /> Clonar turnos (sin duplicar)
              </h3>
              <button onClick={() => setModalClonar(false)} className="hover:text-gray-200">
                <X />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold mb-1 text-gray-700">
                  Sucursal (opcional) — si la dejas vacía clona TODAS las sucursales del rango origen
                </label>
                <input
                  value={clonarSucursalTerm}
                  onChange={(e) => {
                    setClonarSucursalTerm(e.target.value);
                    setClonarSucursalId(null);
                  }}
                  placeholder="Escribe para buscar sucursal..."
                  className="w-full border rounded-xl p-3"
                />
                <div className="mt-2 max-h-44 overflow-auto border rounded-xl bg-white">
                  <button
                    onClick={() => {
                      setClonarSucursalId(null);
                      setClonarSucursalTerm('');
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-slate-50 transition ${
                      clonarSucursalId === null ? 'bg-slate-50' : ''
                    }`}
                  >
                    <div className="font-bold text-sm text-slate-800">Todas las sucursales</div>
                    <div className="text-xs text-gray-600">
                      Clona lo que exista en el rango origen (todas las sedes).
                    </div>
                  </button>

                  {sucursalesFiltradasClonar.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setClonarSucursalId(s.id);
                        setClonarSucursalTerm(`${s.empresa} - ${s.sucursal} (ID ${s.id})`);
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-indigo-50 transition ${
                        clonarSucursalId === s.id ? 'bg-indigo-100' : ''
                      }`}
                    >
                      <div className="font-bold text-sm text-gray-800">{s.empresa}</div>
                      <div className="text-xs text-gray-600">
                        {s.sucursal} <span className="text-gray-400">— ID {s.id}</span>
                      </div>
                    </button>
                  ))}

                  {sucursalesFiltradasClonar.length === 0 && (
                    <div className="p-3 text-sm text-gray-500">No hay coincidencias.</div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-gray-700">Origen: Fecha inicio</label>
                <input
                  value={clonarOrigenIni}
                  onChange={(e) => setClonarOrigenIni(e.target.value)}
                  type="date"
                  className="w-full border rounded-xl p-3"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-gray-700">Origen: Fecha fin</label>
                <input
                  value={clonarOrigenFin}
                  onChange={(e) => setClonarOrigenFin(e.target.value)}
                  type="date"
                  className="w-full border rounded-xl p-3"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold mb-1 text-gray-700">Destino: Nueva fecha inicio</label>
                <input
                  value={clonarDestinoIni}
                  onChange={(e) => setClonarDestinoIni(e.target.value)}
                  type="date"
                  className="w-full border rounded-xl p-3"
                />
                <div className="text-[11px] text-gray-500 mt-1">
                  Se clona moviendo el rango origen por la diferencia de días (shift). Si ya existe un turno igual en
                  destino, se omite.
                </div>
              </div>

              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 bg-gray-50 border rounded-xl p-3">
                  <input
                    type="checkbox"
                    checked={clonarIncluirAsignados}
                    onChange={(e) => setClonarIncluirAsignados(e.target.checked)}
                  />
                  Incluir asignados
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 bg-gray-50 border rounded-xl p-3">
                  <input
                    type="checkbox"
                    checked={clonarIncluirVacantes}
                    onChange={(e) => setClonarIncluirVacantes(e.target.checked)}
                  />
                  Incluir vacantes
                </label>
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setModalClonar(false)}
                className="px-4 py-2 text-gray-700 font-semibold hover:bg-gray-200 rounded-xl"
                disabled={clonando}
              >
                Cancelar
              </button>
              <button
                onClick={clonarTurnos}
                className="px-6 py-2 bg-indigo-600 text-white font-extrabold rounded-xl hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-60"
                disabled={clonando}
              >
                <Check size={18} /> {clonando ? 'Clonando...' : 'Clonar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MASIVO */}
      {modalMasivo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-gray-200">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-4 flex justify-between items-center text-white">
              <h3 className="font-extrabold text-lg flex gap-2 items-center">
                <Layers /> Crear turnos masivos
              </h3>
              <button onClick={() => setModalMasivo(false)} className="hover:text-gray-300">
                <X />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold mb-1 text-gray-700">Sucursal / Cliente (buscable)</label>
                <input
                  value={masivoSucursalTerm}
                  onChange={(e) => {
                    setMasivoSucursalTerm(e.target.value);
                    setMasivoSucursalId(null);
                  }}
                  placeholder="Escribe para buscar..."
                  className="w-full border rounded-xl p-3"
                />
                <div className="mt-2 max-h-44 overflow-auto border rounded-xl bg-white">
                  {sucursalesFiltradasMasivo.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setMasivoSucursalId(s.id);
                        setMasivoSucursalTerm(`${s.empresa} - ${s.sucursal} (ID ${s.id})`);
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-indigo-50 transition ${
                        masivoSucursalId === s.id ? 'bg-indigo-100' : ''
                      }`}
                    >
                      <div className="font-bold text-sm text-gray-800">{s.empresa}</div>
                      <div className="text-xs text-gray-600">
                        {s.sucursal} <span className="text-gray-400">— ID {s.id}</span>
                      </div>
                    </button>
                  ))}
                  {sucursalesFiltradasMasivo.length === 0 && (
                    <div className="p-3 text-sm text-gray-500">No hay coincidencias.</div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-gray-700">Fecha inicio</label>
                <input
                  value={masivoFechaInicio}
                  onChange={(e) => setMasivoFechaInicio(e.target.value)}
                  type="date"
                  className="w-full border rounded-xl p-3"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-gray-700">Fecha fin</label>
                <input
                  value={masivoFechaFin}
                  onChange={(e) => setMasivoFechaFin(e.target.value)}
                  type="date"
                  className="w-full border rounded-xl p-3"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold mb-2 text-gray-700">Días</label>
                <div className="flex flex-wrap gap-2">
                  {DIAS.map((d) => (
                    <button
                      key={d.key}
                      onClick={() => toggleMasivoDia(d.key)}
                      className={`px-3 py-2 rounded-full text-sm font-bold border transition ${
                        masivoDias[d.key]
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-800 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-gray-700">Hora inicio</label>
                <input
                  value={masivoHoraIni}
                  onChange={(e) => setMasivoHoraIni(e.target.value)}
                  type="time"
                  className="w-full border rounded-xl p-3"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-gray-700">Hora fin</label>
                <input
                  value={masivoHoraFin}
                  onChange={(e) => setMasivoHoraFin(e.target.value)}
                  type="time"
                  className="w-full border rounded-xl p-3"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold mb-1 text-gray-700">
                  Empleado (opcional) — si lo dejas vacío quedan VACANTES
                </label>
                <input
                  value={masivoEmpleadoTerm}
                  onChange={(e) => {
                    setMasivoEmpleadoTerm(e.target.value);
                    setMasivoEmpleadoId(null);
                  }}
                  placeholder="Buscar por nombre o CC..."
                  className="w-full border rounded-xl p-3"
                />
                <div className="mt-2 max-h-44 overflow-auto border rounded-xl bg-white">
                  <button
                    onClick={() => {
                      setMasivoEmpleadoId(null);
                      setMasivoEmpleadoTerm('');
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-orange-50 transition ${
                      masivoEmpleadoId === null ? 'bg-orange-50' : ''
                    }`}
                  >
                    <div className="font-bold text-sm text-orange-700">Vacante (sin asignar)</div>
                    <div className="text-xs text-gray-600">Se crean los turnos y luego asignas.</div>
                  </button>

                  {empleadosFiltradosMasivo.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => {
                        setMasivoEmpleadoId(e.id);
                        setMasivoEmpleadoTerm(`${e.nombre_completo} (CC ${e.documento})`);
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-indigo-50 transition ${
                        masivoEmpleadoId === e.id ? 'bg-indigo-100' : ''
                      }`}
                    >
                      <div className="font-bold text-sm text-gray-800">{e.nombre_completo}</div>
                      <div className="text-xs text-gray-600">
                        CC: {e.documento} — {e.cargo}
                      </div>
                    </button>
                  ))}
                  {empleadosFiltradosMasivo.length === 0 && (
                    <div className="p-3 text-sm text-gray-500">No hay coincidencias.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setModalMasivo(false)}
                className="px-4 py-2 text-gray-700 font-semibold hover:bg-gray-200 rounded-xl"
                disabled={creandoMasivo}
              >
                Cancelar
              </button>
              <button
                onClick={crearMasivo}
                className="px-6 py-2 bg-green-600 text-white font-extrabold rounded-xl hover:bg-green-700 flex items-center gap-2 disabled:opacity-60"
                disabled={creandoMasivo}
              >
                <Check size={18} /> {creandoMasivo ? 'Creando...' : 'Crear turnos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR/EDITAR (sin cambios de UI, solo usa guardarTurnoBD actualizado) */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] overflow-y-auto animate-in zoom-in duration-200 flex flex-col">
            <div className="bg-gray-900 p-4 flex justify-between items-center text-white sticky top-0 z-10">
              <h3 className="font-bold text-lg flex gap-2">
                <Calendar /> {isEditing ? 'Editar Turno' : 'Nuevo Turno'}
              </h3>
              <button onClick={() => setModalAbierto(false)} className="hover:text-gray-300">
                <X />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 md:col-span-2">
                <label className="block text-xs font-bold mb-1 text-indigo-700">1. SUCURSAL / CLIENTE</label>
                <select
                  className="w-full border p-2 rounded mb-2 bg-white"
                  onChange={handleSucursalSelect}
                  value={formulario.sucursalId || ''}
                >
                  <option value="">-- Seleccionar --</option>
                  {listaSucursales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.empresa} - {s.sucursal}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 md:col-span-2">
                <label className="block text-xs font-bold mb-1 text-blue-700">2. EMPLEADO (Opcional)</label>

                <input
                  value={buscarEmpleado}
                  onChange={(e) => setBuscarEmpleado(e.target.value)}
                  placeholder="Buscar por nombre o CC..."
                  className="w-full border rounded-lg p-2 mb-2"
                />

                {fijosDeLaSede.length > 0 && (
                  <div className="mb-3 p-2 bg-yellow-50 rounded border border-yellow-200">
                    <span className="text-xs font-bold text-yellow-700 block mb-1">⭐ Sugeridos (Fijos):</span>
                    <div className="flex gap-2 flex-wrap">
                      {fijosDeLaSede.map((f) => (
                        <button
                          key={f.id}
                          onClick={(e) => handleEmpleadoSelect(e, f.id)}
                          className="text-xs bg-white border border-yellow-300 px-2 py-1 rounded hover:bg-yellow-100"
                        >
                          {f.nombre_completo}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <select
                  className="w-full border p-2 rounded mb-2 bg-white"
                  onChange={handleEmpleadoSelect}
                  value={formulario.empleadoId ?? ''}
                >
                  <option value="">-- Sin Asignar (Vacante) --</option>
                  {empleadosFiltradosParaModal.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre_completo} (CC: {e.documento})
                    </option>
                  ))}
                </select>

                <div className="text-[11px] text-gray-500">
                  Tip: escribe parte del nombre o la cédula para no scrollear.
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Fecha</label>
                <input
                  type="date"
                  className="w-full border p-2 rounded"
                  value={formulario.fecha}
                  onChange={(e) => calcularFecha(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold mb-1">Inicio</label>
                  <input
                    type="time"
                    className="w-full border p-2 rounded"
                    value={formulario.horaIni}
                    onChange={(e) => actualizarHoras(e.target.value, formulario.horaFin)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Fin</label>
                  <input
                    type="time"
                    className="w-full border p-2 rounded"
                    value={formulario.horaFin}
                    onChange={(e) => actualizarHoras(formulario.horaIni, e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t flex justify-end gap-3 sticky bottom-0 bg-gray-50 z-10">
              <button
                onClick={() => setModalAbierto(false)}
                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded"
              >
                Cancelar
              </button>
              <button
                onClick={guardarTurnoBD}
                className="px-6 py-2 bg-green-600 text-white font-bold rounded hover:bg-green-700 flex items-center gap-2"
              >
                <Check size={18} /> {isEditing ? 'ACTUALIZAR' : 'GUARDAR'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MODERNO DE ERRORES */}
      {errorModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden animate-in zoom-in duration-200">
            <div className="flex items-start justify-between gap-4 p-5 bg-gradient-to-r from-red-600 to-rose-600 text-white">
              <div>
                <h3 className="text-lg font-extrabold">{errorModal.titulo}</h3>
                <p className="text-sm text-white/90 mt-1">{errorModal.mensaje}</p>
              </div>
              <button
                onClick={() => setErrorModal(null)}
                className="p-2 rounded-lg hover:bg-white/10 transition"
                aria-label="Cerrar"
              >
                <X />
              </button>
            </div>

            {errorModal.campos.length > 0 && (
              <div className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {errorModal.campos.map((c, idx) => (
                    <div key={idx} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">{c.label}</div>
                      <div className="text-sm font-semibold text-gray-800 break-words">{c.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50">
              <button
                onClick={() => setErrorModal(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-200 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgramacionExternos;