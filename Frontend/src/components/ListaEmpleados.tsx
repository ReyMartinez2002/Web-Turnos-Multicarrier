import  { useState } from 'react';
import { Search, Plus, Edit, Trash2, X, Check } from 'lucide-react';

// Definición de tipos basada en tu Excel
interface Empleado {
  id: number;
  nombre: string;
  documento: string; // CC
  cargo: string;
  celular: string;
  sucursal: string;
  estado: 'Activo' | 'Inactivo';
  idInterwap: string;
}

const ListaEmpleados = () => {
  // Datos de prueba iniciales basados en tu imagen
  const [empleados, setEmpleados] = useState<Empleado[]>([
    { id: 1, nombre: 'SALCEDO ANTONIO', documento: '98355396', cargo: 'Domi TC', celular: '3001234567', sucursal: 'Domi PPY', estado: 'Activo', idInterwap: '996' },
    { id: 2, nombre: 'POSADA SEPULVEDA CARLOS', documento: '79284212', cargo: 'Domi TC', celular: '3109876543', sucursal: 'Domi TC', estado: 'Activo', idInterwap: '1003' },
    { id: 3, nombre: 'LOBO BUSTAMANTE ALBERTO', documento: '1004877336', cargo: 'Domi TC', celular: '3151112233', sucursal: 'Domi PPY', estado: 'Inactivo', idInterwap: '986' },
  ]);

  // Estados para filtros y modales
  const [busqueda, setBusqueda] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [empleadoEditando, setEmpleadoEditando] = useState<Empleado | null>(null);

  // Estado inicial para un empleado nuevo
  const empleadoVacio: Empleado = {
    id: 0,
    nombre: '',
    documento: '',
    cargo: 'Domi TC',
    celular: '',
    sucursal: 'Domi PPY',
    estado: 'Activo',
    idInterwap: ''
  };

  const [formulario, setFormulario] = useState<Empleado>(empleadoVacio);

  // --- FUNCIONES ---

  // Abrir modal para crear
  const abrirModalCrear = () => {
    setEmpleadoEditando(null);
    setFormulario(empleadoVacio);
    setModalAbierto(true);
  };

  // Abrir modal para editar
  const abrirModalEditar = (empleado: Empleado) => {
    setEmpleadoEditando(empleado);
    setFormulario(empleado);
    setModalAbierto(true);
  };

  // Guardar (Crear o Actualizar)
  const guardarEmpleado = () => {
    if (!formulario.nombre || !formulario.documento) return alert("Nombre y Documento son obligatorios");

    if (empleadoEditando) {
      // Actualizar existente
      setEmpleados(empleados.map(e => e.id === empleadoEditando.id ? formulario : e));
    } else {
      // Crear nuevo
      setEmpleados([...empleados, { ...formulario, id: Date.now() }]);
    }
    setModalAbierto(false);
  };

  // Eliminar
  const eliminarEmpleado = (id: number) => {
    if (window.confirm('¿Estás seguro de eliminar este empleado?')) {
      setEmpleados(empleados.filter(e => e.id !== id));
    }
  };

  // Filtrado de la tabla
  const empleadosFiltrados = empleados.filter(emp => 
    emp.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    emp.documento.includes(busqueda) ||
    emp.sucursal.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="space-y-6 p-1">
      {/* Cabecera y Buscador */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Base de Personal</h2>
          <p className="text-sm text-gray-500">Gestión de empleados y datos maestros</p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nombre, CC o sede..." 
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <button 
            onClick={abrirModalCrear}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
          >
            <Plus size={18} /> Nuevo
          </button>
        </div>
      </div>

      {/* Tabla de Empleados */}
      <div className="overflow-x-auto bg-white rounded-xl shadow border border-gray-200">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-700 font-bold uppercase text-xs">
            <tr>
              <th className="p-4 border-b">Nombre</th>
              <th className="p-4 border-b">Documento (CC)</th>
              <th className="p-4 border-b">Cargo</th>
              <th className="p-4 border-b">Celular</th>
              <th className="p-4 border-b">Sucursal</th>
              <th className="p-4 border-b">ID Interwap</th>
              <th className="p-4 border-b text-center">Estado</th>
              <th className="p-4 border-b text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {empleadosFiltrados.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-400">No se encontraron empleados.</td>
              </tr>
            )}
            {empleadosFiltrados.map((emp) => (
              <tr key={emp.id} className="hover:bg-blue-50 border-b last:border-0 transition-colors">
                <td className="p-4 font-medium text-gray-900">{emp.nombre}</td>
                <td className="p-4 text-gray-600 font-mono">{emp.documento}</td>
                <td className="p-4 text-gray-600">{emp.cargo}</td>
                <td className="p-4 text-gray-600">{emp.celular || '-'}</td>
                <td className="p-4 text-blue-600 font-semibold text-xs uppercase bg-blue-50/50 rounded">{emp.sucursal}</td>
                <td className="p-4 text-gray-500 text-center">{emp.idInterwap}</td>
                <td className="p-4 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${emp.estado === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {emp.estado}
                  </span>
                </td>
                <td className="p-4 flex justify-center gap-2">
                  <button onClick={() => abrirModalEditar(emp)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors" title="Editar">
                    <Edit size={16} />
                  </button>
                  <button onClick={() => eliminarEmpleado(emp.id)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-md transition-colors" title="Eliminar">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL (Formulario) */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header Modal */}
            <div className="bg-gray-800 p-4 flex justify-between items-center text-white">
              <h3 className="font-bold text-lg flex items-center gap-2">
                {empleadoEditando ? <Edit size={20}/> : <Plus size={20}/>}
                {empleadoEditando ? 'Editar Empleado' : 'Nuevo Empleado'}
              </h3>
              <button onClick={() => setModalAbierto(false)} className="hover:text-gray-300">
                <X size={24} />
              </button>
            </div>

            {/* Body Modal - Grid Form */}
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
                  <option value="Administrador">Administrador</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sucursal Asignada</label>
                <select 
                  className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formulario.sucursal}
                  onChange={(e) => setFormulario({...formulario, sucursal: e.target.value})}
                >
                  <option value="Domi PPY">Domi PPY (Pan Pa Ya)</option>
                  <option value="Domi TC">Domi TC (Multicarrier)</option>
                  <option value="Sin Asignar">Sin Asignar</option>
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

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Estado</label>
                <select 
                  className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formulario.estado}
                  onChange={(e) => setFormulario({...formulario, estado: e.target.value as 'Activo' | 'Inactivo'})}
                >
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="bg-gray-50 p-4 flex justify-end gap-3 border-t">
              <button 
                onClick={() => setModalAbierto(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded font-medium transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={guardarEmpleado}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium flex items-center gap-2 transition-colors"
              >
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