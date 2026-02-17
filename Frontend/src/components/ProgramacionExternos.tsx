import { useState } from 'react';
import { Plus, Edit, Trash2, X, Calendar, Eye } from 'lucide-react';

// Definición completa con tus 22 columnas
interface TurnoExterno {
  id: number;
  // Empleado
  cc: string;
  nombre: string;
  estadoEmpleado: 'Activo' | 'Inactivo';
  idInterMen: string;
  
  // Ubicación
  idEmpresa: string;
  empresa: string;
  idSucursal: string;
  sucursal: string;
  asignacion: string;

  // Fecha y Tiempo
  idTurno: string;
  fecha: string;
  semana: number;
  dia: string;
  horaIni: string;
  horaFin: string;
  horasTotales: number;
  mes: string;
  anio: number;

  // Estado del Servicio
  estadoTurno: 'Programado' | 'Ejecutado' | 'Cancelado' | 'Novedad';
  estadoEjecucion: 'Cumplido' | 'Incumplido' | 'Pendiente';
  tipoTurno: string;
  franjaHoraria: 'Diurno' | 'Nocturno' | 'Mixto';
}

const ProgramacionExternos = () => {
  const [turnos, setTurnos] = useState<TurnoExterno[]>([
    {
      id: 1,
      cc: '10203040', nombre: 'PEREZ JUAN', estadoEmpleado: 'Activo', idInterMen: 'M-100',
      idEmpresa: 'E-01', empresa: 'MULTICARRIER', idSucursal: 'S-01', sucursal: 'CENTRO', asignacion: 'FIJA',
      idTurno: 'T-500', fecha: '2026-02-14', semana: 7, dia: 'Sábado',
      horaIni: '08:00', horaFin: '17:00', horasTotales: 9, mes: 'Febrero', anio: 2026,
      estadoTurno: 'Programado', estadoEjecucion: 'Pendiente', tipoTurno: 'Ordinario', franjaHoraria: 'Diurno'
    }
  ]);

  const [busqueda, setBusqueda] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [turnoEditando, setTurnoEditando] = useState<TurnoExterno | null>(null);

  const turnoVacio: TurnoExterno = {
    id: 0, cc: '', nombre: '', estadoEmpleado: 'Activo', idInterMen: '',
    idEmpresa: '', empresa: '', idSucursal: '', sucursal: '', asignacion: 'FIJA',
    idTurno: '', fecha: '', semana: 0, dia: '',
    horaIni: '', horaFin: '', horasTotales: 0, mes: '', anio: 2026,
    estadoTurno: 'Programado', estadoEjecucion: 'Pendiente', tipoTurno: 'Ordinario', franjaHoraria: 'Diurno'
  };

  const [formulario, setFormulario] = useState<TurnoExterno>(turnoVacio);

  // --- FUNCIONES ---
  const calcularFecha = (fechaStr: string) => {
    if (!fechaStr) return;
    const date = new Date(fechaStr);
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    const oneJan = new Date(date.getFullYear(), 0, 1);
    const numberOfDays = Math.floor((date.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
    const semana = Math.ceil((date.getDay() + 1 + numberOfDays) / 7);

    setFormulario(prev => ({
      ...prev,
      fecha: fechaStr,
      dia: dias[date.getDay()] || '',
      mes: meses[date.getMonth()] || '',
      anio: date.getFullYear(),
      semana: semana
    }));
  };

  const abrirModal = (turno?: TurnoExterno) => {
    if (turno) {
      setTurnoEditando(turno);
      setFormulario(turno);
    } else {
      setTurnoEditando(null);
      setFormulario(turnoVacio);
    }
    setModalAbierto(true);
  };

  const guardarTurno = () => {
    if (!formulario.nombre || !formulario.empresa || !formulario.fecha) return alert("Faltan datos obligatorios");
    
    if (turnoEditando) {
      setTurnos(turnos.map(t => t.id === turnoEditando.id ? formulario : t));
    } else {
      setTurnos([...turnos, { ...formulario, id: Date.now() }]);
    }
    setModalAbierto(false);
  };

  return (
    <div className="space-y-6 p-1">
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Programación Externos</h2>
          <p className="text-sm text-gray-500">Gestión detallada de turnos y ejecución</p>
        </div>
        <div className="flex gap-3">
          <input 
            type="text" 
            placeholder="Buscar por nombre, empresa..." 
            className="pl-4 pr-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <button onClick={() => abrirModal()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium">
            <Plus size={18} /> Crear Turno
          </button>
        </div>
      </div>

      {/* Tabla con Scroll Horizontal */}
      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-gray-800 text-white uppercase text-xs">
              <tr>
                <th className="p-3 sticky left-0 bg-gray-800 z-10">Nombre / CC</th>
                <th className="p-3">Empresa / Sucursal</th>
                <th className="p-3 text-center">Fecha</th>
                <th className="p-3 text-center">Horario</th>
                <th className="p-3 text-center">Estado</th>
                <th className="p-3 text-center">Ejecución</th>
                <th className="p-3 text-center">Detalles</th>
                <th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {turnos.filter(t => t.nombre.toLowerCase().includes(busqueda.toLowerCase())).map((turno) => (
                <tr key={turno.id} className="hover:bg-blue-50 transition-colors">
                  <td className="p-3 sticky left-0 bg-white group-hover:bg-blue-50 border-r border-gray-100">
                    <div className="font-bold text-gray-800">{turno.nombre}</div>
                    <div className="text-xs text-gray-500">CC: {turno.cc}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-blue-700">{turno.empresa}</div>
                    <div className="text-xs text-gray-500">{turno.sucursal}</div>
                  </td>
                  <td className="p-3 text-center">
                    <div className="font-bold">{turno.fecha}</div>
                    <div className="text-xs text-gray-500">{turno.dia}</div>
                  </td>
                  <td className="p-3 text-center">
                    <span className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                      {turno.horaIni} - {turno.horaFin}
                    </span>
                    <div className="text-[10px] text-gray-400 mt-1">{turno.horasTotales} Hrs</div>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${turno.estadoTurno === 'Programado' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                      {turno.estadoTurno}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span className="text-xs font-medium text-gray-600 border border-gray-200 px-2 py-1 rounded">
                      {turno.estadoEjecucion}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                     <div className="group relative inline-block">
                        <button className="text-gray-400 hover:text-blue-600"><Eye size={16}/></button>
                        <div className="hidden group-hover:block absolute right-0 z-50 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg text-left">
                           <p>ID Turno: {turno.idTurno}</p>
                           <p>ID InterMen: {turno.idInterMen}</p>
                           <p>Semana: {turno.semana}</p>
                           <p>Mes: {turno.mes}</p>
                        </div>
                     </div>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => abrirModal(turno)} className="text-blue-600 hover:bg-blue-100 p-1.5 rounded"><Edit size={16}/></button>
                      <button className="text-red-500 hover:bg-red-100 p-1.5 rounded"><Trash2 size={16}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE EDICIÓN */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] overflow-y-auto animate-in zoom-in duration-200">
            <div className="bg-gray-900 p-4 flex justify-between items-center text-white sticky top-0 z-10">
              <h3 className="font-bold text-lg flex items-center gap-2"><Calendar size={20}/> Gestión de Turno</h3>
              <button onClick={() => setModalAbierto(false)}><X size={24}/></button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Sección 1: Empleado */}
              <div className="md:col-span-3 pb-2 border-b border-gray-100 font-bold text-gray-400 uppercase text-xs tracking-wider">Datos del Empleado</div>
              <div>
                <label className="block text-xs font-bold text-gray-700">Nombre</label>
                <input type="text" className="w-full border p-2 rounded" value={formulario.nombre} onChange={e => setFormulario({...formulario, nombre: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700">Cédula (CC)</label>
                <input type="text" className="w-full border p-2 rounded" value={formulario.cc} onChange={e => setFormulario({...formulario, cc: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700">ID InterMen</label>
                <input type="text" className="w-full border p-2 rounded bg-gray-50" value={formulario.idInterMen} onChange={e => setFormulario({...formulario, idInterMen: e.target.value})} />
              </div>

              {/* Sección 2: Ubicación */}
              <div className="md:col-span-3 pb-2 border-b border-gray-100 font-bold text-gray-400 uppercase text-xs tracking-wider mt-2">Ubicación y Asignación</div>
              <div>
                <label className="block text-xs font-bold text-gray-700">Empresa</label>
                <input type="text" className="w-full border p-2 rounded" value={formulario.empresa} onChange={e => setFormulario({...formulario, empresa: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700">Sucursal</label>
                <input type="text" className="w-full border p-2 rounded" value={formulario.sucursal} onChange={e => setFormulario({...formulario, sucursal: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700">Asignación</label>
                <select className="w-full border p-2 rounded" value={formulario.asignacion} onChange={e => setFormulario({...formulario, asignacion: e.target.value})}>
                  <option>Fija</option>
                  <option>Relevo</option>
                  <option>Apoyo</option>
                </select>
              </div>

              {/* Sección 3: Tiempo */}
              <div className="md:col-span-3 pb-2 border-b border-gray-100 font-bold text-gray-400 uppercase text-xs tracking-wider mt-2">Programación Temporal</div>
              <div>
                <label className="block text-xs font-bold text-gray-700">Fecha</label>
                <input type="date" className="w-full border p-2 rounded border-blue-300" value={formulario.fecha} onChange={e => calcularFecha(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                 <div>
                    <label className="block text-xs font-bold text-gray-500">Día</label>
                    <input type="text" readOnly className="w-full bg-gray-100 p-2 rounded text-xs" value={formulario.dia} />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500">Semana</label>
                    <input type="text" readOnly className="w-full bg-gray-100 p-2 rounded text-xs" value={formulario.semana} />
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                 <div>
                    <label className="block text-xs font-bold text-gray-700">Hora Inicio</label>
                    <input type="time" className="w-full border p-2 rounded" value={formulario.horaIni} onChange={e => setFormulario({...formulario, horaIni: e.target.value})} />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-700">Hora Fin</label>
                    <input type="time" className="w-full border p-2 rounded" value={formulario.horaFin} onChange={e => setFormulario({...formulario, horaFin: e.target.value})} />
                 </div>
              </div>

              {/* Sección 4: Estados */}
              <div className="md:col-span-3 pb-2 border-b border-gray-100 font-bold text-gray-400 uppercase text-xs tracking-wider mt-2">Estado y Control</div>
              <div>
                 <label className="block text-xs font-bold text-gray-700">Estado Turno</label>
                 <select 
                    className="w-full border p-2 rounded bg-blue-50" 
                    value={formulario.estadoTurno} 
                    onChange={e => setFormulario({...formulario, estadoTurno: e.target.value as TurnoExterno['estadoTurno']})}
                  >
                   <option value="Programado">Programado</option>
                   <option value="Ejecutado">Ejecutado</option>
                   <option value="Cancelado">Cancelado</option>
                   <option value="Novedad">Novedad</option>
                 </select>
              </div>
              <div>
                 <label className="block text-xs font-bold text-gray-700">Estado Ejecución</label>
                 <select 
                    className="w-full border p-2 rounded" 
                    value={formulario.estadoEjecucion} 
                    onChange={e => setFormulario({...formulario, estadoEjecucion: e.target.value as TurnoExterno['estadoEjecucion']})}
                  >
                   <option value="Pendiente">Pendiente</option>
                   <option value="Cumplido">Cumplido</option>
                   <option value="Incumplido">Incumplido</option>
                 </select>
              </div>
              <div>
                 <label className="block text-xs font-bold text-gray-700">Tipo Turno</label>
                 <input type="text" className="w-full border p-2 rounded" value={formulario.tipoTurno} onChange={e => setFormulario({...formulario, tipoTurno: e.target.value})} />
              </div>

            </div>

            <div className="p-4 bg-gray-50 border-t flex justify-end gap-3 sticky bottom-0">
               <button onClick={() => setModalAbierto(false)} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded">Cancelar</button>
               <button onClick={guardarTurno} className="px-6 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 shadow-lg">Guardar Turno</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgramacionExternos;