import React, { useState } from 'react';
import { UserPlus, Building2, Trash2, X, Check, UserCheck } from 'lucide-react';

interface Empleado {
  id: number;
  nombre: string;
  tipo: 'Fijo' | 'Apoyo';
  turnos: string[];
}

interface Sucursal {
  id: number;
  nombre: string;
  empleados: Empleado[];
}

const TablaTurnos = () => {
  const diasSemana = [
    { fecha: '14 Feb', dia: 'Sábado' },
    { fecha: '15 Feb', dia: 'Domingo' },
    { fecha: '16 Feb', dia: 'Lunes' },
    { fecha: '17 Feb', dia: 'Martes' },
    { fecha: '18 Feb', dia: 'Miércoles' },
    { fecha: '19 Feb', dia: 'Jueves' },
    { fecha: '20 Feb', dia: 'Viernes' },
  ];

  // Estado principal de los datos
  const [sucursales, setSucursales] = useState<Sucursal[]>([
    {
      id: 1,
      nombre: 'SALITRE',
      empleados: [
        { id: 101, nombre: 'HERNANDEZ GONZALO', tipo: 'Fijo', turnos: ['AM', 'AM', 'AM', 'DESCANSO', 'AM Y PM', '11 A 3PM', 'AM'] },
        { id: 102, nombre: 'CESPEDES BONILLA', tipo: 'Fijo', turnos: ['PM', 'PM', 'PM', 'AM Y PM', '11 A 3PM', 'DESCANSO', 'PM'] },
      ]
    },
    {
      id: 2,
      nombre: 'SARMIENTO',
      empleados: [
        { id: 201, nombre: 'BAQUERO ROJAS', tipo: 'Fijo', turnos: ['AM', 'AM', 'AM', 'AM', 'AM Y PM', 'DESCANSO', 'AM'] },
      ]
    }
  ]);

  // Estado para controlar el Modal
  const [modalAbierto, setModalAbierto] = useState(false);
  const [nuevaSucursalNombre, setNuevaSucursalNombre] = useState('');

  // --- FUNCIONES ---

  // Función genérica para agregar empleado (Fijo o Apoyo)
  const agregarEmpleado = (sucursalId: number, tipo: 'Fijo' | 'Apoyo') => {
    // Si es Fijo, pedimos el nombre de una vez para que quede formal
    let nombreInicial = 'NUEVO ' + tipo.toUpperCase();
    if (tipo === 'Fijo') {
      const nombreInput = prompt("Nombre del nuevo empleado Fijo:");
      if (!nombreInput) return; // Si cancela, no hacemos nada
      nombreInicial = nombreInput.toUpperCase();
    }

    const nuevasSucursales = sucursales.map(suc => {
      if (suc.id === sucursalId) {
        return {
          ...suc,
          empleados: [
            ...suc.empleados,
            {
              id: Date.now(),
              nombre: nombreInicial,
              tipo: tipo,
              turnos: Array(7).fill('')
            }
          ]
        };
      }
      return suc;
    });
    setSucursales(nuevasSucursales);
  };

  const eliminarEmpleado = (sucursalId: number, empleadoId: number) => {
    if(!window.confirm("¿Seguro que quieres eliminar a este empleado?")) return;

    const nuevasSucursales = sucursales.map(suc => {
      if (suc.id !== sucursalId) return suc;
      return {
        ...suc,
        empleados: suc.empleados.filter(emp => emp.id !== empleadoId)
      };
    });
    setSucursales(nuevasSucursales);
  };

  const guardarNuevaSucursal = () => {
    if (!nuevaSucursalNombre.trim()) return;
    
    setSucursales([
      ...sucursales,
      {
        id: Date.now(),
        nombre: nuevaSucursalNombre.toUpperCase(),
        empleados: []
      }
    ]);
    setNuevaSucursalNombre('');
    setModalAbierto(false);
  };

  const handleChange = (sucursalId: number, empId: number, campo: string, valor: string, indexTurno?: number) => {
    const nuevasSucursales = sucursales.map(suc => {
      if (suc.id !== sucursalId) return suc;
      const nuevosEmpleados = suc.empleados.map(emp => {
        if (emp.id !== empId) return emp;
        if (campo === 'nombre') return { ...emp, nombre: valor };
        if (campo === 'turno' && indexTurno !== undefined) {
          const nuevosTurnos = [...emp.turnos];
          nuevosTurnos[indexTurno] = valor;
          return { ...emp, turnos: nuevosTurnos };
        }
        return emp;
      });
      return { ...suc, empleados: nuevosEmpleados };
    });
    setSucursales(nuevasSucursales);
  };

  return (
    <div className="space-y-6">
      {/* Cabecera Principal */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-gray-800 tracking-tight">Planificación Semanal</h2>
          <p className="text-sm text-gray-500">Gestión de turnos fijos y apoyos</p>
        </div>
        <button 
          onClick={() => setModalAbierto(true)}
          className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-all shadow-md hover:shadow-lg text-sm font-medium"
        >
          <Building2 size={18} />
          Nueva Sucursal
        </button>
      </div>

      {/* Tabla Principal */}
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
            {sucursales.map((sucursal) => (
              <React.Fragment key={sucursal.id}>
                {/* Encabezado de Sucursal */}
                <tr className="bg-gray-50 border-b border-gray-200">
                  <td className="p-3 bg-indigo-50/50 border-r border-indigo-100 font-bold text-indigo-900 flex justify-between items-center sticky left-0 z-10" colSpan={1}>
                    <span className="flex items-center gap-2 text-lg">
                      <Building2 size={20} className="text-indigo-600"/>
                      {sucursal.nombre}
                    </span>
                    <div className="flex gap-2">
                      {/* Botón Agregar Fijo */}
                      <button 
                        onClick={() => agregarEmpleado(sucursal.id, 'Fijo')}
                        className="text-xs flex items-center gap-1 bg-white border border-indigo-200 text-indigo-700 px-3 py-1 rounded-md hover:bg-indigo-600 hover:text-white transition-all shadow-sm font-medium"
                        title="Agregar empleado de planta"
                      >
                        <UserCheck size={14} />
                        + Fijo
                      </button>
                      {/* Botón Agregar Apoyo */}
                      <button 
                        onClick={() => agregarEmpleado(sucursal.id, 'Apoyo')}
                        className="text-xs flex items-center gap-1 bg-white border border-orange-200 text-orange-600 px-3 py-1 rounded-md hover:bg-orange-500 hover:text-white transition-all shadow-sm font-medium"
                        title="Agregar personal temporal"
                      >
                        <UserPlus size={14} />
                        + Apoyo
                      </button>
                    </div>
                  </td>
                  {/* Celdas vacías para completar la fila de encabezado */}
                  <td colSpan={8} className="bg-gray-50/30"></td>
                </tr>
                
                {/* Filas de Empleados */}
                {sucursal.empleados.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-gray-400 italic bg-white border-b">
                      No hay empleados asignados a esta sede. ¡Agrega uno!
                    </td>
                  </tr>
                )}

                {sucursal.empleados.map((empleado) => (
                  <tr key={empleado.id} className="group hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors">
                    {/* Celda Nombre y Tipo */}
                    <td className="p-2 border-r border-gray-100 sticky left-0 bg-white group-hover:bg-gray-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      <div className="flex flex-col px-2">
                        <input 
                          type="text"
                          value={empleado.nombre}
                          onChange={(e) => handleChange(sucursal.id, empleado.id, 'nombre', e.target.value)}
                          className="font-bold text-gray-700 bg-transparent border-b border-transparent focus:border-indigo-500 focus:ring-0 p-1 w-full focus:outline-none transition-all uppercase text-sm"
                          placeholder="NOMBRE DEL EMPLEADO"
                        />
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded w-fit mt-1
                          ${empleado.tipo === 'Fijo' ? 'bg-slate-100 text-slate-600' : 'bg-orange-100 text-orange-600'}`}>
                          {empleado.tipo}
                        </span>
                      </div>
                    </td>

                    {/* Celdas Turnos */}
                    {empleado.turnos.map((turno, tIndex) => (
                      <td key={tIndex} className="p-0 border-r border-gray-100 h-16 relative">
                        <textarea 
                          value={turno}
                          onChange={(e) => handleChange(sucursal.id, empleado.id, 'turno', e.target.value, tIndex)}
                          className={`w-full h-full text-center text-xs font-semibold focus:outline-none focus:bg-indigo-50 transition-colors resize-none p-2 flex items-center justify-center
                            ${(turno === 'DESCANSO' || turno === 'DESC') ? 'text-red-500 bg-red-50/50' : 
                              turno.includes('AM') ? 'text-blue-600' : 
                              turno.includes('PM') ? 'text-purple-600' : 'text-gray-700'}
                          `}
                        />
                      </td>
                    ))}

                    {/* Celda Eliminar */}
                    <td className="p-0 text-center">
                      <button 
                        onClick={() => eliminarEmpleado(sucursal.id, empleado.id)}
                        className="text-gray-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                        title="Eliminar empleado"
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

      {/* MODAL para Nueva Sucursal */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-96 overflow-hidden transform transition-all scale-100 border border-gray-200">
            <div className="bg-slate-900 p-4 flex justify-between items-center">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Building2 size={20} className="text-indigo-400"/> Nueva Sucursal
              </h3>
              <button onClick={() => setModalAbierto(false)} className="text-white/70 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Sede</label>
                <input 
                  autoFocus
                  type="text" 
                  value={nuevaSucursalNombre}
                  onChange={(e) => setNuevaSucursalNombre(e.target.value)}
                  placeholder="Ej: CALLE 100"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && guardarNuevaSucursal()}
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setModalAbierto(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button 
                  onClick={guardarNuevaSucursal}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex justify-center items-center gap-2 shadow-lg shadow-indigo-200"
                >
                  <Check size={18} /> Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TablaTurnos;