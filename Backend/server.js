const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// CONFIGURACIÓN DE CONEXIÓN A MYSQL
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',      // Tu usuario
    password: '',      // Tu contraseña
    database: 'turnos_multicarrier_db'
});

db.connect(err => {
    if (err) console.log('Error conectando a MySQL:', err);
    else console.log('¡Conectado a MySQL exitosamente!');
});

// --- UTILIDAD: MAPA DE HORARIOS (TUS REGLAS) ---
const obtenerRangoHorario = (textoTurno) => {
    if (!textoTurno) return null;
    const turno = textoTurno.toUpperCase().trim();

    // 1. REGLAS FIJAS
    if (turno === 'AM') return { inicio: 6, fin: 15 };        // 6am - 3pm (15:00)
    if (turno === 'PM') return { inicio: 13, fin: 21 };       // 1pm (13:00) - 9pm (21:00)
    if (turno === 'AM Y PM') return { inicio: 6, fin: 21 };   // Todo el día (6am - 9pm)
    if (turno === 'DESC' || turno === 'DESCANSO') return null; // No cuenta
    
    // 2. PARSEO INTELIGENTE (Para "5pm a 9pm", "11 a 3", "10-6", etc.)
    try {
        // Quitamos letras y dejamos solo números separados por espacio
        const numeros = turno.replace(/[^0-9\s]/g, '').trim().split(/\s+/).map(n => parseInt(n));
        
        if (numeros.length === 2) {
            let [inicio, fin] = numeros;

            // Ajuste Inicio (Si es menor a 6, asumimos PM)
            if (inicio < 6) inicio += 12; 
            
            // Ajuste Fin (Si es menor a 6, asumimos PM, excepto 12)
            if (fin < 6) fin += 12; 
            else if (fin === 12 && inicio > 12) { /* Caso especial si cierra a las 12am */ } 
            
            return { inicio, fin };
        }
    } catch (e) {
        console.log("No se pudo parsear turno manual:", turno);
    }

    return null; // Si no entendemos el turno, no lo validamos (pasa directo)
};

const hayCruce = (rango1, rango2) => {
    if (!rango1 || !rango2) return false;
    // Se cruzan si el inicio de uno es ANTES de que termine el otro
    return (rango1.inicio < rango2.fin && rango1.fin > rango2.inicio);
};

// --- RUTAS DE LA API (ENDPOINTS) ---

// ...

// 1. Obtener todos los empleados (AHORA CON SU SEDE FIJA)
app.get('/empleados', (req, res) => {
    const sql = `
        SELECT e.*, 
               c.sucursal as nombre_sede_fija, 
               c.empresa as nombre_empresa_fija
        FROM empleados e
        LEFT JOIN clientes_sucursales c ON e.sede_fija_id = c.id
        ORDER BY e.nombre_completo ASC
    `;
    db.query(sql, (err, result) => {
        if (err) return res.json(err);
        return res.json(result);
    });
});

// 2. Crear un empleado (CON SEDE FIJA)
app.post('/empleados', (req, res) => {
    const { nombre, documento, celular, cargo, idInterwap, estado, sedeFijaId } = req.body;
    
    // Si sedeFijaId es 0 o vacío, lo guardamos como NULL
    const sede = (sedeFijaId && sedeFijaId !== "0") ? sedeFijaId : null;

    const sql = "INSERT INTO empleados (nombre_completo, documento, celular, cargo, id_interwap, estado, sede_fija_id) VALUES (?, ?, ?, ?, ?, ?, ?)";
    
    db.query(sql, [nombre, documento, celular, cargo, idInterwap, estado || 'Activo', sede], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: "La cédula ya existe" });
            return res.status(500).json(err);
        }
        return res.json({ message: "Empleado creado", id: result.insertId });
    });
});

// 21. Editar Empleado (CON SEDE FIJA)
app.put('/empleados/:id', (req, res) => {
    const { id } = req.params;
    const { nombre, documento, celular, cargo, idInterwap, estado, sedeFijaId } = req.body;
    
    const sede = (sedeFijaId && sedeFijaId !== "0") ? sedeFijaId : null;

    const sql = `
        UPDATE empleados 
        SET nombre_completo = ?, documento = ?, celular = ?, cargo = ?, id_interwap = ?, estado = ?, sede_fija_id = ?
        WHERE id = ?
    `;
    
    db.query(sql, [nombre, documento, celular, cargo, idInterwap, estado, sede, id], (err, result) => {
        if (err) return res.status(500).json(err);
        return res.json({ message: "Empleado actualizado" });
    });
});

// ...

// 3. Obtener clientes/sucursales
app.get('/clientes', (req, res) => {
    const sql = "SELECT * FROM clientes_sucursales";
    db.query(sql, (err, result) => {
        if (err) return res.json(err);
        return res.json(result);
    });
});

// 4. Crear cliente/sucursal
app.post('/clientes', (req, res) => {
    const { empresa, sucursal, idCliente, idInterwap, direccion } = req.body;
    const sql = "INSERT INTO clientes_sucursales (empresa, sucursal, id_cliente_interno, id_interwap, direccion) VALUES (?, ?, ?, ?, ?)";
    db.query(sql, [empresa, sucursal, idCliente, idInterwap, direccion], (err, result) => {
        if (err) return res.json(err);
        return res.json({ message: "Cliente creado", id: result.insertId });
    });
});

// 5. Obtener turnos externos
app.get('/turnos-externos', (req, res) => {
    const sql = `
        SELECT t.*, 
               e.nombre_completo, e.documento, e.id_interwap as emp_id_interwap, e.cargo,
               c.empresa, c.sucursal, c.id_interwap as suc_id_interwap
        FROM turnos_externos t
        LEFT JOIN empleados e ON t.empleado_id = e.id
        LEFT JOIN clientes_sucursales c ON t.sucursal_id = c.id
        ORDER BY t.fecha DESC
    `;
    db.query(sql, (err, result) => {
        if (err) return res.json(err);
        return res.json(result);
    });
});

// 6. Crear turno externo
app.post('/turnos-externos', (req, res) => {
    const data = req.body;
    const sql = `
        INSERT INTO turnos_externos (
            empleado_id, sucursal_id, fecha, semana, dia_semana, mes, anio, 
            hora_inicio, hora_fin, horas_totales, id_turno, asignacion, tipo_turno, 
            franja_horaria, estado_turno, estado_ejecucion
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
        data.empleadoId, data.sucursalId, data.fecha, data.semana, data.dia, data.mes, data.anio,
        data.horaIni, data.horaFin, data.horasTotales, data.idTurno, data.asignacion, data.tipoTurno,
        data.franjaHoraria, data.estadoTurno, data.estadoEjecucion
    ];
    
    db.query(sql, values, (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).json(err);
        }
        return res.json({ message: "Turno creado", id: result.insertId });
    });
});

// 7. Asignar empleado como FIJO
app.post('/asignar-fijo', (req, res) => {
    const { empleadoId, sucursalId } = req.body;
    const sql = "INSERT INTO empleados_fijos (empleado_id, sucursal_id) VALUES (?, ?)";
    db.query(sql, [empleadoId, sucursalId], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: "Ya es fijo aquí" });
            return res.status(500).json(err);
        }
        return res.json({ message: "Asignado como Fijo", id: result.insertId });
    });
});

// 8. Obtener empleados FIJOS de una sucursal
app.get('/fijos/:sucursalId', (req, res) => {
    const { sucursalId } = req.params;
    const sql = `
        SELECT e.* 
        FROM empleados e
        JOIN empleados_fijos ef ON e.id = ef.empleado_id
        WHERE ef.sucursal_id = ?
    `;
    db.query(sql, [sucursalId], (err, result) => {
        if (err) return res.json(err);
        return res.json(result);
    });
});

// 9. Obtener Programación Semanal (POR FECHA)
app.get('/programacion-semanal', (req, res) => {
    const { fecha } = req.query; // Recibimos ?fecha=YYYY-MM-DD

    if (!fecha) {
        return res.status(400).json({ error: "Se requiere la fecha de inicio de semana" });
    }

    const sql = `
        SELECT p.*, 
               e.nombre_completo as nombre_empleado,
               c.sucursal as nombre_sucursal
        FROM programacion_semanal p
        JOIN empleados e ON p.empleado_id = e.id
        JOIN clientes_sucursales c ON p.sucursal_id = c.id
        WHERE p.fecha_inicio_semana = ?
    `;
    db.query(sql, [fecha], (err, result) => {
        if (err) return res.json(err);
        return res.json(result);
    });
});

// 10. Guardar o Actualizar un Turno (CON VALIDACIÓN DE CRUCES)
app.post('/programacion-semanal/actualizar', (req, res) => {
    const { sucursalId, empleadoId, tipo, dia, valor, fechaSemana } = req.body;
    
    if (!fechaSemana) return res.status(400).json({ error: "Falta fecha semana" });

    // 1. Obtener el Rango del Nuevo Turno
    const rangoNuevo = obtenerRangoHorario(valor);

    // Si es descanso o un texto raro, dejamos pasar
    if (!rangoNuevo) {
        ejecutarUpdate(); 
        return;
    }

    // 2. Buscar si el empleado tiene OTROS turnos ese mismo día
    const sqlCheck = `
        SELECT sucursal_id, ${dia} as turno_existente 
        FROM programacion_semanal 
        WHERE empleado_id = ? 
          AND fecha_inicio_semana = ? 
          AND sucursal_id != ?  -- Ignorar la sucursal actual
    `;

    db.query(sqlCheck, [empleadoId, fechaSemana, sucursalId], (err, resultados) => {
        if (err) return res.status(500).json(err);

        // 3. Verificar cruces
        for (const fila of resultados) {
            const rangoExistente = obtenerRangoHorario(fila.turno_existente);
            
            if (hayCruce(rangoNuevo, rangoExistente)) {
                return res.status(409).json({ 
                    error: "CRUCE DE TURNOS", 
                    mensaje: `El empleado ya tiene turno (${fila.turno_existente}) en otra sede ese día.` 
                });
            }
        }

        // 4. Si no hay cruces, guardamos
        ejecutarUpdate();
    });

    function ejecutarUpdate() {
        const sql = `
            INSERT INTO programacion_semanal (sucursal_id, empleado_id, tipo_empleado, fecha_inicio_semana, ${dia}) 
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE ${dia} = ?
        `;

        db.query(sql, [sucursalId, empleadoId, tipo, fechaSemana, valor, valor], (err, result) => {
            if (err) {
                console.log(err);
                return res.status(500).json(err);
            }
            return res.json({ message: "Turno actualizado" });
        });
    }
});

// 11. Agregar Empleado a la Programación (Recibiendo la FECHA)
app.post('/programacion-semanal/agregar', (req, res) => {
    const { sucursalId, empleadoId, tipo, fechaSemana } = req.body;

    if (!fechaSemana) return res.status(400).json({ error: "Falta fecha semana" });

    const sql = `
        INSERT INTO programacion_semanal (sucursal_id, empleado_id, tipo_empleado, fecha_inicio_semana) 
        VALUES (?, ?, ?, ?)
    `;
    db.query(sql, [sucursalId, empleadoId, tipo, fechaSemana], (err, result) => {
        if (err) return res.json(err);
        return res.json({ message: "Empleado agregado a la tabla", id: result.insertId });
    });
});

// 12. Eliminar fila de programación
app.delete('/programacion-semanal/:id', (req, res) => {
    const { id } = req.params;
    const sql = "DELETE FROM programacion_semanal WHERE id = ?";
    db.query(sql, [id], (err, result) => {
        if (err) return res.json(err);
        return res.json({ message: "Eliminado" });
    });
});

// 13. ROTAR TURNOS (CON FILTRO DE FECHA)
app.post('/rotar-turnos', (req, res) => {
    const { fechaSemana } = req.body;

    if (!fechaSemana) return res.status(400).json({ error: "Falta fecha semana para rotar" });

    try {
        const sqlGet = `
            SELECT * FROM programacion_semanal 
            WHERE tipo_empleado = 'Fijo' AND fecha_inicio_semana = ?
            ORDER BY sucursal_id, id ASC
        `;
        
        db.query(sqlGet, [fechaSemana], async (err, resultados) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: "Error al leer turnos" });
            }

            const porSucursal = {};
            resultados.forEach(fila => {
                if (!porSucursal[fila.sucursal_id]) porSucursal[fila.sucursal_id] = [];
                porSucursal[fila.sucursal_id].push(fila);
            });

            const actualizaciones = [];

            Object.keys(porSucursal).forEach(sucursalId => {
                const filas = porSucursal[sucursalId];
                
                if (filas.length > 1) {
                    const ultimoIndex = filas.length - 1;
                    const turnosDelUltimo = {
                        sabado: filas[ultimoIndex].sabado,
                        domingo: filas[ultimoIndex].domingo,
                        lunes: filas[ultimoIndex].lunes,
                        martes: filas[ultimoIndex].martes,
                        miercoles: filas[ultimoIndex].miercoles,
                        jueves: filas[ultimoIndex].jueves,
                        viernes: filas[ultimoIndex].viernes
                    };

                    for (let i = ultimoIndex; i > 0; i--) {
                        const filaActual = filas[i];
                        const filaAnterior = filas[i - 1]; 

                        actualizaciones.push({
                            id: filaActual.id, 
                            sabado: filaAnterior.sabado, domingo: filaAnterior.domingo,
                            lunes: filaAnterior.lunes, martes: filaAnterior.martes,
                            miercoles: filaAnterior.miercoles, jueves: filaAnterior.jueves,
                            viernes: filaAnterior.viernes
                        });
                    }

                    actualizaciones.push({
                        id: filas[0].id,
                        ...turnosDelUltimo
                    });
                }
            });

            if (actualizaciones.length === 0) {
                return res.json({ message: "No hubo cambios (pocos fijos)" });
            }

            const promesas = actualizaciones.map(act => {
                return new Promise((resolve, reject) => {
                    const sqlUpdate = `
                        UPDATE programacion_semanal 
                        SET sabado=?, domingo=?, lunes=?, martes=?, miercoles=?, jueves=?, viernes=?
                        WHERE id=?
                    `;
                    const valores = [
                        act.sabado, act.domingo, act.lunes, act.martes, 
                        act.miercoles, act.jueves, act.viernes, 
                        act.id
                    ];

                    db.query(sqlUpdate, valores, (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    });
                });
            });

            await Promise.all(promesas);
            res.json({ message: "Rotación de turnos completada exitosamente" });
        });

    } catch (error) {
        console.error("Error en servidor:", error);
        res.status(500).json({ error: "Error interno" });
    }
});

// 14. EDITAR SOLO EL EMPLEADO DE UNA FILA
app.put('/programacion-semanal/editar-empleado', (req, res) => {
    const { idProgramacion, nuevoEmpleadoId } = req.body;
    
    const sql = "UPDATE programacion_semanal SET empleado_id = ? WHERE id = ?";
    
    db.query(sql, [nuevoEmpleadoId, idProgramacion], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Error al actualizar empleado" });
        }
        return res.json({ message: "Empleado actualizado correctamente" });
    });
});

// 15. REPLICAR PROGRAMACIÓN (Solo Fijos, de una semana a otra)
app.post('/replicar-programacion', (req, res) => {
    const { fechaAnterior, fechaNueva } = req.body;

    if (!fechaAnterior || !fechaNueva) {
        return res.status(400).json({ error: "Faltan fechas" });
    }

    const sqlCheck = "SELECT COUNT(*) as total FROM programacion_semanal WHERE fecha_inicio_semana = ?";
    
    db.query(sqlCheck, [fechaNueva], (err, result) => {
        if (err) return res.status(500).json(err);
        
        if (result[0].total > 0) {
            return res.json({ message: "La semana ya tiene datos, no se replicó nada." });
        }

        const sqlCopy = `
            INSERT INTO programacion_semanal 
            (sucursal_id, empleado_id, tipo_empleado, fecha_inicio_semana, sabado, domingo, lunes, martes, miercoles, jueves, viernes)
            SELECT sucursal_id, empleado_id, 'Fijo', ?, sabado, domingo, lunes, martes, miercoles, jueves, viernes
            FROM programacion_semanal
            WHERE fecha_inicio_semana = ? AND tipo_empleado = 'Fijo'
        `;

        db.query(sqlCopy, [fechaNueva, fechaAnterior], (errCopy, resultCopy) => {
            if (errCopy) return res.status(500).json(errCopy);
            return res.json({ 
                message: "Programación replicada exitosamente", 
                filasCopiadas: resultCopy.affectedRows 
            });
        });
    });
});
// 16. Obtener lista de empresas
app.get('/empresas-lista', (req, res) => {
    db.query("SELECT * FROM empresas_lista ORDER BY nombre ASC", (err, result) => {
        if (err) return res.json(err);
        return res.json(result);
    });
});

// 17. Crear nueva empresa en la lista
app.post('/empresas-lista', (req, res) => {
    const { nombre } = req.body;
    db.query("INSERT INTO empresas_lista (nombre) VALUES (?)", [nombre.toUpperCase()], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: "La empresa ya existe" });
            return res.status(500).json(err);
        }
        return res.json({ message: "Empresa agregada", id: result.insertId });
    });
});

// 18. Eliminar empresa de la lista
app.delete('/empresas-lista/:id', (req, res) => {
    db.query("DELETE FROM empresas_lista WHERE id = ?", [req.params.id], (err, result) => {
        if (err) return res.json(err);
        return res.json({ message: "Empresa eliminada" });
    });
});
// 19. EDITAR CLIENTE / SUCURSAL
app.put('/clientes/:id', (req, res) => {
    const { id } = req.params;
    const { empresa, sucursal, idCliente, idInterwap, direccion } = req.body;
    
    const sql = `
        UPDATE clientes_sucursales 
        SET empresa = ?, sucursal = ?, id_cliente_interno = ?, id_interwap = ?, direccion = ?
        WHERE id = ?
    `;
    
    db.query(sql, [empresa, sucursal, idCliente, idInterwap, direccion, id], (err, result) => {
        if (err) return res.status(500).json(err);
        return res.json({ message: "Cliente actualizado correctamente" });
    });
});

// 20. ELIMINAR CLIENTE / SUCURSAL
app.delete('/clientes/:id', (req, res) => {
    const { id } = req.params;
    
    // Primero revisamos si tiene turnos asignados (Integridad Referencial)
    // Opcional: Podrías borrar todo en cascada, pero es mejor avisar si hay datos
    const sql = "DELETE FROM clientes_sucursales WHERE id = ?";
    
    db.query(sql, [id], (err, result) => {
        if (err) {
            // Error común: Integridad referencial (tiene turnos asociados)
            if (err.code === 'ER_ROW_IS_REFERENCED_2') {
                return res.status(400).json({ error: "No se puede borrar: Esta sede tiene turnos o empleados asignados." });
            }
            return res.status(500).json(err);
        }
        return res.json({ message: "Cliente eliminado" });
    });
});
// 21. Editar Empleado
app.put('/empleados/:id', (req, res) => {
    const { id } = req.params;
    const { nombre, documento, celular, cargo, idInterwap, estado } = req.body;
    
    const sql = `
        UPDATE empleados 
        SET nombre_completo = ?, documento = ?, celular = ?, cargo = ?, id_interwap = ?, estado = ?
        WHERE id = ?
    `;
    
    db.query(sql, [nombre, documento, celular, cargo, idInterwap, estado, id], (err, result) => {
        if (err) return res.status(500).json(err);
        return res.json({ message: "Empleado actualizado" });
    });
});

// 22. Eliminar Empleado (OJO: Mejor usar Inactivar)
app.delete('/empleados/:id', (req, res) => {
    const { id } = req.params;
    
    // Verificamos si tiene historial de turnos
    const sqlCheck = "SELECT COUNT(*) as total FROM programacion_semanal WHERE empleado_id = ?";
    
    db.query(sqlCheck, [id], (err, result) => {
        if (err) return res.status(500).json(err);
        
        if (result[0].total > 0) {
            return res.status(400).json({ 
                error: "No se puede eliminar: Tiene turnos asociados. Mejor cámbialo a estado 'Inactivo'." 
            });
        }

        // Si está limpio, borramos
        db.query("DELETE FROM empleados WHERE id = ?", [id], (errDel, resDel) => {
            if (errDel) return res.status(500).json(errDel);
            return res.json({ message: "Empleado eliminado definitivamente" });
        });
    });
});

// --- GESTIÓN DE CARGOS (LISTA MAESTRA) ---

// 23. Obtener cargos
app.get('/cargos-lista', (req, res) => {
    db.query("SELECT * FROM cargos_lista ORDER BY nombre ASC", (err, result) => {
        if (err) return res.json(err);
        return res.json(result);
    });
});

// 24. Crear cargo
app.post('/cargos-lista', (req, res) => {
    const { nombre } = req.body;
    db.query("INSERT INTO cargos_lista (nombre) VALUES (?)", [nombre.toUpperCase()], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: "El cargo ya existe" });
            return res.status(500).json(err);
        }
        return res.json({ message: "Cargo agregado", id: result.insertId });
    });
});

// 25. Eliminar cargo
app.delete('/cargos-lista/:id', (req, res) => {
    db.query("DELETE FROM cargos_lista WHERE id = ?", [req.params.id], (err, result) => {
        if (err) return res.json(err);
        return res.json({ message: "Cargo eliminado" });
    });
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});