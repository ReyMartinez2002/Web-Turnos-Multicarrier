import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Search, Plus, Edit, Trash2, X, Check, Building, MapPin, Settings, Save, Upload } from 'lucide-react';

interface Cliente {
  id: number;
  empresa: string;
  sucursal: string;
  idCliente: string;
  idInterwap: string;
  direccion: string;
}

interface EmpresaMaestra {
  id: number;
  nombre: string;
}

// Tipos tal como vienen del backend
interface ClienteBD {
  id: number;
  empresa: string;
  sucursal: string;
  id_cliente_interno: string | null;
  id_interwap: string | null;
  direccion: string | null;
}

type ExcelRow = Record<string, unknown>;

const ListaClientes = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [empresasDisponibles, setEmpresasDisponibles] = useState<EmpresaMaestra[]>([]);
  const [busqueda, setBusqueda] = useState('');

  const [recargar, setRecargar] = useState(0);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalConfigEmpresas, setModalConfigEmpresas] = useState(false);

  const clienteVacio: Cliente = { id: 0, empresa: '', sucursal: '', idCliente: '', idInterwap: '', direccion: '' };
  const [formulario, setFormulario] = useState<Cliente>(clienteVacio);
  const [isEditing, setIsEditing] = useState(false);
  const [nuevaEmpresaNombre, setNuevaEmpresaNombre] = useState('');

  const [importando, setImportando] = useState(false);

  // --- EFECTO DE CARGA DE DATOS ---
  useEffect(() => {
    let isMounted = true;

    const cargarDatos = async () => {
      try {
        const [resClientes, resEmpresas] = await Promise.all([
          fetch('http://localhost:3001/clientes'),
          fetch('http://localhost:3001/empresas-lista'),
        ]);

        const dataClientes = (await resClientes.json()) as ClienteBD[];
        const dataEmpresas = (await resEmpresas.json()) as EmpresaMaestra[];

        if (!isMounted) return;

        setClientes(
          dataClientes.map((c) => ({
            id: c.id,
            empresa: c.empresa,
            sucursal: c.sucursal,
            idCliente: c.id_cliente_interno ?? '',
            idInterwap: c.id_interwap ?? '',
            direccion: c.direccion ?? '',
          }))
        );

        setEmpresasDisponibles(dataEmpresas);
      } catch (error) {
        console.error('Error cargando datos:', error);
      }
    };

    cargarDatos();
    return () => {
      isMounted = false;
    };
  }, [recargar]);

  const actualizarVista = () => setRecargar((prev) => prev + 1);

  // --- ABRIR MODAL PARA CREAR ---
  const abrirCrear = () => {
    setFormulario(clienteVacio);
    setIsEditing(false);
    setModalAbierto(true);
  };

  // --- ABRIR MODAL PARA EDITAR ---
  const abrirEditar = (cliente: Cliente) => {
    setFormulario(cliente);
    setIsEditing(true);
    setModalAbierto(true);
  };

  // --- GUARDAR (CREAR O EDITAR) ---
  const guardarCliente = async () => {
    if (!formulario.empresa || !formulario.sucursal) return alert('Empresa y Sucursal son obligatorios');

    try {
      const url = isEditing ? `http://localhost:3001/clientes/${formulario.id}` : 'http://localhost:3001/clientes';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formulario),
      });

      if (response.ok) {
        alert(isEditing ? 'Registro actualizado correctamente' : 'Registro creado correctamente');
        setModalAbierto(false);
        actualizarVista();
      } else {
        const data = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
        alert(data?.message || data?.error || 'Error al guardar');
      }
    } catch (error) {
      console.error(error);
    }
  };

  // --- ELIMINAR CLIENTE ---
  const eliminarCliente = async (id: number, nombreSucursal: string) => {
    if (!confirm(`¿Estás seguro de ELIMINAR la sede "${nombreSucursal}"?\n\nEsta acción no se puede deshacer.`)) return;

    try {
      const response = await fetch(`http://localhost:3001/clientes/${id}`, { method: 'DELETE' });
      const data = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;

      if (response.ok) {
        alert('Sede eliminada correctamente');
        actualizarVista();
      } else {
        alert(`⚠️ Error: ${data?.error || data?.message || 'No se pudo eliminar'}`);
      }
    } catch (error) {
      console.error(error);
      alert('Error de conexión');
    }
  };

  // --- GESTIÓN DE EMPRESAS MAESTRAS ---
  const agregarEmpresaLista = async () => {
    if (!nuevaEmpresaNombre.trim()) return;
    try {
      const res = await fetch('http://localhost:3001/empresas-lista', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nuevaEmpresaNombre }),
      });

      if (res.ok) {
        setNuevaEmpresaNombre('');
        actualizarVista();
      } else {
        alert('Error: Quizás ya existe esa empresa');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const eliminarEmpresaLista = async (id: number) => {
    if (!confirm('¿Borrar esta empresa de la lista?')) return;
    try {
      await fetch(`http://localhost:3001/empresas-lista/${id}`, { method: 'DELETE' });
      actualizarVista();
    } catch (error) {
      console.error(error);
    }
  };

  // --- IMPORTACIÓN EXCEL (crea sedes llamando POST /clientes por fila) ---
  const importarExcelClientes = async (file: File) => {
    setImportando(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, { defval: '' });

      // Encabezados recomendados:
      // EMPRESA | SUCURSAL | ID_CLIENTE | ID_INTERWAP | DIRECCION
      const registros = rows.map((r) => ({
        empresa: String(r.EMPRESA ?? r.empresa ?? r.Empresa ?? '').trim().toUpperCase(),
        sucursal: String(r.SUCURSAL ?? r.sucursal ?? r.Sucursal ?? '').trim().toUpperCase(),
        idCliente: String(r.ID_CLIENTE ?? r.idCliente ?? r.IDCLIENTE ?? r.id_cliente_interno ?? '').trim(),
        idInterwap: String(r.ID_INTERWAP ?? r.idInterwap ?? r.IDINTERWAP ?? r.id_interwap ?? '').trim(),
        direccion: String(r.DIRECCION ?? r.direccion ?? r.Dirección ?? '').trim(),
      }));

      // Filtra inválidos
      const validos = registros.filter((x) => x.empresa && x.sucursal);

      if (validos.length === 0) {
        alert('El archivo no tiene registros válidos. Requiere EMPRESA y SUCURSAL.');
        return;
      }

      // Crea en serie (más seguro). Si quieres más rápido, lo hacemos con Promise.all con límite.
      let creados = 0;
      let fallidos = 0;

      for (const item of validos) {
        try {
          const res = await fetch('http://localhost:3001/clientes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item),
          });
          if (res.ok) creados++;
          else fallidos++;
        } catch {
          fallidos++;
        }
      }

      alert(`Importación finalizada:\nVálidos: ${validos.length}\nCreados: ${creados}\nFallidos: ${fallidos}`);

      actualizarVista();
    } catch (e) {
      console.error(e);
      alert('Error leyendo el archivo Excel');
    } finally {
      setImportando(false);
    }
  };

  const clientesFiltrados = clientes.filter(
    (c) =>
      c.empresa.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.sucursal.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="space-y-6 p-1">
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Clientes Externos (BD)</h2>
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
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* IMPORTAR EXCEL */}
          <label
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium whitespace-nowrap cursor-pointer ${
              importando ? 'bg-emerald-400 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            <Upload size={18} /> {importando ? 'Importando...' : 'Importar Excel'}
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={importando}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importarExcelClientes(file);
                e.currentTarget.value = '';
              }}
            />
          </label>

          <button
            onClick={abrirCrear}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium whitespace-nowrap"
          >
            <Plus size={18} /> Nuevo Registro
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto bg-white rounded-xl shadow border border-gray-200">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-gray-50 text-gray-700 font-bold uppercase text-xs">
            <tr>
              <th className="p-3 border-b">Empresa</th>
              <th className="p-3 border-b">Sucursal</th>
              <th className="p-3 border-b">ID Cliente</th>
              <th className="p-3 border-b">ID Interwap</th>
              <th className="p-3 border-b">Dirección</th>
              <th className="p-3 border-b text-center w-24">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {clientesFiltrados.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-400">
                  No hay registros en BD.
                </td>
              </tr>
            )}
            {clientesFiltrados.map((cliente) => (
              <tr key={cliente.id} className="hover:bg-indigo-50/50 transition-colors">
                <td className="p-3 align-middle">
                  <div className="font-bold text-gray-800 flex items-center gap-2">
                    <Building size={14} className="text-gray-400" />
                    {cliente.empresa}
                  </div>
                </td>
                <td className="p-3 align-middle text-gray-700 font-medium">{cliente.sucursal}</td>
                <td className="p-3 align-middle text-gray-500 font-mono text-xs">{cliente.idCliente || '-'}</td>
                <td className="p-3 align-middle">
                  <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded text-xs">
                    {cliente.idInterwap}
                  </span>
                </td>
                <td className="p-3 align-middle text-gray-500 text-xs">
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={12} /> {cliente.direccion}
                  </span>
                </td>
                <td className="p-3 align-middle text-center">
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => abrirEditar(cliente)}
                      className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-md transition-colors"
                      title="Editar"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => eliminarCliente(cliente.id, cliente.sucursal)}
                      className="p-1.5 text-red-500 hover:bg-red-100 rounded-md transition-colors"
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

      {/* MODAL CREAR/EDITAR SUCURSAL */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-indigo-900 p-4 flex justify-between items-center text-white">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Building size={20} /> {isEditing ? 'Editar Sede' : 'Nuevo Registro'}
              </h3>
              <button onClick={() => setModalAbierto(false)} className="hover:text-gray-300">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 gap-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Empresa</label>
                  <button
                    onClick={() => setModalConfigEmpresas(true)}
                    className="text-[10px] text-indigo-600 flex items-center gap-1 hover:underline"
                  >
                    <Settings size={12} /> Gestionar Lista
                  </button>
                </div>
                <select
                  className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-gray-700"
                  value={formulario.empresa}
                  onChange={(e) => setFormulario({ ...formulario, empresa: e.target.value })}
                >
                  <option value="">-- SELECCIONAR --</option>
                  {empresasDisponibles.map((emp) => (
                    <option key={emp.id} value={emp.nombre}>
                      {emp.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sucursal</label>
                <input
                  type="text"
                  placeholder="EJ: SALITRE, CHICO"
                  className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                  value={formulario.sucursal}
                  onChange={(e) => setFormulario({ ...formulario, sucursal: e.target.value.toUpperCase() })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">ID Cliente (Opcional)</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={formulario.idCliente}
                    onChange={(e) => setFormulario({ ...formulario, idCliente: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">ID INTERWAP</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-indigo-700"
                    value={formulario.idInterwap}
                    onChange={(e) => setFormulario({ ...formulario, idInterwap: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Dirección</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formulario.direccion}
                  onChange={(e) => setFormulario({ ...formulario, direccion: e.target.value })}
                />
              </div>
            </div>

            <div className="bg-gray-50 p-4 flex justify-end gap-3 border-t">
              <button onClick={() => setModalAbierto(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded">
                Cancelar
              </button>
              <button onClick={guardarCliente} className="px-6 py-2 bg-indigo-600 text-white rounded font-medium flex items-center gap-2 hover:bg-indigo-700">
                <Check size={18} /> {isEditing ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GESTIONAR LISTA DE EMPRESAS */}
      {modalConfigEmpresas && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-800 p-3 flex justify-between items-center text-white">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Settings size={16} /> Gestionar Empresas
              </h3>
              <button onClick={() => setModalConfigEmpresas(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="text"
                  placeholder="Nueva Empresa..."
                  className="flex-1 border p-2 rounded text-sm uppercase outline-none focus:border-indigo-500"
                  value={nuevaEmpresaNombre}
                  onChange={(e) => setNuevaEmpresaNombre(e.target.value.toUpperCase())}
                />
                <button onClick={agregarEmpresaLista} className="bg-green-600 text-white p-2 rounded hover:bg-green-700">
                  <Save size={18} />
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto border rounded divide-y">
                {empresasDisponibles.map((emp) => (
                  <div key={emp.id} className="p-2 text-sm flex justify-between items-center hover:bg-gray-50">
                    <span className="font-medium text-gray-700">{emp.nombre}</span>
                    <button onClick={() => eliminarEmpresaLista(emp.id)} className="text-red-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
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

export default ListaClientes;