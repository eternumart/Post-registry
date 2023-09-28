import express, { response } from "express";
import multer from "multer";
import pkg from "pg";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const { Client } = pkg;
const app = express();

// Настройка загрузки файлов с фронта на бек
const storage = multer.diskStorage({
  destination: (_, __, callback) => {
    callback(null, "./uploads");
  },
  fileName: (_, file, callback) => {
    callback(null, `${getNormalName(file)}.pdf`);
  },
});

const upload = multer({ storage: storage, limits: { fileSize: 1e10 } });

const users = {
  // must be in DataBase
  "ged@sste.ru": {
    password: "Crazy19",
    isAdmin: true,
  },
  "sli@sste.ru": {
    password: "Es12345678",
    isAdmin: false,
  },
};

// Настройка получения запросов с фронта на бек
app.use(express.json());

// Чтение всей директории с файлами
app.use(express.static(__dirname));

// Запуск сервера Node.JS
app.listen(3000, (err) => {
  if (err) {
    console.log(err);
  } else {
    console.log("Server started on localhost:3000");
  }
});

// Вход на первичную страницу
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.get("/incoming-mail", (req, res) => {
  res.sendFile(__dirname + "/incoming-mail.html");
});

app.post("/save-data", (req, res) => {
  if (!req.body) {
    return res.sendStatus(400);
  }
  setDataToBase(req.body);
});

// Задаем верное имя файлу
function getNormalName(file) {
  const fullName = Buffer.from(file.originalname, "latin1").toString("utf8");
  const splitted = fullName.split(".");
  const normalName = splitted[0];
  return normalName;
}

// Декодируем строки в кириллицу
function decoderStrings(string) {
  return decodeURIComponent(string);
}

//PostgreSQL connection
const client = new Client({
  host: "localhost",
  port: 3001,
  database: "postgres",
  user: "postgres",
  password: "Es12345678",
});
await client.connect();

// Запись данных в базу
async function setDataToBase(data) {
  const sql = `INSERT INTO public."post" ("sender", "reciever", "date", "text", "user", "theme") VALUES ('${data.companySender}', '${data.companyReciever}', '${data.dateField}', '${data.letterText}', '${data.currentUser}, '${data.letteTheme}'')`;
  client.query(sql);
}

// Чтение данных базы
async function readDataFromBase(address) {
  const sql = `SELECT "OBJECT_ID", "OBJECT_ADDRESS", "OBJECT_DATA" FROM public."parsedData" WHERE "OBJECT_ADDRESS" = '${address}'`;
  return client.query(sql);
}



// SELECT "username" FROM "users" - выбрать столбец с юзернеймами
// INSERT INTO public."users" ("username", "password", "name", "isAdmin") VALUES ('sli@sste.ru', 'Es12345678', 'Лев', FALSE) - вставить данные в таблицу
// SELECT * FROM "users" WHERE "username"  LIKE 'sli@sste.ru' - ищет пользователя в базе