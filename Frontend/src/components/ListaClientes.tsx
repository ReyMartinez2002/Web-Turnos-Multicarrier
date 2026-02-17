import { useState } from 'react';
import { Search, Plus, Edit, Trash2, X, Check, Building, MapPin } from 'lucide-react';

interface Cliente {
  id: number;
  empresa: string;
  sucursal: string;
  idCliente: string;
  idInterwap: string;
  direccion: string;
}

const ListaClientes = () => {
  const [clientes, setClientes] = useState<Cliente[]>([
    { id: 1, empresa: 'PAN PA YA', sucursal: 'SALITRE', idCliente: 'PPY-001', idInterwap: '996', direccion: 'Calle 26 # 68-10' },
    { id: 2, empresa: 'PAN PA YA', sucursal: 'CHAPINERO', idCliente: 'PPY-002', idInterwap: '1003', direccion: 'Cra 7 # 60-15' },
    { id: 3, empresa: 'MULTICARRIER', sucursal: 'CENTRO', idCliente: 'MC-050', idInterwap: '885', direccion: 'Av Jimenez # 4-50' },
  ]);

  const [busqueda, setBusqueda] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);

  const clienteVacio: Cliente = {
    id: 0, empresa: '', sucursal: '', idCliente: '', idInterwap: '', direccion: ''
  };

  const [formulario, setFormulario] = useState<Cliente>(clienteVacio);

  // --- FUNCIONES ---
  const abrirModalCrear = () => {
    setClienteEditando(null);
    setFormulario(clienteVacio);
    setModalAbierto(true);
  };

  const abrirModalEditar = (cliente: Cliente) => {
    setClienteEditando(cliente);
    setFormulario(cliente);
    setModalAbierto(true);
  };

  const guardarCliente = () => {
    if (!formulario.empresa || !formulario.sucursal) return alert("Empresa y Sucursal son obligatorios");

    if (clienteEditando) {
      setClientes(clientes.map(c => c.id === clienteEditando.id ? formulario : c));
    } else {
      setClientes([...clientes, { ...formulario, id: Date.now() }]);
    }
    setModalAbierto(false);
  };

  const eliminarCliente = (id: number) => {
    if (window.confirm('¿Eliminar este registro?')) {
      setClientes(clientes.filter(c => c.id !== id));
    }
  };

  const clientesFiltrados = clientes.filter(c => 
    c.empresa.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.sucursal.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.idInterwap.includes(busqueda)
  );

  return (
    <div className="space-y-6 p-1">
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Clientes Externos</h2>
          <p className="text-sm text-gray-500">Gestión de sucursales y códigos Interwap</p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar..." 
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <button 
            onClick={abrirModalCrear}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium whitespace-nowrap"
          >
            <Plus size={18} /> Nuevo Registro
          </button>
        </div>
      </div>

      {/* Tabla Corregida */}
      <div className="overflow-x-auto bg-white rounded-xl shadow border border-gray-200">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-gray-50 text-gray-700 font-bold uppercase text-xs">
            <tr>
              <th className="p-3 border-b border-gray-200">Empresa</th>
              <th className="p-3 border-b border-gray-200">Sucursal</th>
              <th className="p-3 border-b border-gray-200">ID Cliente</th>
              <th className="p-3 border-b border-gray-200">ID Interwap</th>
              <th className="p-3 border-b border-gray-200">Dirección</th>
              <th className="p-3 border-b border-gray-200 text-center w-24">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {clientesFiltrados.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-400">No hay registros encontrados.</td>
              </tr>
            )}
            {clientesFiltrados.map((cliente) => (
              <tr key={cliente.id} className="hover:bg-indigo-50/50 transition-colors">
                
                {/* Empresa */}
                <td className="p-3 align-middle">
                  <div className="font-bold text-gray-800 flex items-center gap-2">
                    <div className="p-1.5 bg-gray-100 rounded text-gray-500">
                      <Building size={14}/>
                    </div>
                    {cliente.empresa}
                  </div>
                </td>

                {/* Sucursal */}
                <td className="p-3 align-middle text-gray-700 font-medium">
                  {cliente.sucursal}
                </td>

                {/* ID Cliente */}
                <td className="p-3 align-middle text-gray-500 font-mono text-xs">
                  {cliente.idCliente || '-'}
                </td>

                {/* ID Interwap */}
                <td className="p-3 align-middle">
                  <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded text-xs">
                    {cliente.idInterwap}
                  </span>
                </td>

                {/* Dirección */}
                <td className="p-3 align-middle text-gray-500 text-xs">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={12} className="text-gray-400 shrink-0"/> 
                    <span className="truncate max-w-[200px]" title={cliente.direccion}>
                      {cliente.direccion}
                    </span>
                  </div>
                </td>

                {/* Acciones */}
                <td className="p-3 align-middle text-center">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => abrirModalEditar(cliente)} className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-md transition-colors" title="Editar">
                      <Edit size={16} />
                    </button>
                    <button onClick={() => eliminarCliente(cliente.id)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-md transition-colors" title="Eliminar">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal - Mismo código de antes */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all scale-100">
            <div className="bg-indigo-900 p-4 flex justify-between items-center text-white">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Building size={20}/>
                {clienteEditando ? 'Editar Registro' : 'Nuevo Registro'}
              </h3>
              <button onClick={() => setModalAbierto(false)} className="hover:text-gray-300">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Empresa</label>
                <input 
                  autoFocus
                  type="text" 
                  className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none uppercase font-bold"
                  value={formulario.empresa}
                  onChange={(e) => setFormulario({...formulario, empresa: e.target.value.toUpperCase()})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sucursal</label>
                <input 
                  type="text" 
                  className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                  value={formulario.sucursal}
                  onChange={(e) => setFormulario({...formulario, sucursal: e.target.value.toUpperCase()})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">ID Cliente</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={formulario.idCliente}
                    onChange={(e) => setFormulario({...formulario, idCliente: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">ID INTERWAP</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-indigo-700"
                    value={formulario.idInterwap}
                    onChange={(e) => setFormulario({...formulario, idInterwap: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Dirección</label>
                <input 
                  type="text" 
                  className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formulario.direccion}
                  onChange={(e) => setFormulario({...formulario, direccion: e.target.value})}
                />
              </div>
            </div>

            <div className="bg-gray-50 p-4 flex justify-end gap-3 border-t">
              <button onClick={() => setModalAbierto(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded font-medium">Cancelar</button>
              <button onClick={guardarCliente} className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium flex items-center gap-2"><Check size={18} /> Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListaClientes;