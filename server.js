import express, { text } from "express";
import multer from "multer";
import pkg from "pg";
import { fileURLToPath } from "url";
import { dirname } from "path";
import * as fs from "fs";
import { JSDOM } from "jsdom";
import { Document, Packer, Paragraph, TextRun } from "docx";
import crypto from "crypto";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const { Client } = pkg;
const app = express();

const serverConfig = {
  ip: {
    buhgalteriya: "192.168.13.16",
    servernaya: "192.168.0.60",
    home: "192.168.0.105",
    officeWifi: "10.10.10.211",
  },
  port: 5500,
};

const currentDEVIP = serverConfig.ip.officeWifi;

// Настройка загрузки файлов с фронта на бек
const storage = multer.diskStorage({
  destination: (_, __, callback) => {
    callback(null, "./uploads");
  },
  filename: (_, file, callback) => {
    callback(null, `${Date.now()}_${file.originalname}`);
  },
});

const upload = multer({ storage: storage, limits: { fileSize: 1e10 } });

// Настройка получения запросов с фронта на бек
app.use(express.json());

// Чтение всей директории с файлами
app.use(express.static(__dirname));

// app.use((err, req, res, next) => {
//   console.error("Произошла ошибка:", err.message);
//   res.status(500).send("Internal Server Error");
// });

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
  console.log("Открыта главная страница");
  res.sendFile(__dirname + "/index.html");
});

app.get("/incoming-mail", (req, res) => {
  res.sendFile(__dirname + "/incoming-mail.html");
});

// Запрос на сохранение данных с фронта
app.post("/save-data", async (req, res) => {
  const token = req.body.token; // Извлекаем токен из тела запроса
  console.log("Полученный токен:", token);
  console.log("Данные для генерации документа:", req.body);

  if (!token) {
    console.error("Токен отсутствует");
    return res.status(403).send("Token is missing.");
  }

  try {
    // Проверка токена в базе данных
    const isValid = await validateToken(token);
    if (!isValid) {
      console.error("Недействительный или просроченный токен");
      return res.status(403).send("Invalid or expired token.");
    }

    // Дальнейшая обработка данных
    await setDataToBase(req.body); // Сохранение данных в базу
    const filename = convertDataToDocx(req.body, token); // Генерация документа
    res.send({ DB: true, Docx: true, filename });
  } catch (error) {
    console.error("Ошибка при обработке запроса /save-data:", error.message);
    res.status(500).send("Internal Server Error");
  }
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

app.post("/download", async (req, res) => {
  const { filename, token } = req.body;

  if (!filename || !token) {
    console.error("Имя файла или токен отсутствуют");
    return res.status(400).send("Filename and token are required.");
  }

  // Проверка токена в базе данных
  try {
    const isValid = await validateToken(token);
    if (!isValid) {
      console.error("Недействительный или просроченный токен");
      return res.status(403).send("Invalid or expired token.");
    }
  } catch (error) {
    console.error("Ошибка при проверке токена:", error.message);
    return res.status(500).send("Internal Server Error");
  }

  const filePath = path.join(__dirname, "docs", filename);

  if (!fs.existsSync(filePath)) {
    console.error("Файл не найден:", filePath);
    return res.status(404).send("File not found.");
  }

  res.sendFile(filePath, (err) => {
    if (err) {
      console.error("Ошибка при отправке файла:", err.message);
      res.status(500).send("Error sending file.");
    }
  });
});

app.get("/generate-token", async (req, res) => {
  const username = req.query.username || "guest"; // Получить имя пользователя
  try {
    const token = await generateTokenForUser(username);
    res.json({ token });
  } catch (error) {
    res.status(500).send("Failed to generate token.");
  }
});

async function generateTokenForUser(username) {
  const token = crypto.randomBytes(16).toString("hex");
  return await saveTokenToDatabase(username, token);
}

// Конвертация данных с фронта в DocX документ
function parseHtmlToDocxChildren(html) {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const children = [];

  function processNode(node) {
    if (node.nodeType === 3 && node.textContent.trim()) {
      // Текстовый узел
      return new TextRun({ text: node.textContent.trim() });
    }

    if (node.nodeName === "B") {
      // Жирный текст
      return new TextRun({ text: node.textContent.trim(), bold: true });
    }

    if (node.nodeName === "I") {
      // Курсивный текст
      return new TextRun({ text: node.textContent.trim(), italics: true });
    }

    if (node.nodeName === "P") {
      // Абзацы
      const paragraphChildren = Array.from(node.childNodes).map(processNode).filter(Boolean);
      return new Paragraph({ children: paragraphChildren });
    }

    if (node.nodeName === "UL" || node.nodeName === "OL") {
      // Списки
      const isBullet = node.nodeName === "UL";
      return Array.from(node.childNodes)
        .filter((li) => li.nodeName === "LI")
        .map(
          (li) =>
            new Paragraph({
              text: li.textContent.trim(),
              bullet: isBullet ? { level: 0 } : undefined,
              numbering: !isBullet ? { reference: "numbering", level: 0 } : undefined,
            })
        );
    }

    if (node.nodeName === "BLOCKQUOTE") {
      // Цитаты
      return new Paragraph({
        text: node.textContent.trim(),
        style: "Quote",
      });
    }

    return null; // Игнорируем другие типы узлов
  }

  document.body.childNodes.forEach((node) => {
    const processedNode = processNode(node);
    if (processedNode) {
      if (Array.isArray(processedNode)) {
        children.push(...processedNode); // Для списков возвращается массив
      } else {
        children.push(processedNode);
      }
    }
  });

  console.log("Сформированные элементы для docx:", children);
  return children;
}

function convertDataToDocx(data, token) {
  const sender = data.companySender;
  const receiver = data.companyReceiver || "Не указан";
  const receiverName = data.receiverName;
  const theme = data.letterTheme;
  const letterHTML = data.letterText;
  const user = data.currentUser;
  const date = data.dateField;

  try {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: `Sender: ${sender}`, bold: true }),
                new TextRun(`\nReceiver: ${receiver}`),
                new TextRun(`\nTheme: ${theme}`),
                new TextRun(`\nDate: ${date}`),
              ],
            }),
            ...parseHtmlToDocxChildren(letterHTML),
          ],
        },
      ],
    });

    const filename = `document_${token}.docx`;
    const outputPath = path.join(__dirname, "docs", filename);
    Packer.toBuffer(doc)
      .then((buffer) => {
        fs.writeFileSync(outputPath, buffer);
        console.log("Document created successfully at:", outputPath);
      })
      .catch((err) => {
        throw new Error("Error generating document buffer: " + err.message);
      });

    return filename;
  } catch (error) {
    console.error("Error generating document:", error.message);
    throw error;
  }
}

//PostgreSQL connection
const client = new Client({
  host: currentDEVIP,
  port: 5501,
  database: "postgres",
  user: "postgres",
  password: "Es12345678",
});
await client.connect();

// Запись данных письма в базу
async function setDataToBase(data) {
  const lastId = await getCurrentLastId();
  const newId = Number(lastId.rows[0].max) + 1;
  const sql = `
    INSERT INTO "post" ("id", "sender", "receiver", "date", "text", "user", "theme")
    VALUES ($1, $2, $3, $4, $5, $6, $7)
`;
  const values = [newId, data.companySender, data.companyReciever, data.dateField, data.letterText, data.currentUser, data.letterTheme];
  return client.query(sql, values);
}

async function saveTokenToDatabase(username, token) {
  try {
    const sql = `
            INSERT INTO "user_tokens" ("token", "username", "created_at")
            VALUES ($1, $2, NOW())
            ON CONFLICT ("username") DO UPDATE 
            SET "token" = $1, "created_at" = NOW();
        `;
    await client.query(sql, [token, username]);
    return token;
  } catch (error) {
    console.error("Error saving token to database:", error);
    throw new Error("Failed to save token");
  }
}

async function validateToken(token) {
  try {
    const sql = `SELECT * FROM "user_tokens" WHERE "token" = $1`;
    const result = await client.query(sql, [token]);
    return result.rows.length > 0;
  } catch (error) {
    console.error("Ошибка при проверке токена:", error.message);
    throw new Error("Failed to validate token.");
  }
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
