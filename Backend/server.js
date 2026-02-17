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

// --- RUTAS DE LA API (ENDPOINTS) ---

// 1. Obtener todos los empleados
app.get('/empleados', (req, res) => {
    const sql = "SELECT * FROM empleados";
    db.query(sql, (err, result) => {
        if (err) return res.json(err);
        return res.json(result);
    });
});

// 2. Crear un empleado
app.post('/empleados', (req, res) => {
    const { nombre, documento, celular, cargo, idInterwap } = req.body;
    const sql = "INSERT INTO empleados (nombre_completo, documento, celular, cargo, id_interwap) VALUES (?, ?, ?, ?, ?)";
    db.query(sql, [nombre, documento, celular, cargo, idInterwap], (err, result) => {
        if (err) return res.json(err);
        return res.json({ message: "Empleado creado", id: result.insertId });
    });
});

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

// 10. Guardar o Actualizar un Turno (Recibiendo la FECHA)
app.post('/programacion-semanal/actualizar', (req, res) => {
    const { sucursalId, empleadoId, tipo, dia, valor, fechaSemana } = req.body;
    
    if (!fechaSemana) return res.status(400).json({ error: "Falta fecha semana" });

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
        // 1. Obtener todas las filas de FIJOS de ESA SEMANA
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

            // Agrupar por sucursal
            const porSucursal = {};
            resultados.forEach(fila => {
                if (!porSucursal[fila.sucursal_id]) porSucursal[fila.sucursal_id] = [];
                porSucursal[fila.sucursal_id].push(fila);
            });

            const actualizaciones = [];

            // 2. Calcular la rotación (El turno de arriba baja)
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

            // 3. Ejecutar los UPDATE
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

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});