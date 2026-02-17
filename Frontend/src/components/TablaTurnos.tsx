import React, { useState, useEffect, useCallback } from 'react';
import { UserPlus, Building2, Trash2, UserCheck } from 'lucide-react';

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

const TablaTurnos = () => {
  const diasSemana = [
    { fecha: '14 Feb', dia: 'Sábado', key: 'sabado' },
    { fecha: '15 Feb', dia: 'Domingo', key: 'domingo' },
    { fecha: '16 Feb', dia: 'Lunes', key: 'lunes' },
    { fecha: '17 Feb', dia: 'Martes', key: 'martes' },
    { fecha: '18 Feb', dia: 'Miércoles', key: 'miercoles' },
    { fecha: '19 Feb', dia: 'Jueves', key: 'jueves' },
    { fecha: '20 Feb', dia: 'Viernes', key: 'viernes' },
  ];

  const [sucursales, setSucursales] = useState<SucursalGrid[]>([]);
  const [modalSucursalAbierto, setModalSucursalAbierto] = useState(false);
  const [modalEmpleadoAbierto, setModalEmpleadoAbierto] = useState(false);
  const [listaEmpleadosBD, setListaEmpleadosBD] = useState<EmpleadoBD[]>([]);
  const [nuevaSucursalNombre, setNuevaSucursalNombre] = useState('');
  const [sucursalSeleccionadaId, setSucursalSeleccionadaId] = useState<number | null>(null);
  const [tipoSeleccionado, setTipoSeleccionado] = useState<'Fijo' | 'Apoyo'>('Fijo');
  const [empleadoSeleccionadoId, setEmpleadoSeleccionadoId] = useState<string>('');

  // --- CARGAR DATOS ---
  const cargarDatos = useCallback(async () => {
    try {
      // 1. Obtener todas las sucursales
      const resSuc = await fetch('http://localhost:3001/clientes');
      const dataSuc = await resSuc.json();
      
      // 2. Obtener la programación guardada
      const resProg = await fetch('http://localhost:3001/programacion-semanal');
      const dataProg = await resProg.json();

      // --- FILTRO CLAVE: SOLO PAN PA YA ---
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const soloPanPaYa = dataSuc.filter((s: any) => s.empresa === 'PAN PA YA');

      // 3. Organizar los datos
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const estructura: SucursalGrid[] = soloPanPaYa.map((s: any) => {
        // Buscar empleados programados en esta sucursal
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
            turnos: [p.sabado, p.domingo, p.lunes, p.martes, p.miercoles, p.jueves, p.viernes]
          }))
        };
      });

      setSucursales(estructura);
      
      const resEmp = await fetch('http://localhost:3001/empleados');
      setListaEmpleadosBD(await resEmp.json());

    } catch (error) {
      console.error("Error cargando datos", error);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Dependencias vacías para evitar bucle

  // --- GUARDAR CAMBIOS (CELDA) ---
  const handleChange = async (sucursalId: number, idProgramacion: number, empleadoId: number, tipo: string, valor: string, indexTurno: number) => {
    // 1. Actualizar visualmente
    const nuevasSucursales = sucursales.map(suc => {
      if (suc.id !== sucursalId) return suc;
      const nuevosEmpleados = suc.empleados.map(emp => {
        if (emp.id_programacion !== idProgramacion) return emp;
        const nuevosTurnos = [...emp.turnos];
        nuevosTurnos[indexTurno] = valor;
        return { ...emp, turnos: nuevosTurnos };
      });
      return { ...suc, empleados: nuevosEmpleados };
    });
    setSucursales(nuevasSucursales);

    // 2. Guardar en BD
    try {
      const diaColumna = diasSemana[indexTurno].key;
      await fetch('http://localhost:3001/programacion-semanal/actualizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sucursalId,
          empleadoId,
          tipo,
          dia: diaColumna,
          valor
        })
      });
    } catch (error) {
      console.error("Error guardando turno", error);
    }
  };

  // --- AGREGAR EMPLEADO A LA TABLA ---
  const abrirModalEmpleado = (sucursalId: number, tipo: 'Fijo' | 'Apoyo') => {
    setSucursalSeleccionadaId(sucursalId);
    setTipoSeleccionado(tipo);
    setEmpleadoSeleccionadoId('');
    setModalEmpleadoAbierto(true);
  };

  const confirmarAgregarEmpleado = async () => {
    if (!sucursalSeleccionadaId || !empleadoSeleccionadoId) return;

    try {
      const response = await fetch('http://localhost:3001/programacion-semanal/agregar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sucursalId: sucursalSeleccionadaId,
          empleadoId: parseInt(empleadoSeleccionadoId),
          tipo: tipoSeleccionado
        })
      });

      if (response.ok) {
        setModalEmpleadoAbierto(false);
        cargarDatos();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const eliminarFila = async (idProgramacion: number) => {
    if(!window.confirm("¿Quitar a este empleado de la programación?")) return;

    try {
      await fetch(`http://localhost:3001/programacion-semanal/${idProgramacion}`, {
        method: 'DELETE'
      });
      cargarDatos();
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
                empresa: 'PAN PA YA', // SIEMPRE PAN PA YA EN ESTA VISTA
                sucursal: nuevaSucursalNombre.toUpperCase(),
                idInterwap: 'PEND',
                direccion: 'PEND'
            })
        });
        setModalSucursalAbierto(false);
        setNuevaSucursalNombre('');
        cargarDatos();
    } catch (error) {
        console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-gray-800 tracking-tight">Planificación Semanal (PAN PA YA)</h2>
          <p className="text-sm text-gray-500">Gestión de turnos fijos y apoyos</p>
        </div>
        <button 
          onClick={() => setModalSucursalAbierto(true)}
          className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-all shadow-md text-sm font-medium"
        >
          <Building2 size={18} /> Nueva Sede PPY
        </button>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl shadow-lg border border-gray-200">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-slate-900 text-white">
            <tr>
              <th className="p-3 border-r border-slate-700 min-w-[250px] sticky left-0 bg-slate-900 z-20">
                SUCURSAL / EMPLEADO
              </th>
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
                        No hay sedes de PAN PA YA registradas. <br/>
                        Dale click a "Nueva Sede PPY" para empezar.
                    </td>
                </tr>
            )}
            {sucursales.map((sucursal) => (
              <React.Fragment key={sucursal.id}>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <td className="p-3 bg-indigo-50/50 border-r border-indigo-100 font-bold text-indigo-900 flex justify-between items-center sticky left-0 z-10" colSpan={1}>
                    <span className="flex items-center gap-2 text-lg">
                      <Building2 size={20} className="text-indigo-600"/>
                      {sucursal.nombre}
                    </span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => abrirModalEmpleado(sucursal.id, 'Fijo')}
                        className="text-xs flex items-center gap-1 bg-white border border-indigo-200 text-indigo-700 px-3 py-1 rounded-md hover:bg-indigo-600 hover:text-white transition-all shadow-sm font-medium"
                      >
                        <UserCheck size={14} /> + Fijo
                      </button>
                      <button 
                        onClick={() => abrirModalEmpleado(sucursal.id, 'Apoyo')}
                        className="text-xs flex items-center gap-1 bg-white border border-orange-200 text-orange-600 px-3 py-1 rounded-md hover:bg-orange-500 hover:text-white transition-all shadow-sm font-medium"
                      >
                        <UserPlus size={14} /> + Apoyo
                      </button>
                    </div>
                  </td>
                  <td colSpan={8} className="bg-gray-50/30"></td>
                </tr>
                
                {sucursal.empleados.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-gray-400 italic bg-white border-b">
                      No hay programación para esta sede
                    </td>
                  </tr>
                )}

                {sucursal.empleados.map((empleado) => (
                  <tr key={empleado.id_programacion} className="group hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors">
                    <td className="p-2 border-r border-gray-100 sticky left-0 bg-white group-hover:bg-gray-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      <div className="flex flex-col px-2">
                        <span className="font-bold text-gray-700 uppercase text-sm">{empleado.nombre}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded w-fit mt-1
                          ${empleado.tipo === 'Fijo' ? 'bg-slate-100 text-slate-600' : 'bg-orange-100 text-orange-600'}`}>
                          {empleado.tipo}
                        </span>
                      </div>
                    </td>

                    {empleado.turnos.map((turno, tIndex) => (
                      <td key={tIndex} className="p-0 border-r border-gray-100 h-16 relative">
                        <textarea 
                          value={turno}
                          onChange={(e) => handleChange(sucursal.id, empleado.id_programacion, empleado.empleado_id, empleado.tipo, e.target.value, tIndex)}
                          className={`w-full h-full text-center text-xs font-semibold focus:outline-none focus:bg-indigo-50 transition-colors resize-none p-2 flex items-center justify-center
                            ${(turno === 'DESCANSO' || turno === 'DESC') ? 'text-red-500 bg-red-50/50' : 
                              turno.includes('AM') ? 'text-blue-600' : 
                              turno.includes('PM') ? 'text-purple-600' : 'text-gray-700'}
                          `}
                        />
                      </td>
                    ))}

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
               <button onClick={() => setModalSucursalAbierto(false)} className="flex-1 px-4 py-2 border rounded-lg">Cancelar</button>
               <button onClick={guardarNuevaSucursal} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {modalEmpleadoAbierto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
           <div className="bg-white rounded-xl shadow-2xl w-96 overflow-hidden p-6 space-y-4">
              <h3 className="font-bold text-lg text-indigo-700">Agregar {tipoSeleccionado}</h3>
              
              <div>
                  <label className="block text-xs font-bold mb-1 text-gray-500">Seleccionar Empleado</label>
                  <select 
                    className="w-full border p-2 rounded"
                    value={empleadoSeleccionadoId}
                    onChange={(e) => setEmpleadoSeleccionadoId(e.target.value)}
                  >
                      <option value="">-- Buscar --</option>
                      {listaEmpleadosBD.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.nombre_completo}</option>
                      ))}
                  </select>
              </div>

              <div className="flex gap-3 pt-2">
                 <button onClick={() => setModalEmpleadoAbierto(false)} className="flex-1 px-4 py-2 border rounded-lg">Cancelar</button>
                 <button onClick={confirmarAgregarEmpleado} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg">Agregar</button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default TablaTurnos;