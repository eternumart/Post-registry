import express, { text } from "express";
import multer from "multer";
import pkg from "pg";
import { fileURLToPath } from "url";
import { dirname } from "path";
import * as fs from "fs";
import { ExternalHyperlink, HeadingLevel, ImageRun, Paragraph, patchDocument, PatchType, Table, TableCell, TableRow, TextDirection, TextRun, VerticalAlign } from "docx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const { Client } = pkg;
const app = express();

const serverConfig = {
	ip: {
		buhgalteriya: "192.168.13.16",
		servernaya: "192.168.0.60",
		home: "192.168.0.105",
	},
	port: 3000,
};

const currentDEVIP = serverConfig.ip.servernaya;

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
app.listen(serverConfig.port, currentDEVIP, (err) => {
	if (err) {
		console.log(serverConfig.port, currentDEVIP);
		console.log(err);
	} else {
		console.log(`Server started on ${currentDEVIP}:${serverConfig.port}`);
	}
});

// Вход на первичную страницу
app.get("/", (req, res) => {
	res.sendFile(__dirname + "/index.html");
});

app.get("/incoming-mail", (req, res) => {
	res.sendFile(__dirname + "/incoming-mail.html");
});

// Запрос на сохранение данных с фронта
app.post("/save-data", (req, res) => {
	if (!req.body) {
		return res.sendStatus(400);
	}
	// setDataToBase(req.body);
	const data = convertDataToDocx(req.body);
	res.send({ DB: true, Docx: true, filename: data.filename, dataText: data.data });
});

//Запрос авторизации с фронта
app.post("/get-login", async (req, res) => {
	if (!req.body) {
		return res.sendStatus(400);
	}
	// возвращаемые параметры на фронт
	let signIn = {
		loginIsPossible: false,
		username: "",
		isAdmin: false,
	};
	const reqData = req.body;
	const resData = await getLoginFromDataBase(reqData);

	// Проверка правильности логина/пароля
	if (resData.username === reqData.username && resData.password === reqData.password) {
		signIn.loginIsPossible = true;
		signIn.username = resData.username;
	}
	if (resData.isAdmin) {
		signIn.isAdmin = true;
	}

	// Ответ на фронт о возможности авторизации
	res.send(signIn).end();
});

app.get("/download", async (req, res) => {
	console.log("FileName: " + req.query.filename);
	res.sendFile(`${__dirname}\\docs\\${req.query.filename}.docx`);
});

// Задаем верное имя файлу
function getNormalName(file) {
	const fullName = Buffer.from(file.originalname, "latin1").toString("utf8");
	const splitted = fullName.split(".");
	const normalName = splitted[0];
	return normalName;
}

// Конвертация данных с фронта в DocX документ
function convertDataToDocx(data) {
	const sender = data.companySender;
	const reciever = data.companyReciever;
	const recieverName = data.recieverName;
	const theme = data.letterTheme;
	const letterTextArr = data.letterText;
	const user = data.currentUser;
	const date = data.dateField;
	let letterTextReady = "";

	letterTextArr.forEach((piece) => {
		letterTextReady += piece;
	});

	patchDocument(fs.readFileSync("templates/Korneeva.docx"), {
		patches: {
			text_patch: {
				type: PatchType.DOCUMENT,
				children: createChildrenArr(letterTextArr),
			},
			date_patch: {
				type: PatchType.PARAGRAPH,
				children: [new TextRun(date)],
			},
		},
	}).then((doc) => {
		fs.writeFileSync("docs/patchedDoc.docx", doc);
	});

	return "patchedDoc";
}

function createChildrenArr(letterTextArr) {
	const resultArr = [];
	letterTextArr.forEach((string) => {
		let paragraph = new Paragraph(string);
		resultArr.push(paragraph);
	});
	return resultArr;
}

// Декодируем строки в кириллицу
function decoderStrings(string) {
	return decodeURIComponent(string);
}

//PostgreSQL connection
const client = new Client({
	host: currentDEVIP,
	port: 3001,
	database: "postgres",
	user: "postgres",
	password: "Es12345678",
});
await client.connect();

// Запись данных письма в базу
async function setDataToBase(data) {
	const lastId = await getCurrentLastId();
	const newId = Number(lastId.rows[0].max) + 1;
	const sql = `INSERT INTO "post" ("id", "sender", "reciever", "date", "text", "user", "theme") VALUES ('${newId}', '${data.companySender}', '${data.companyReciever}', '${data.dateField}', '${data.letterText}', '${data.currentUser}', '${data.letteTheme}')`;
	return client.query(sql);
}

// Забираем корректный ID из базы
async function getCurrentLastId() {
	const sql = `SELECT MAX(id) FROM "post"`;
	return client.query(sql);
}

// Чтение данных о логине/пароле из базы
async function getLoginFromDataBase(data) {
	const sqlLogin = `SELECT * FROM "users" WHERE "username"  LIKE '${data.username}'`;
	const prepareData = await client.query(sqlLogin);
	if (prepareData.rowCount === 0) {
		return [{ username: "", isAdmin: "false", password: "", name: "" }];
	}
	const userData = prepareData.rows;
	return userData[0];
}

// SELECT "username" FROM "users" - выбрать столбец с юзернеймами
// INSERT INTO public."users" ("username", "password", "name", "isAdmin") VALUES ('sli@sste.ru', 'Es12345678', 'Лев', FALSE) - вставить данные в таблицу
// SELECT * FROM "users" WHERE "sli@sobaka.ru"  LIKE 'sli@sste.ru' - ищет пользователя в базе
