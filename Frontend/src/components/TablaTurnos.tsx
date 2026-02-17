import React, { useState, useEffect, useMemo } from 'react';
import {
  UserPlus,
  Building2,
  Trash2,
  UserCheck,
  RefreshCw,
  Edit,
  Calendar,
  FileText,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface EmpleadoGrid {
  id_programacion: number;
  empleado_id: number;
  nombre: string;
  tipo: 'Fijo' | 'Apoyo';
  turnos: string[];
}

interface SucursalGrid {
  id: number;
  nombre: string;
  empleados: EmpleadoGrid[];
}

interface EmpleadoBD {
  id: number;
  nombre_completo: string;
}

type DiaKey = 'sabado' | 'domingo' | 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes';

type ExternoOverlay = {
  id: number;
  empleado_id: number;
  fecha: string; // ISO o YYYY-MM-DD
  hora_inicio: string; // "HH:MM" o "HH:MM:SS"
  hora_fin: string; // "HH:MM" o "HH:MM:SS"
  empresa: string; // ej: YANUBA
  sucursal: string; // ej: CENTRO
};

type OverlayResponse = {
  fecha_inicio_semana: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  programacion: any[];
  externos: ExternoOverlay[];
};

type OverlayTexto = { line1: string; line2: string };

const TablaTurnos = () => {
  const [fechaInicioSemana, setFechaInicioSemana] = useState('2026-02-14');

  const diasSemana = useMemo(() => {
    const base = new Date(fechaInicioSemana + 'T00:00:00');
    const dias: { key: DiaKey; label: string }[] = [
      { key: 'sabado', label: 'Sábado' },
      { key: 'domingo', label: 'Domingo' },
      { key: 'lunes', label: 'Lunes' },
      { key: 'martes', label: 'Martes' },
      { key: 'miercoles', label: 'Miércoles' },
      { key: 'jueves', label: 'Jueves' },
      { key: 'viernes', label: 'Viernes' },
    ];

    return dias.map((d, index) => {
      const fechaDia = new Date(base);
      fechaDia.setDate(base.getDate() + index);
      const dia = fechaDia.getDate();
      const mes = fechaDia.toLocaleDateString('es-CO', { month: 'short' });
      return {
        fecha: `${dia} ${mes}`,
        dia: d.label,
        key: d.key,
      };
    });
  }, [fechaInicioSemana]);

  const [sucursales, setSucursales] = useState<SucursalGrid[]>([]);
  const [listaEmpleadosBD, setListaEmpleadosBD] = useState<EmpleadoBD[]>([]);

  // Overlay externos
  const [overlayExternosMap, setOverlayExternosMap] = useState<Map<string, OverlayTexto[]>>(new Map());

  // Modales
  const [modalSucursalAbierto, setModalSucursalAbierto] = useState(false);
  const [modalEmpleadoAbierto, setModalEmpleadoAbierto] = useState(false);
  const [nuevaSucursalNombre, setNuevaSucursalNombre] = useState('');

  // Edición
  const [modoEdicion, setModoEdicion] = useState(false);
  const [idProgramacionAEditar, setIdProgramacionAEditar] = useState<number | null>(null);
  const [sucursalSeleccionadaId, setSucursalSeleccionadaId] = useState<number | null>(null);
  const [tipoSeleccionado, setTipoSeleccionado] = useState<'Fijo' | 'Apoyo'>('Fijo');
  const [empleadoSeleccionadoId, setEmpleadoSeleccionadoId] = useState<string>('');

  const [rotando, setRotando] = useState(false);

  // ---------- HELPERS ----------
  const normalizarFecha = (f: string) => (f ? f.toString().split('T')[0] : '');

  const sumarDias = (fechaInicio: string, dias: number) => {
    const d = new Date(fechaInicio + 'T00:00:00');
    d.setDate(d.getDate() + dias);
    return d.toISOString().split('T')[0];
  };

  const keyExterno = (empleadoId: number, fecha: string) => `${empleadoId}-${fecha}`;

  const parseHora = (h: string) => {
    if (!h) return { h24: 0, m: 0 };
    const [hhStr, mmStr] = h.split(':');
    const hh = parseInt(hhStr || '0', 10);
    const mm = parseInt(mmStr || '0', 10);
    return { h24: Number.isNaN(hh) ? 0 : hh, m: Number.isNaN(mm) ? 0 : mm };
  };

  // 11:00 -> "11", 11:30 -> "11:30", 14:00 -> "2"
  const formatearInicioCorto = (h: string) => {
    const { h24, m } = parseHora(h);
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    return m === 0 ? `${h12}` : `${h12}:${m.toString().padStart(2, '0')}`;
  };

  // 15:00 -> "3PM", 05:00 -> "5AM", 17:30 -> "5:30PM"
  const formatearConAMPM = (h: string) => {
    const { h24, m } = parseHora(h);
    const suf = h24 >= 12 ? 'PM' : 'AM';
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    return m === 0 ? `${h12}${suf}` : `${h12}:${m.toString().padStart(2, '0')}${suf}`;
  };

  // Lee hora inicio PPY del texto escrito en la celda PPY.
  // Necesitas escribir el PPY como: "5PM" o "5PM A 9PM" (recomendado), o "17 A 21".
  // Si solo dice "PM", NO se puede deducir 5PM y retornará "".
  const parseInicioPPYDesdeTexto = (texto: string): string => {
    const t = (texto || '').toUpperCase().trim();
    if (!t || t.includes('DESC')) return '';

    // 1) si el usuario escribió solo "5PM" / "5 PM"
    const soloHora = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (soloHora) {
      const h = soloHora[1];
      const m = soloHora[2];
      const ap = soloHora[3].toUpperCase();
      return `${h}${m ? `:${m}` : ''}${ap}`;
    }

    // 2) "5PM A 9PM" / "5PM-9PM"
    const rango12 = t.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*(?:A|-|HASTA)\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
    if (rango12) {
      const h1 = rango12[1];
      const m1 = rango12[2];
      const ap1 = rango12[3].toUpperCase();
      return `${h1}${m1 ? `:${m1}` : ''}${ap1}`;
    }

    // 3) "17 A 21" / "17:00 A 21:00"
    const rango24 = t.match(/(\d{1,2})(?::(\d{2}))?\s*(?:A|-|HASTA)\s*(\d{1,2})(?::(\d{2}))?/i);
    if (rango24) {
      const h1 = parseInt(rango24[1], 10);
      const m1 = parseInt(rango24[2] || '0', 10);

      if (!Number.isNaN(h1)) {
        const suf = h1 >= 12 ? 'PM' : 'AM';
        let h12 = h1 % 12;
        if (h12 === 0) h12 = 12;
        return Number.isNaN(m1) || m1 === 0 ? `${h12}${suf}` : `${h12}:${m1.toString().padStart(2, '0')}${suf}`;
      }
    }

    return '';
  };

  // Texto overlay EXACTO:
  // Line1: "11 A 3PM YANUBA"
  // Line2: "CENTRO - 5PM"   <-- 5PM sale de la celda PPY (texto del textarea)
  const construirTextoOverlay = (t: ExternoOverlay): OverlayTexto => {
    const ini = formatearInicioCorto(t.hora_inicio);
    const fin = formatearConAMPM(t.hora_fin);

    const empresa = (t.empresa || '').toString().trim().toUpperCase();
    const sucursal = (t.sucursal || '').toString().trim().toUpperCase();

    return {
      line1: `${ini} A ${fin} ${empresa}`.trim(),
      line2: `${sucursal}`.trim(), // SOLO SUCURSAL (la hora PPY se agrega al render)
    };
  };

  const construirMapaExternos = (externos: ExternoOverlay[]) => {
    const map = new Map<string, OverlayTexto[]>();

    externos.forEach((t) => {
      const fecha = normalizarFecha(t.fecha);
      const k = keyExterno(t.empleado_id, fecha);
      const texto = construirTextoOverlay(t);

      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(texto);
    });

    return map;
  };

  const obtenerExternosParaCelda = (empleadoId: number, indexTurno: number) => {
    const fechaCelda = sumarDias(fechaInicioSemana, indexTurno);
    return overlayExternosMap.get(keyExterno(empleadoId, fechaCelda)) || [];
  };

  // --- CARGAR DATOS ---
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const resSuc = await fetch('http://localhost:3001/clientes');
        const dataSuc = await resSuc.json();

        const resProg = await fetch(`http://localhost:3001/programacion-semanal-con-externos?fecha=${fechaInicioSemana}`);
        const dataProgOverlay = (await resProg.json()) as OverlayResponse;

        const dataProg = dataProgOverlay.programacion || [];
        const externos = dataProgOverlay.externos || [];
        setOverlayExternosMap(construirMapaExternos(externos));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const soloPanPaYa = dataSuc.filter((s: any) => s.empresa === 'PAN PA YA');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const estructura: SucursalGrid[] = soloPanPaYa.map((s: any) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const empleadosDeSucursal = dataProg.filter((p: any) => p.sucursal_id === s.id);

          return {
            id: s.id,
            nombre: s.sucursal,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            empleados: empleadosDeSucursal.map((p: any) => ({
              id_programacion: p.id,
              empleado_id: p.empleado_id,
              nombre: p.nombre_empleado,
              tipo: p.tipo_empleado,
              turnos: [p.sabado, p.domingo, p.lunes, p.martes, p.miercoles, p.jueves, p.viernes],
            })),
          };
        });

        setSucursales(estructura);

        const resEmp = await fetch('http://localhost:3001/empleados');
        setListaEmpleadosBD(await resEmp.json());
      } catch (error) {
        console.error('Error cargando datos', error);
      }
    };

    cargarDatos();
  }, [fechaInicioSemana]);

  // --- RECARGA MANUAL ---
  const recargarDatosManual = async () => {
    try {
      const resSuc = await fetch('http://localhost:3001/clientes');
      const dataSuc = await resSuc.json();

      const resProg = await fetch(`http://localhost:3001/programacion-semanal-con-externos?fecha=${fechaInicioSemana}`);
      const dataProgOverlay = (await resProg.json()) as OverlayResponse;

      const dataProg = dataProgOverlay.programacion || [];
      const externos = dataProgOverlay.externos || [];
      setOverlayExternosMap(construirMapaExternos(externos));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const soloPanPaYa = dataSuc.filter((s: any) => s.empresa === 'PAN PA YA');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const estructura = soloPanPaYa.map((s: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const empleadosDeSucursal = dataProg.filter((p: any) => p.sucursal_id === s.id);
        return {
          id: s.id,
          nombre: s.sucursal,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          empleados: empleadosDeSucursal.map((p: any) => ({
            id_programacion: p.id,
            empleado_id: p.empleado_id,
            nombre: p.nombre_empleado,
            tipo: p.tipo_empleado,
            turnos: [p.sabado, p.domingo, p.lunes, p.martes, p.miercoles, p.jueves, p.viernes],
          })),
        };
      });

      setSucursales(estructura);
    } catch (error) {
      console.error(error);
    }
  };

  // --- CAMBIAR SEMANA ---
  const cambiarSemana = async (dias: number) => {
    const fechaBase = new Date(fechaInicioSemana + 'T00:00:00');
    const nuevaFechaObj = new Date(fechaBase);
    nuevaFechaObj.setDate(fechaBase.getDate() + dias);
    const nuevaFechaStr = nuevaFechaObj.toISOString().split('T')[0];

    if (dias > 0) {
      try {
        await fetch('http://localhost:3001/replicar-programacion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fechaAnterior: fechaInicioSemana, fechaNueva: nuevaFechaStr }),
        });
      } catch (error) {
        console.error('Error intentando replicar:', error);
      }
    }
    setFechaInicioSemana(nuevaFechaStr);
  };

  // --- EXPORTAR PDF ---
  const exportarPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.text(`Programación Pan Pa Ya - Semana del ${fechaInicioSemana}`, 14, 15);

    const bodyData: string[][] = [];
    sucursales.forEach((suc) => {
      bodyData.push([suc.nombre, '', '', '', '', '', '', '']);
      suc.empleados.forEach((emp) => {
        bodyData.push([emp.nombre + ` (${emp.tipo})`, ...emp.turnos]);
      });
    });

    autoTable(doc, {
      head: [['SUCURSAL / EMPLEADO', ...diasSemana.map((d) => `${d.dia} ${d.fecha}`)]],
      body: bodyData,
      startY: 20,
      theme: 'grid',
      styles: { fontSize: 8 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      didParseCell: function (data: any) {
        if (data.row.cells[0].raw && !data.row.cells[1].raw) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [220, 220, 220];
        }
      },
    });
    doc.save(`programacion_${fechaInicioSemana}.pdf`);
  };

  // --- EXPORTAR EXCEL ---
  const exportarExcel = () => {
    const datosExcel: Record<string, string>[] = [];
    sucursales.forEach((suc) => {
      datosExcel.push({ EMPLEADO: `--- ${suc.nombre} ---` });
      suc.empleados.forEach((emp) => {
        const fila: Record<string, string> = { EMPLEADO: emp.nombre, TIPO: emp.tipo };
        diasSemana.forEach((d, i) => {
          fila[`${d.dia} ${d.fecha}`] = emp.turnos[i];
        });
        datosExcel.push(fila);
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(datosExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Programación');
    XLSX.writeFile(workbook, `programacion_${fechaInicioSemana}.xlsx`);
  };

  // --- FUNCIONES CRUD ---
  const abrirModalAgregar = (sucursalId: number, tipo: 'Fijo' | 'Apoyo') => {
    setModoEdicion(false);
    setSucursalSeleccionadaId(sucursalId);
    setTipoSeleccionado(tipo);
    setEmpleadoSeleccionadoId('');
    setModalEmpleadoAbierto(true);
  };

  const abrirModalEditar = (idProgramacion: number, empleadoActualId: number, tipo: 'Fijo' | 'Apoyo') => {
    setModoEdicion(true);
    setIdProgramacionAEditar(idProgramacion);
    setTipoSeleccionado(tipo);
    setEmpleadoSeleccionadoId(empleadoActualId.toString());
    setModalEmpleadoAbierto(true);
  };

  const guardarEmpleado = async () => {
    if (!empleadoSeleccionadoId) return;
    try {
      const bodyBase = {
        sucursalId: sucursalSeleccionadaId,
        empleadoId: parseInt(empleadoSeleccionadoId),
        tipo: tipoSeleccionado,
        fechaSemana: fechaInicioSemana,
      };

      if (modoEdicion && idProgramacionAEditar) {
        const response = await fetch('http://localhost:3001/programacion-semanal/editar-empleado', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idProgramacion: idProgramacionAEditar, nuevoEmpleadoId: parseInt(empleadoSeleccionadoId) }),
        });
        if (response.ok) {
          setModalEmpleadoAbierto(false);
          recargarDatosManual();
        }
      } else {
        if (!sucursalSeleccionadaId) return;
        const response = await fetch('http://localhost:3001/programacion-semanal/agregar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyBase),
        });
        if (response.ok) {
          setModalEmpleadoAbierto(false);
          recargarDatosManual();
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleChange = async (
    sucursalId: number,
    idProgramacion: number,
    empleadoId: number,
    tipo: string,
    valor: string,
    indexTurno: number
  ) => {
    const sucursalActual = sucursales.find((s) => s.id === sucursalId);
    const empleadoActual = sucursalActual?.empleados.find((e) => e.id_programacion === idProgramacion);
    const valorAnterior = empleadoActual?.turnos[indexTurno] || '';

    const actualizarEstado = (nuevoValor: string) => {
      const nuevasSucursales = sucursales.map((suc) => {
        if (suc.id !== sucursalId) return suc;
        const nuevosEmpleados = suc.empleados.map((emp) => {
          if (emp.id_programacion !== idProgramacion) return emp;
          const nuevosTurnos = [...emp.turnos];
          nuevosTurnos[indexTurno] = nuevoValor;
          return { ...emp, turnos: nuevosTurnos };
        });
        return { ...suc, empleados: nuevosEmpleados };
      });
      setSucursales(nuevasSucursales);
    };

    actualizarEstado(valor);

    try {
      const diaColumna = diasSemana[indexTurno].key;
      const response = await fetch('http://localhost:3001/programacion-semanal/actualizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sucursalId, empleadoId, tipo, dia: diaColumna, valor, fechaSemana: fechaInicioSemana }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(`⚠️ ${data.error}: ${data.mensaje}`);
        actualizarEstado(valorAnterior);
      }
    } catch (error) {
      console.error('Error', error);
      alert('Error de conexión');
      actualizarEstado(valorAnterior);
    }
  };

  const rotarTurnos = async () => {
    if (!window.confirm('¿Seguro que deseas rotar los turnos de los FIJOS en cada sede?')) return;
    setRotando(true);
    try {
      await fetch('http://localhost:3001/rotar-turnos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fechaSemana: fechaInicioSemana }),
      });
      setTimeout(() => {
        recargarDatosManual();
        setRotando(false);
        alert('Turnos rotados correctamente');
      }, 500);
    } catch (error) {
      console.error(error);
      setRotando(false);
    }
  };

  const eliminarFila = async (idProgramacion: number) => {
    if (!window.confirm('¿Quitar a este empleado de la programación?')) return;
    try {
      await fetch(`http://localhost:3001/programacion-semanal/${idProgramacion}`, { method: 'DELETE' });
      recargarDatosManual();
    } catch (error) {
      console.error(error);
    }
  };

  const guardarNuevaSucursal = async () => {
    if (!nuevaSucursalNombre.trim()) return;
    try {
      await fetch('http://localhost:3001/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa: 'PAN PA YA',
          sucursal: nuevaSucursalNombre.toUpperCase(),
          idInterwap: 'PEND',
          direccion: 'PEND',
        }),
      });
      setModalSucursalAbierto(false);
      setNuevaSucursalNombre('');
      recargarDatosManual();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-100 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 tracking-tight">Planificación Semanal</h2>
          <p className="text-sm text-gray-500">Gestión de turnos fijos y apoyos (BD)</p>
        </div>

        <div className="flex items-center bg-gray-50 rounded-lg p-1 border border-gray-200 shadow-inner">
          <button onClick={() => cambiarSemana(-7)} className="p-2 hover:bg-white hover:shadow rounded-md transition-all text-gray-600">
            <ChevronLeft size={20} />
          </button>
          <div className="px-4 flex items-center gap-2 font-bold text-gray-700 min-w-[220px] justify-center">
            <Calendar size={18} className="text-indigo-600" />
            <span>Semana: {fechaInicioSemana}</span>
          </div>
          <button onClick={() => cambiarSemana(7)} className="p-2 hover:bg-white hover:shadow rounded-md transition-all text-gray-600">
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="flex gap-2 flex-wrap justify-center">
          <button
            onClick={exportarPDF}
            className="flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-all text-sm font-medium shadow-sm"
            title="Descargar PDF"
          >
            <FileText size={18} /> PDF
          </button>
          <button
            onClick={exportarExcel}
            className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-all text-sm font-medium shadow-sm"
            title="Descargar Excel"
          >
            <FileSpreadsheet size={18} /> Excel
          </button>
          <div className="w-px h-8 bg-gray-300 mx-1 hidden xl:block"></div>
          <button
            onClick={rotarTurnos}
            disabled={rotando}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-white font-medium transition-all shadow-sm text-sm ${
              rotando ? 'bg-orange-400 cursor-wait' : 'bg-orange-500 hover:bg-orange-600'
            }`}
          >
            <RefreshCw size={18} className={rotando ? 'animate-spin' : ''} /> Rotar
          </button>
          <button
            onClick={() => setModalSucursalAbierto(true)}
            className="flex items-center gap-2 bg-slate-800 text-white px-3 py-2 rounded-lg hover:bg-slate-700 transition-all shadow-sm text-sm font-medium"
          >
            <Building2 size={18} /> Sede PPY
          </button>
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl shadow-lg border border-gray-200">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-slate-900 text-white">
            <tr>
              <th className="p-3 border-r border-slate-700 min-w-[250px] sticky left-0 bg-slate-900 z-20">SUCURSAL / EMPLEADO</th>
              {diasSemana.map((dia, index) => (
                <th key={index} className="p-3 border-r border-slate-700 text-center min-w-[120px]">
                  <div className="text-xs opacity-75 uppercase tracking-wider">{dia.dia}</div>
                  <div className="font-bold text-lg">{dia.fecha}</div>
                </th>
              ))}
              <th className="p-2 w-10 text-center bg-slate-900"></th>
            </tr>
          </thead>

          <tbody>
            {sucursales.length === 0 && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-gray-400">
                  No hay sedes de PAN PA YA registradas.
                </td>
              </tr>
            )}

            {sucursales.map((sucursal) => (
              <React.Fragment key={sucursal.id}>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <td
                    className="p-3 bg-indigo-50/50 border-r border-indigo-100 font-bold text-indigo-900 flex justify-between items-center sticky left-0 z-10"
                    colSpan={1}
                  >
                    <span className="flex items-center gap-2 text-lg">
                      <Building2 size={20} className="text-indigo-600" />
                      {sucursal.nombre}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => abrirModalAgregar(sucursal.id, 'Fijo')}
                        className="text-xs flex items-center gap-1 bg-white border border-indigo-200 text-indigo-700 px-3 py-1 rounded-md hover:bg-indigo-600 hover:text-white transition-all shadow-sm font-medium"
                      >
                        <UserCheck size={14} /> + Fijo
                      </button>
                      <button
                        onClick={() => abrirModalAgregar(sucursal.id, 'Apoyo')}
                        className="text-xs flex items-center gap-1 bg-white border border-orange-200 text-orange-600 px-3 py-1 rounded-md hover:bg-orange-500 hover:text-white transition-all shadow-sm font-medium"
                      >
                        <UserPlus size={14} /> + Apoyo
                      </button>
                    </div>
                  </td>
                  <td colSpan={8} className="bg-gray-50/30"></td>
                </tr>

                {sucursal.empleados.map((empleado) => (
                  <tr key={empleado.id_programacion} className="group hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors">
                    <td className="p-2 border-r border-gray-100 sticky left-0 bg-white group-hover:bg-gray-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      <div className="flex justify-between items-center px-2">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-700 uppercase text-sm">{empleado.nombre}</span>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded w-fit mt-1 ${
                              empleado.tipo === 'Fijo' ? 'bg-slate-100 text-slate-600' : 'bg-orange-100 text-orange-600'
                            }`}
                          >
                            {empleado.tipo}
                          </span>
                        </div>
                        <button
                          onClick={() => abrirModalEditar(empleado.id_programacion, empleado.empleado_id, empleado.tipo)}
                          className="text-gray-400 hover:text-blue-600 p-1 rounded transition-colors"
                        >
                          <Edit size={16} />
                        </button>
                      </div>
                    </td>

                    {empleado.turnos.map((turno, tIndex) => {
  const externosTxt = obtenerExternosParaCelda(empleado.empleado_id, tIndex);

  // SOLO 1 overlay (evita duplicados si llegan 2 externos el mismo día)
  const externoPrincipal = externosTxt[0];

  // Hora inicio PPY (ej: 5PM) tomada del texto del textarea (si escribes "5PM" o "5PM A 9PM")
  const inicioPPY = parseInicioPPYDesdeTexto(turno);

  const colorBase =
    turno === 'DESCANSO' || turno === 'DESC'
      ? 'text-red-500 bg-red-50/50'
      : turno.includes('AM')
        ? 'text-blue-600'
        : turno.includes('PM')
          ? 'text-purple-600'
          : 'text-gray-700';

  // Si hay overlay, ocultamos el texto del textarea para que no se vea duplicado (ej: "5PM")
  const ocultarTextoPPY = Boolean(externoPrincipal);

  return (
    <td key={tIndex} className="p-0 border-r border-gray-100 h-16 relative">
      <div className="h-16 w-full relative">
        <textarea
          value={turno}
          onChange={(e) =>
            handleChange(
              sucursal.id,
              empleado.id_programacion,
              empleado.empleado_id,
              empleado.tipo,
              e.target.value,
              tIndex
            )
          }
          className={`w-full h-full text-center text-xs font-semibold focus:outline-none focus:bg-indigo-50 transition-colors resize-none p-2 flex items-center justify-center ${colorBase} ${
            ocultarTextoPPY ? 'text-transparent caret-indigo-600' : ''
          }`}
        />

        {/* OVERLAY limpio (sin repetirse) */}
        {externoPrincipal && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center px-1">
            <div className="text-center leading-tight">
              <div className="text-[11px] font-bold text-purple-700">
                <div>{externoPrincipal.line1}</div>
                <div>
                  {externoPrincipal.line2}
                  {inicioPPY ? ` - ${inicioPPY}` : ''}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </td>
  );
})}

                    <td className="p-0 text-center">
                      <button
                        onClick={() => eliminarFila(empleado.id_programacion)}
                        className="text-gray-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {modalSucursalAbierto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-96 overflow-hidden p-6 space-y-4">
            <h3 className="font-bold text-lg">Nueva Sede (Pan Pa Ya)</h3>
            <input
              autoFocus
              type="text"
              value={nuevaSucursalNombre}
              onChange={(e) => setNuevaSucursalNombre(e.target.value)}
              placeholder="Ej: CALLE 100"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModalSucursalAbierto(false)} className="flex-1 px-4 py-2 border rounded-lg">
                Cancelar
              </button>
              <button onClick={guardarNuevaSucursal} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalEmpleadoAbierto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-96 overflow-hidden p-6 space-y-4">
            <h3 className="font-bold text-lg text-indigo-700">
              {modoEdicion ? `Cambiar Empleado (${tipoSeleccionado})` : `Agregar ${tipoSeleccionado}`}
            </h3>
            <div>
              <label className="block text-xs font-bold mb-1 text-gray-500">Seleccionar Empleado</label>
              <select
                className="w-full border p-2 rounded"
                value={empleadoSeleccionadoId}
                onChange={(e) => setEmpleadoSeleccionadoId(e.target.value)}
              >
                <option value="">-- Buscar --</option>
                {listaEmpleadosBD.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nombre_completo}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModalEmpleadoAbierto(false)} className="flex-1 px-4 py-2 border rounded-lg">
                Cancelar
              </button>
              <button onClick={guardarEmpleado} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg">
                {modoEdicion ? 'Actualizar' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TablaTurnos;