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
// 9. Obtener Programación Semanal
app.get('/programacion-semanal', (req, res) => {
    const sql = `
        SELECT p.*, 
               e.nombre_completo as nombre_empleado,
               c.sucursal as nombre_sucursal
        FROM programacion_semanal p
        JOIN empleados e ON p.empleado_id = e.id
        JOIN clientes_sucursales c ON p.sucursal_id = c.id
    `;
    db.query(sql, (err, result) => {
        if (err) return res.json(err);
        return res.json(result);
    });
});

// 10. Guardar o Actualizar un Turno (Celda específica)
app.post('/programacion-semanal/actualizar', (req, res) => {
    const { sucursalId, empleadoId, tipo, dia, valor } = req.body;
    
    // Usamos fecha dummy por ahora (o la fecha actual de la semana)
    const fechaSemana = '2026-02-14'; 

    // Usamos ON DUPLICATE KEY UPDATE para crear o editar en una sola consulta
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

// 11. Agregar Empleado a la Programación (Fila nueva vacía)
app.post('/programacion-semanal/agregar', (req, res) => {
    const { sucursalId, empleadoId, tipo } = req.body;
    const fechaSemana = '2026-02-14';

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

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});