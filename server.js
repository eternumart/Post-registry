import express, { text } from "express";
import multer from "multer";
import pkg from "pg";
import { fileURLToPath } from "url";
import { dirname } from "path";
import * as fs from "fs";
import { Document, Packer, Paragraph, TextRun, UnderlineType, AlignmentType, HeadingLevel } from "docx";

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

	const fontStyles = {
		h1Title: {
			id: "Heading1",
			name: "Heading 1",
			basedOn: "Normal",
			next: "Normal",
			quickFormat: true,
			
			run: {
				size: 64,
				bold: true,
				italics: false,
				color: "000000",
				alignment: AlignmentType.CENTER,
			},
			paragraph: {
				spacing: {
					after: 120,
				},
			},
		},
		h2Title: {
			id: "Heading2",
			name: "Heading 2",
			basedOn: "Normal",
			next: "Normal",
			quickFormat: true,
			run: {
				size: 34,
				bold: false,
			},
			paragraph: {
				spacing: {
					before: 240,
					after: 120,
				},
			},
		},
		asideText: {
			id: "aside",
			name: "Aside",
			basedOn: "Normal",
			next: "Normal",
			run: {
				color: "999999",
				italics: true,
			},
			paragraph: {
				indent: {
					left: 720,
				},
				spacing: {
					line: 276,
				},
			},
		},
		wellSpaced: {
			id: "wellSpaced",
			name: "Well Spaced",
			basedOn: "Normal",
			quickFormat: true,
			paragraph: {
				spacing: {
					line: 276,
					before: 20 * 72 * 0.1,
					after: 20 * 72 * 0.05,
				},
			},
		},
		listParagraph: {
			id: "ListParagraph",
			name: "List Paragraph",
			basedOn: "Normal",
			quickFormat: true,
		}
	}

	const formatVariations = {
		h1Title: new Paragraph({
			text: `${theme}`,
			heading: HeadingLevel.HEADING_1,
		}),
		usualText: new Paragraph(`${letterTextArr}`),
	}

	const doc = new Document({
		creator: `${user}`,
		title: `Письмо от ${date}`,
		description: `${theme}`,
		styles: {
			paragraphStyles: [fontStyles.h1Title, fontStyles.h2Title, fontStyles.asideText, fontStyles.wellSpaced, fontStyles.listParagraph],
		},
		numbering: {
			config: [
				{
					reference: "numbering",
					levels: [
						{
							level: 0,
							format: "lowerLetter",
							text: "%1)",
							alignment: AlignmentType.LEFT,
						},
					],
				},
			],
		},
		sections: [
			{
				children: [

					new Paragraph({
						text: "Test heading2 with double red underline",
						heading: HeadingLevel.HEADING_2,
					}),
					new Paragraph({
						text: "Option1",
						numbering: {
							reference: "my-crazy-numbering",
							level: 0,
						},
					}),
					new Paragraph({
						text: "Option5 -- override 2 to 5",
						numbering: {
							reference: "my-crazy-numbering",
							level: 0,
						},
					}),
					new Paragraph({
						text: "Option3",
						numbering: {
							reference: "my-crazy-numbering",
							level: 0,
						},
					}),
					new Paragraph({
						children: [
							new TextRun({
								text: "Some monospaced content",
								font: {
									name: "Monospace",
								},
							}),
						],
					}),
					new Paragraph({
						text: "An aside, in light gray italics and indented",
						style: "aside",
					}),
					new Paragraph({
						children: [
							new TextRun({
								text: "This is a bold run,",
								bold: true,
							}),
							new TextRun(" switching to normal "),
							new TextRun({
								text: "and then underlined ",
								underline: {},
							}),
							new TextRun({
								text: "and back to normal.",
							}),
						],
					}),
				],
			},
		],
	});

	Packer.toBuffer(doc).then((buffer) => {
		fs.writeFileSync(`docs/draft.docx`, buffer);
	});

	return "draft";
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
