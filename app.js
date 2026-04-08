// ============================================================
// Sistema de Reservas de Restaurante
// API REST con Node.js + Express
// Incluye: Registro, Login y Gestión de Reservas
// ============================================================

// Importamos Express para crear el servidor web
const express = require("express");
// Importamos bcryptjs para cifrar las contraseñas de forma segura
const bcrypt = require("bcryptjs");
// Importamos uuid para generar IDs únicos para cada reserva
const { v4: uuidv4 } = require("uuid");
// Importamos fs para leer y escribir archivos JSON
const fs = require("fs");
// Importamos path para manejar rutas de archivos
const path = require("path");

// Creamos la aplicación Express
const app = express();

// Indicamos que la aplicación recibe y envía datos en formato JSON
app.use(express.json());

// Rutas de los archivos donde se guardan los datos
const USUARIOS_FILE = path.join(__dirname, "usuarios.json");
const RESERVAS_FILE = path.join(__dirname, "reservas.json");

// ------------------------------------------------------------
// Funciones auxiliares para manejar los archivos de datos
// ------------------------------------------------------------

// Carga y retorna el objeto de usuarios desde el archivo JSON
function cargarUsuarios() {
    if (!fs.existsSync(USUARIOS_FILE)) return {};
    return JSON.parse(fs.readFileSync(USUARIOS_FILE, "utf-8"));
}

// Guarda el objeto de usuarios en el archivo JSON
function guardarUsuarios(usuarios) {
    fs.writeFileSync(USUARIOS_FILE, JSON.stringify(usuarios, null, 4));
}

// Carga y retorna el objeto de reservas desde el archivo JSON
function cargarReservas() {
    if (!fs.existsSync(RESERVAS_FILE)) return {};
    return JSON.parse(fs.readFileSync(RESERVAS_FILE, "utf-8"));
}

// Guarda el objeto de reservas en el archivo JSON
function guardarReservas(reservas) {
    fs.writeFileSync(RESERVAS_FILE, JSON.stringify(reservas, null, 4));
}

// Verifica si el usuario existe y la contraseña es correcta
// Retorna true si la autenticación es válida, false si no
function verificarUsuario(usuario, contrasena) {
    const usuarios = cargarUsuarios();
    // Verificamos que el usuario exista
    if (!usuarios[usuario]) return false;
    // Comparamos la contraseña con el hash guardado
    return bcrypt.compareSync(contrasena, usuarios[usuario]);
}

// Valida que el formato de fecha y hora sea correcto (YYYY-MM-DD HH:MM)
function validarFecha(fecha_hora) {
    const regex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
    return regex.test(fecha_hora);
}


// ============================================================
// ENDPOINT: REGISTRO DE USUARIO
// Ruta: POST /registro
// Recibe: usuario y contraseña
// Retorna: mensaje de éxito o error
// ============================================================
app.post("/registro", (req, res) => {
    // Extraemos usuario y contraseña del body
    const { usuario, contrasena } = req.body;

    // Validamos que se hayan enviado ambos campos
    if (!usuario || !contrasena) {
        return res.status(400).json({ error: "Faltan datos" });
    }

    const usuarios = cargarUsuarios();

    // Verificamos que el usuario no exista previamente
    if (usuarios[usuario]) {
        return res.status(409).json({ error: "El usuario ya existe" });
    }

    // Ciframos la contraseña con bcrypt antes de guardarla
    // El número 10 es el nivel de seguridad del cifrado (salt rounds)
    const hash = bcrypt.hashSync(contrasena, 10);
    usuarios[usuario] = hash;
    guardarUsuarios(usuarios);

    // Retornamos éxito con código 201 (Created)
    return res.status(201).json({ mensaje: "Registro exitoso" });
});


// ============================================================
// ENDPOINT: INICIO DE SESIÓN
// Ruta: POST /login
// Recibe: usuario y contraseña
// Retorna: mensaje de autenticación satisfactoria o error
// ============================================================
app.post("/login", (req, res) => {
    // Extraemos usuario y contraseña del body
    const { usuario, contrasena } = req.body;

    // Verificamos las credenciales del usuario
    if (verificarUsuario(usuario, contrasena)) {
        return res.status(200).json({ mensaje: "Autenticación satisfactoria" });
    } else {
        // Mismo mensaje para usuario inexistente o contraseña incorrecta (seguridad)
        return res.status(401).json({ error: "Error en la autenticación" });
    }
});


// ============================================================
// ENDPOINT: CREAR RESERVA
// Ruta: POST /reservas
// Recibe: usuario, contraseña, nombre_cliente, fecha_hora,
//         num_personas
// Retorna: ID de la reserva creada o error
// ============================================================
app.post("/reservas", (req, res) => {
    // Extraemos todos los datos del body
    const { usuario, contrasena, nombre_cliente, fecha_hora, num_personas } = req.body;

    // Verificamos que el usuario esté autenticado correctamente
    if (!verificarUsuario(usuario, contrasena)) {
        return res.status(401).json({ error: "Error en la autenticación" });
    }

    // Validamos que todos los campos de la reserva estén presentes
    if (!nombre_cliente || !fecha_hora || !num_personas) {
        return res.status(400).json({ error: "Faltan datos de la reserva" });
    }

    // Validamos el formato de la fecha y hora
    if (!validarFecha(fecha_hora)) {
        return res.status(400).json({ error: "Formato de fecha incorrecto. Use: YYYY-MM-DD HH:MM" });
    }

    // Validamos que el número de personas sea un número válido mayor a 0
    const personas = parseInt(num_personas);
    if (isNaN(personas) || personas <= 0) {
        return res.status(400).json({ error: "El número de personas debe ser mayor a 0" });
    }

    // Generamos un ID único para la reserva (primeros 8 caracteres en mayúscula)
    const id_reserva = uuidv4().substring(0, 8).toUpperCase();

    // Creamos el objeto de la reserva con todos sus datos
    const nuevaReserva = {
        id:             id_reserva,
        usuario:        usuario,
        nombre_cliente: nombre_cliente,
        fecha_hora:     fecha_hora,
        num_personas:   personas,
        estado:         "activa"
    };

    // Guardamos la reserva en el archivo JSON
    const reservas = cargarReservas();
    reservas[id_reserva] = nuevaReserva;
    guardarReservas(reservas);

    // Retornamos éxito con el ID y los datos de la reserva creada
    return res.status(201).json({
        mensaje:    "Reserva creada exitosamente",
        id_reserva: id_reserva,
        reserva:    nuevaReserva
    });
});


// ============================================================
// ENDPOINT: CONSULTAR RESERVAS
// Ruta: GET /reservas
// Recibe: usuario y contraseña como parámetros en la URL
// Retorna: lista de reservas activas del usuario
// ============================================================
app.get("/reservas", (req, res) => {
    // Obtenemos las credenciales desde los parámetros de la URL
    const { usuario, contrasena } = req.query;

    // Verificamos que el usuario esté autenticado correctamente
    if (!verificarUsuario(usuario, contrasena)) {
        return res.status(401).json({ error: "Error en la autenticación" });
    }

    // Cargamos todas las reservas y filtramos las del usuario actual
    const reservas = cargarReservas();
    const misReservas = Object.values(reservas).filter(
        r => r.usuario === usuario && r.estado === "activa"
    );

    // Verificamos si el usuario tiene reservas activas
    if (misReservas.length === 0) {
        return res.status(200).json({ mensaje: "No tienes reservas activas", reservas: [] });
    }

    // Retornamos la lista de reservas encontradas
    return res.status(200).json({
        mensaje:  `Se encontraron ${misReservas.length} reserva(s)`,
        reservas: misReservas
    });
});


// ============================================================
// ENDPOINT: MODIFICAR RESERVA
// Ruta: PUT /reservas/:id_reserva
// Recibe: usuario, contraseña y los campos a modificar
// Retorna: reserva actualizada o error
// ============================================================
app.put("/reservas/:id_reserva", (req, res) => {
    // Obtenemos el ID de la reserva desde la URL
    const { id_reserva } = req.params;
    // Extraemos los datos del body
    const { usuario, contrasena, nombre_cliente, fecha_hora, num_personas } = req.body;

    // Verificamos que el usuario esté autenticado correctamente
    if (!verificarUsuario(usuario, contrasena)) {
        return res.status(401).json({ error: "Error en la autenticación" });
    }

    // Cargamos las reservas y verificamos que la reserva exista
    const reservas = cargarReservas();
    if (!reservas[id_reserva]) {
        return res.status(404).json({ error: "Reserva no encontrada" });
    }

    const reserva = reservas[id_reserva];

    // Verificamos que la reserva pertenezca al usuario autenticado
    if (reserva.usuario !== usuario) {
        return res.status(403).json({ error: "No tienes permiso para modificar esta reserva" });
    }

    // Verificamos que la reserva no esté cancelada
    if (reserva.estado === "cancelada") {
        return res.status(400).json({ error: "No se puede modificar una reserva cancelada" });
    }

    // Actualizamos solo los campos que se enviaron en la petición
    if (nombre_cliente) reserva.nombre_cliente = nombre_cliente;

    if (fecha_hora) {
        // Validamos el formato de la nueva fecha y hora
        if (!validarFecha(fecha_hora)) {
            return res.status(400).json({ error: "Formato de fecha incorrecto. Use: YYYY-MM-DD HH:MM" });
        }
        reserva.fecha_hora = fecha_hora;
    }

    if (num_personas) {
        // Validamos que el nuevo número de personas sea válido
        const personas = parseInt(num_personas);
        if (isNaN(personas) || personas <= 0) {
            return res.status(400).json({ error: "El número de personas debe ser mayor a 0" });
        }
        reserva.num_personas = personas;
    }

    // Guardamos los cambios en el archivo JSON
    reservas[id_reserva] = reserva;
    guardarReservas(reservas);

    // Retornamos la reserva actualizada
    return res.status(200).json({
        mensaje: "Reserva modificada exitosamente",
        reserva: reserva
    });
});


// ============================================================
// ENDPOINT: CANCELAR RESERVA
// Ruta: DELETE /reservas/:id_reserva
// Recibe: usuario y contraseña en el body
// Retorna: mensaje de confirmación o error
// ============================================================
app.delete("/reservas/:id_reserva", (req, res) => {
    // Obtenemos el ID de la reserva desde la URL
    const { id_reserva } = req.params;
    // Extraemos las credenciales del body
    const { usuario, contrasena } = req.body;

    // Verificamos que el usuario esté autenticado correctamente
    if (!verificarUsuario(usuario, contrasena)) {
        return res.status(401).json({ error: "Error en la autenticación" });
    }

    // Cargamos las reservas y verificamos que la reserva exista
    const reservas = cargarReservas();
    if (!reservas[id_reserva]) {
        return res.status(404).json({ error: "Reserva no encontrada" });
    }

    const reserva = reservas[id_reserva];

    // Verificamos que la reserva pertenezca al usuario autenticado
    if (reserva.usuario !== usuario) {
        return res.status(403).json({ error: "No tienes permiso para cancelar esta reserva" });
    }

    // Verificamos que la reserva no esté ya cancelada
    if (reserva.estado === "cancelada") {
        return res.status(400).json({ error: "La reserva ya está cancelada" });
    }

    // Cambiamos el estado a cancelada (no la eliminamos para mantener historial)
    reservas[id_reserva].estado = "cancelada";
    guardarReservas(reservas);

    // Retornamos confirmación de la cancelación
    return res.status(200).json({
        mensaje:    "Reserva cancelada exitosamente",
        id_reserva: id_reserva
    });
});


// ============================================================
// Iniciamos el servidor en el puerto 3000
// ============================================================
const PUERTO = 3000;
app.listen(PUERTO, () => {
    console.log(`Servidor corriendo en http://127.0.0.1:${PUERTO}`);
    console.log("Presiona CTRL+C para detener el servidor");
});