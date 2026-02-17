import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, X, Calendar, Search, Check, ArrowUp, ArrowDown, UserMinus, AlertTriangle } from 'lucide-react';

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
  empleadoId: number | null; // Puede ser null si está vacante
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

const ProgramacionExternos = () => {
  const [listaEmpleados, setListaEmpleados] = useState<EmpleadoBD[]>([]);
  const [listaSucursales, setListaSucursales] = useState<SucursalBD[]>([]);
  const [turnos, setTurnos] = useState<TurnoExterno[]>([]);
  const [fijosDeLaSede, setFijosDeLaSede] = useState<EmpleadoBD[]>([]);

  // FILTROS Y ORDENAMIENTO
  const [busqueda, setBusqueda] = useState('');
  const [ordenFecha, setOrdenFecha] = useState<'asc' | 'desc'>('desc');

  // MODALES
  const [modalAbierto, setModalAbierto] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

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
      const resEmp = await fetch('http://localhost:3001/empleados');
      const dataEmp = await resEmp.json();
      setListaEmpleados(dataEmp);

      const resSuc = await fetch('http://localhost:3001/clientes-filtro?tipo=EXTERNOS');
      const dataSuc = await resSuc.json();
      setListaSucursales(dataSuc);
    } catch (error) {
      console.error('Error cargando listas', error);
    }
  }, []);

  const cargarTurnos = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3001/turnos-externos');
      const data = await res.json();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const turnosFormateados = data.map((t: any) => ({
        id: t.id,
        empleadoId: t.empleado_id, // Puede venir null
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
        // Defaults si la BD no trae estos campos:
        tipoTurno: t.tipo_turno ?? '',
        franjaHoraria: t.franja_horaria ?? '',
        estadoEjecucion: t.estado_ejecucion ?? 'Pendiente',
      }));

      setTurnos(turnosFormateados);
    } catch (error) {
      console.error('Error cargando turnos', error);
    }
  }, []);

  // FIX ESLINT react-hooks/set-state-in-effect:
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

  // --- HELPERS ---
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
        const res = await fetch(`http://localhost:3001/fijos/${suc.id}`);
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
      fetch(`http://localhost:3001/fijos/${turno.sucursalId}`)
        .then((res) => res.json())
        .then((data) => setFijosDeLaSede(data))
        .catch((err) => console.error(err));
    }
    setModalAbierto(true);
  };

  const eliminarTurno = async (id: number) => {
    if (!window.confirm('¿Seguro de eliminar este turno POR COMPLETO?')) return;
    try {
      const res = await fetch(`http://localhost:3001/turnos-externos/${id}`, { method: 'DELETE' });
      if (res.ok) cargarTurnos();
    } catch (error) {
      console.error(error);
    }
  };

  const liberarTurno = async (id: number) => {
    if (!window.confirm('¿Quitar al empleado de este turno? (Quedará Vacante)')) return;
    try {
      const res = await fetch(`http://localhost:3001/turnos-externos/${id}/liberar`, { method: 'PATCH' });
      if (res.ok) cargarTurnos();
      else alert('Error al liberar turno');
    } catch (error) {
      console.error(error);
    }
  };

  const guardarTurnoBD = async () => {
    if (formulario.sucursalId === 0 || !formulario.fecha) {
      return alert('Sucursal y Fecha son obligatorios');
    }

    try {
      const url = isEditing ? `http://localhost:3001/turnos-externos/${formulario.id}` : 'http://localhost:3001/turnos-externos';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formulario),
      });

      if (response.ok) {
        alert(isEditing ? 'Actualizado' : 'Guardado');
        setModalAbierto(false);
        cargarTurnos();
      } else {
        alert('Error guardando');
      }
    } catch (error) {
      console.error(error);
    }
  };

  // --- VISUALIZACIÓN ---
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
    resultado.sort((a, b) => {
      const fechaA = new Date(a.fecha).getTime();
      const fechaB = new Date(b.fecha).getTime();
      return ordenFecha === 'asc' ? fechaA - fechaB : fechaB - fechaA;
    });
    return resultado;
  };

  const turnosVisuales = procesarTurnos();
  const toggleOrdenFecha = () => setOrdenFecha((prev) => (prev === 'asc' ? 'desc' : 'asc'));

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
              setFormulario(turnoVacio);
              setIsEditing(false);
              setModalAbierto(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus size={18} /> Crear Turno
          </button>
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
                        t.nombre ? 'bg-green-100 text-green-700 border-green-200' : 'bg-orange-100 text-orange-600 border-orange-200'
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

      {/* MODAL */}
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
                <select className="w-full border p-2 rounded mb-2 bg-white" onChange={handleSucursalSelect} value={formulario.sucursalId || ''}>
                  <option value="">-- Seleccionar --</option>
                  {listaSucursales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.empresa} - {s.sucursal}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 md:col-span-2">
                <label className="block text-xs font-bold mb-1 text-blue-700">2. EMPLEADO (Opcional - Dejar vacío para Pendiente)</label>
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
                <select className="w-full border p-2 rounded mb-2 bg-white" onChange={handleEmpleadoSelect} value={formulario.empleadoId || ''}>
                  <option value="">-- Sin Asignar (Vacante) --</option>
                  {listaEmpleados.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre_completo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Fecha</label>
                <input type="date" className="w-full border p-2 rounded" value={formulario.fecha} onChange={(e) => calcularFecha(e.target.value)} />
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
              <button onClick={() => setModalAbierto(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded">
                Cancelar
              </button>
              <button onClick={guardarTurnoBD} className="px-6 py-2 bg-green-600 text-white font-bold rounded hover:bg-green-700 flex items-center gap-2">
                <Check size={18} /> {isEditing ? 'ACTUALIZAR' : 'GUARDAR'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgramacionExternos;