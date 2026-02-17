import { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, X, Check, User, Phone, Briefcase, Settings, Save } from 'lucide-react';

interface Empleado {
  id: number;
  nombre: string;
  documento: string;
  cargo: string;
  celular: string;
  idInterwap: string;
  estado: 'Activo' | 'Inactivo';
}

interface CargoMaestro {
  id: number;
  nombre: string;
}

const ListaEmpleados = () => {
  // Datos
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [cargosDisponibles, setCargosDisponibles] = useState<CargoMaestro[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [recargar, setRecargar] = useState(0); // Para forzar actualización

  // Modales
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalConfigCargos, setModalConfigCargos] = useState(false);

  // Formularios
  const empleadoVacio: Empleado = { id: 0, nombre: '', documento: '', cargo: '', celular: '', idInterwap: '', estado: 'Activo' };
  const [formulario, setFormulario] = useState<Empleado>(empleadoVacio);
  const [isEditing, setIsEditing] = useState(false);
  const [nuevoCargoNombre, setNuevoCargoNombre] = useState('');

  // --- EFECTO DE CARGA ---
  useEffect(() => {
    let isMounted = true;
    const cargarDatos = async () => {
      try {
        const [resEmp, resCargos] = await Promise.all([
          fetch('http://localhost:3001/empleados'),
          fetch('http://localhost:3001/cargos-lista')
        ]);
        const dataEmp = await resEmp.json();
        const dataCargos = await resCargos.json();

        if (isMounted) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setEmpleados(dataEmp.map((e: any) => ({
                id: e.id,
                nombre: e.nombre_completo,
                documento: e.documento,
                celular: e.celular,
                cargo: e.cargo,
                idInterwap: e.id_interwap,
                estado: e.estado || 'Activo'
            })));
            setCargosDisponibles(dataCargos);
        }
      } catch (error) { console.error(error); }
    };
    cargarDatos();
    return () => { isMounted = false; };
  }, [recargar]);

  const actualizarVista = () => setRecargar(prev => prev + 1);

  // --- ABRIR MODALES ---
  const abrirCrear = () => {
      setFormulario(empleadoVacio);
      setIsEditing(false);
      setModalAbierto(true);
  };

  const abrirEditar = (emp: Empleado) => {
      setFormulario(emp);
      setIsEditing(true);
      setModalAbierto(true);
  };

  // --- GUARDAR EMPLEADO ---
  const guardarEmpleado = async () => {
    if (!formulario.nombre || !formulario.documento || !formulario.cargo) return alert("Nombre, Documento y Cargo son obligatorios");

    try {
      const url = isEditing 
        ? `http://localhost:3001/empleados/${formulario.id}`
        : 'http://localhost:3001/empleados';
      
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formulario)
      });

      if (response.ok) {
        alert(isEditing ? "Empleado actualizado" : "Empleado creado");
        setModalAbierto(false);
        actualizarVista();
      } else {
        alert("Error al guardar (revise si la cédula ya existe)");
      }
    } catch (error) { console.error(error); }
  };

  // --- ELIMINAR EMPLEADO ---
  const eliminarEmpleado = async (id: number, nombre: string) => {
      if (!confirm(`¿Eliminar a "${nombre}"?\n\nSi tiene turnos históricos, no se borrará (debes inactivarlo).`)) return;

      try {
          const res = await fetch(`http://localhost:3001/empleados/${id}`, { method: 'DELETE' });
          const data = await res.json();

          if (res.ok) {
              alert("Empleado eliminado definitivamente");
              actualizarVista();
          } else {
              alert(`⚠️ ${data.error}`);
          }
      } catch (error) { console.error(error); }
  };

  // --- GESTIÓN DE CARGOS ---
  const agregarCargoLista = async () => {
      if (!nuevoCargoNombre.trim()) return;
      try {
          const res = await fetch('http://localhost:3001/cargos-lista', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nombre: nuevoCargoNombre })
          });
          if (res.ok) {
              setNuevoCargoNombre('');
              actualizarVista();
          }
      } catch (error) { console.error(error); }
  };

  const eliminarCargoLista = async (id: number) => {
      if(!confirm("¿Borrar cargo?")) return;
      await fetch(`http://localhost:3001/cargos-lista/${id}`, { method: 'DELETE' });
      actualizarVista();
  };

  const empleadosFiltrados = empleados.filter(emp => 
    emp.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    emp.documento.includes(busqueda)
  );

  return (
    <div className="space-y-6 p-1">
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Base de Personal (BD)</h2>
          <p className="text-sm text-gray-500">Gestión centralizada de empleados</p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input type="text" placeholder="Buscar por nombre o CC..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
          <button onClick={abrirCrear} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap">
            <Plus size={18} /> Nuevo
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto bg-white rounded-xl shadow border border-gray-200">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-gray-50 text-gray-700 font-bold uppercase text-xs">
            <tr>
              <th className="p-4 border-b">Nombre</th>
              <th className="p-4 border-b">Documento (CC)</th>
              <th className="p-4 border-b">Cargo</th>
              <th className="p-4 border-b">Celular</th>
              <th className="p-4 border-b">ID Interwap</th>
              <th className="p-4 border-b text-center">Estado</th>
              <th className="p-4 border-b text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {empleadosFiltrados.length === 0 && (<tr><td colSpan={7} className="p-8 text-center text-gray-400">No hay empleados registrados.</td></tr>)}
            {empleadosFiltrados.map((emp) => (
              <tr key={emp.id} className={`border-b last:border-0 transition-colors ${emp.estado === 'Inactivo' ? 'bg-gray-50 opacity-60' : 'hover:bg-blue-50'}`}>
                <td className="p-4 font-bold text-gray-800 flex items-center gap-2"><User size={16} className="text-gray-400"/> {emp.nombre}</td>
                <td className="p-4 text-gray-600 font-mono">{emp.documento}</td>
                <td className="p-4 text-gray-600"><span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-bold uppercase">{emp.cargo}</span></td>
                <td className="p-4 text-gray-600 flex items-center gap-1"><Phone size={12}/>{emp.celular || '-'}</td>
                <td className="p-4 text-blue-600 font-mono font-bold">{emp.idInterwap}</td>
                <td className="p-4 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${emp.estado === 'Activo' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-500 border border-red-200'}`}>
                    {emp.estado}
                  </span>
                </td>
                <td className="p-4 text-center">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => abrirEditar(emp)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"><Edit size={16} /></button>
                    <button onClick={() => eliminarEmpleado(emp.id, emp.nombre)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-md transition-colors"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL CREAR/EDITAR */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-gray-800 p-4 flex justify-between items-center text-white">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <User size={20}/> {isEditing ? 'Editar Empleado' : 'Nuevo Empleado'}
              </h3>
              <button onClick={() => setModalAbierto(false)} className="hover:text-gray-300"><X size={24} /></button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre Completo</label>
                <input type="text" className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none uppercase font-bold" value={formulario.nombre} onChange={(e) => setFormulario({...formulario, nombre: e.target.value.toUpperCase()})} />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Documento (CC)</label>
                <input type="number" className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={formulario.documento} onChange={(e) => setFormulario({...formulario, documento: e.target.value})} />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Celular</label>
                <input type="tel" className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={formulario.celular} onChange={(e) => setFormulario({...formulario, celular: e.target.value})} />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Cargo</label>
                    <button onClick={() => setModalConfigCargos(true)} className="text-[10px] text-blue-600 flex items-center gap-1 hover:underline"><Settings size={12}/> Gestionar Lista</button>
                </div>
                <select className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={formulario.cargo} onChange={(e) => setFormulario({...formulario, cargo: e.target.value})}>
                  <option value="">-- SELECCIONAR --</option>
                  {cargosDisponibles.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Estado</label>
                <select className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={formulario.estado} onChange={(e) => setFormulario({...formulario, estado: e.target.value as 'Activo' | 'Inactivo'})}>
                  <option value="Activo">Activo (Disponible)</option>
                  <option value="Inactivo">Inactivo (No programable)</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">ID Interwap</label>
                <input type="text" className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-600" value={formulario.idInterwap} onChange={(e) => setFormulario({...formulario, idInterwap: e.target.value})} />
              </div>
            </div>

            <div className="bg-gray-50 p-4 flex justify-end gap-3 border-t">
              <button onClick={() => setModalAbierto(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded">Cancelar</button>
              <button onClick={guardarEmpleado} className="px-6 py-2 bg-blue-600 text-white rounded font-medium flex items-center gap-2 hover:bg-blue-700">
                <Check size={18} /> {isEditing ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GESTIONAR CARGOS */}
      {modalConfigCargos && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-gray-800 p-3 flex justify-between items-center text-white">
                    <h3 className="font-bold text-sm flex items-center gap-2"><Briefcase size={16}/> Gestionar Cargos</h3>
                    <button onClick={() => setModalConfigCargos(false)}><X size={18}/></button>
                </div>
                <div className="p-4 space-y-4">
                    <div className="flex gap-2">
                        <input autoFocus type="text" placeholder="Nuevo Cargo..." className="flex-1 border p-2 rounded text-sm uppercase outline-none focus:border-blue-500" value={nuevoCargoNombre} onChange={(e) => setNuevoCargoNombre(e.target.value.toUpperCase())} />
                        <button onClick={agregarCargoLista} className="bg-green-600 text-white p-2 rounded hover:bg-green-700"><Save size={18} /></button>
                    </div>
                    <div className="max-h-60 overflow-y-auto border rounded divide-y">
                        {cargosDisponibles.map(c => (
                            <div key={c.id} className="p-2 text-sm flex justify-between items-center hover:bg-gray-50">
                                <span className="font-medium text-gray-700">{c.nombre}</span>
                                <button onClick={() => eliminarCargoLista(c.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default ListaEmpleados;