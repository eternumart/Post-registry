import express, { response } from "express";
import multer from "multer";
import pkg from "pg";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";
import { sign } from "crypto";

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
  res.send({ loaded: true });
});

app.post("/get-login", async (req, res) => {
  if (!req.body) {
    return res.sendStatus(400);
  }
  let signIn = {
    loginIsPossible: false,
    username: "",
    isAdmin: false,
  };
  const reqData = req.body;
  const resData = await getLoginFromDataBase(reqData);

  if (resData.username === reqData.username && resData.password === reqData.password) {
    signIn.loginIsPossible = true;
    signIn.username = resData.username;
  }
  if (resData.isAdmin) {
    signIn.isAdmin = true;
  }
  res.send(signIn).end();
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
  const lastId = await getCurrentLastId();
  const newId = Number(lastId.rows[0].max) + 1;
  const sql = `INSERT INTO "post" ("id", "sender", "reciever", "date", "text", "user", "theme") VALUES ('${newId}', '${data.companySender}', '${data.companyReciever}', '${data.dateField}', '${data.letterText}', '${data.currentUser}', '${data.letteTheme}')`;
  return client.query(sql);
}

async function getCurrentLastId() {
  const sql = `SELECT MAX(id) FROM "post"`;
  return client.query(sql);
}

// Чтение данных базы
async function getLoginFromDataBase(data) {
  const sqlLogin = `SELECT * FROM "users" WHERE "username"  LIKE '${data.username}'`;
  const prepareData = await client.query(sqlLogin);
  if (prepareData.rowCount === 0) {
    return [{ username: "", isAdmin: "false", password: "", name: "" }];
  }
  const userData = prepareData.rows;
  console.log(prepareData);
  return userData[0];
}

// SELECT "username" FROM "users" - выбрать столбец с юзернеймами
// INSERT INTO public."users" ("username", "password", "name", "isAdmin") VALUES ('sli@sste.ru', 'Es12345678', 'Лев', FALSE) - вставить данные в таблицу
// SELECT * FROM "users" WHERE "sli@sobaka.ru"  LIKE 'sli@sste.ru' - ищет пользователя в базе
