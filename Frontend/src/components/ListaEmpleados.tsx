import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Edit, Trash2, X, Check } from 'lucide-react';

interface Empleado {
  id: number;
  nombre: string;
  documento: string;
  cargo: string;
  celular: string;
  idInterwap: string;
  estado: 'Activo' | 'Inactivo';
}

const ListaEmpleados = () => {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);

  // Formulario vacío
  const empleadoVacio: Empleado = {
    id: 0, nombre: '', documento: '', cargo: 'Domi TC',
    celular: '', idInterwap: '', estado: 'Activo'
  };

  const [formulario, setFormulario] = useState<Empleado>(empleadoVacio);

  // --- 1. CARGAR DATOS DESDE BD ---
  const cargarEmpleados = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3001/empleados');
      const data = await res.json();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const empleadosFormateados = data.map((e: any) => ({
        id: e.id,
        nombre: e.nombre_completo,
        documento: e.documento,
        celular: e.celular,
        cargo: e.cargo,
        idInterwap: e.id_interwap,
        estado: e.estado
      }));
      setEmpleados(empleadosFormateados);
    } catch (error) {
      console.error("Error cargando empleados:", error);
    }
  }, []);

  useEffect(() => {
    cargarEmpleados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- 2. GUARDAR EN BD ---
  const guardarEmpleado = async () => {
    if (!formulario.nombre || !formulario.documento) return alert("Nombre y Documento son obligatorios");

    try {
      const response = await fetch('http://localhost:3001/empleados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formulario)
      });

      if (response.ok) {
        alert("Empleado guardado exitosamente");
        setModalAbierto(false);
        cargarEmpleados(); // Recargar lista
      } else {
        alert("Error al guardar. Verifica que la cédula no esté repetida.");
      }
    } catch (error) {
      console.error(error);
      alert("Error de conexión");
    }
  };

  // --- FILTROS ---
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
            <input 
              type="text" 
              placeholder="Buscar por nombre o CC..." 
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button 
            onClick={() => { setFormulario(empleadoVacio); setModalAbierto(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
          >
            <Plus size={18} /> Nuevo
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto bg-white rounded-xl shadow border border-gray-200">
        <table className="w-full text-sm text-left">
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
            {empleadosFiltrados.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-400">No hay empleados registrados.</td>
              </tr>
            )}
            {empleadosFiltrados.map((emp) => (
              <tr key={emp.id} className="hover:bg-blue-50 border-b last:border-0 transition-colors">
                <td className="p-4 font-bold text-gray-800">{emp.nombre}</td>
                <td className="p-4 text-gray-600 font-mono">{emp.documento}</td>
                <td className="p-4 text-gray-600">{emp.cargo}</td>
                <td className="p-4 text-gray-600">{emp.celular || '-'}</td>
                <td className="p-4 text-blue-600 font-mono font-bold bg-blue-50 rounded w-fit">{emp.idInterwap}</td>
                <td className="p-4 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${emp.estado === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {emp.estado}
                  </span>
                </td>
                <td className="p-4 flex justify-center gap-2">
                  <button className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"><Edit size={16} /></button>
                  <button className="p-1.5 text-red-500 hover:bg-red-100 rounded-md transition-colors"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-gray-800 p-4 flex justify-between items-center text-white">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Plus size={20}/> Nuevo Empleado
              </h3>
              <button onClick={() => setModalAbierto(false)} className="hover:text-gray-300"><X size={24} /></button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre Completo</label>
                <input 
                  type="text" 
                  className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                  value={formulario.nombre}
                  onChange={(e) => setFormulario({...formulario, nombre: e.target.value.toUpperCase()})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Documento (CC)</label>
                <input 
                  type="number" 
                  className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formulario.documento}
                  onChange={(e) => setFormulario({...formulario, documento: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Celular</label>
                <input 
                  type="tel" 
                  className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formulario.celular}
                  onChange={(e) => setFormulario({...formulario, celular: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cargo</label>
                <select 
                  className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formulario.cargo}
                  onChange={(e) => setFormulario({...formulario, cargo: e.target.value})}
                >
                  <option value="Domi TC">Domi TC</option>
                  <option value="Domi PPY">Domi PPY</option>
                  <option value="Domi FDS">Domi FDS</option>
                  <option value="Administrativo">Administrativo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">ID Interwap</label>
                <input 
                  type="text" 
                  className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formulario.idInterwap}
                  onChange={(e) => setFormulario({...formulario, idInterwap: e.target.value})}
                />
              </div>
            </div>

            <div className="bg-gray-50 p-4 flex justify-end gap-3 border-t">
              <button onClick={() => setModalAbierto(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded">Cancelar</button>
              <button onClick={guardarEmpleado} className="px-6 py-2 bg-blue-600 text-white rounded font-medium flex items-center gap-2 hover:bg-blue-700">
                <Check size={18} /> Guardar Datos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListaEmpleados;