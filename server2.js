import express, { text } from "express";
import multer from "multer";
import pkg from "pg";
import { fileURLToPath } from "url";
import { dirname } from "path";
import * as fs from "fs";
import { JSDOM } from "jsdom";
import htmlEntities from "html-entities"
import crypto from "crypto";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import ImageModule from "docxtemplater-image-module";

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

    // Сохранение данных в базу
    await setDataToBase(req.body);

    // Подготовка данных для генерации документа
    const data = {
      // htmlText: req.body.letterText || "<p>Нет данных</p>",
      staticFields: {
        patch_number: String(await getCurrentLastId()),
        patch_date: req.body.dateField,
        patch_receiverCompany: req.body.companyReceiver,
        patch_receiverName: req.body.receiverName,
        patch_title: req.body.letterTheme,
        patch_text: req.body.letterText,
      },
    };

    // Генерация документа
    const templatePath = path.join(__dirname, "templates", "sse.docx");
    const outputPath = path.join(__dirname, "docs", `document_${token}.docx`);

    await generateDynamicContent(templatePath, outputPath, data);

    res.send({ DB: true, Docx: true, filename: `document_${token}.docx` });
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
function htmlToDocxNodes(html) {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const nodes = [];

  document.body.childNodes.forEach((node) => {
    if (node.nodeName === "P") {
      // Обработка параграфов
      nodes.push({
        type: "paragraph",
        text: htmlEntities.decode(node.textContent.trim()), // Декодируем HTML-символы
        bold: node.querySelector("strong") !== null, // Проверяем наличие <strong>
        alignment: node.style.textAlign || "left", // Учитываем выравнивание
      });
    } else if (node.nodeName === "UL" || node.nodeName === "OL") {
      // Обработка списков
      node.childNodes.forEach((li) => {
        if (li.nodeName === "LI") {
          nodes.push({
            type: "list",
            text: htmlEntities.decode(li.textContent.trim()),
            bullet: node.nodeName === "UL", // Если UL — маркированный список
            numbering: node.nodeName === "OL", // Если OL — нумерованный список
          });
        }
      });
    } else if (node.nodeName === "IMG") {
      // Обработка изображений
      nodes.push({
        type: "image",
        src: node.getAttribute("src"),
      });
    }
  });

  return nodes;
}

async function generateDynamicContent(templatePath, outputPath, data) {
  const content = fs.readFileSync(templatePath, "binary");
  const zip = new PizZip(content);

  const imageOptions = {
    getImage: (tagValue) => {
      return fs.readFileSync(path.resolve(__dirname, "images", tagValue));
    },
    getSize: () => [200, 200],
  };

  const doc = new Docxtemplater(zip, {
    delimiters: { start: "{{", end: "}}" },
    paragraphLoop: true,
    linebreaks: true,
    modules: [new ImageModule(imageOptions)],
  });

  const htmlContent = htmlToDocxNodes(data.htmlText);

  const processedContent = htmlContent.map((node) => {
    if (node.type === "paragraph") {
      return {
        text: node.text,
        bold: node.bold || false,
        alignment: node.alignment || "left",
      };
    } else if (node.type === "list") {
      return {
        text: node.text,
        bullet: node.bullet || false,
        numbering: node.numbering || false,
      };
    } else if (node.type === "image") {
      return { src: node.src };
    }
    return null;
  })

  doc.setData({
    content: processedContent,
    ...data.staticFields,
  });

  try {
    doc.render();
    const buffer = doc.getZip().generate({ type: "nodebuffer" });
    fs.writeFileSync(outputPath, buffer);
    console.log("Документ успешно создан:", outputPath);
  } catch (error) {
    console.error("Ошибка генерации документа:", error);
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
  try {
    // Получение текущего максимального ID
    const lastIdResult = await client.query('SELECT MAX(id) AS max FROM "post"');

    const lastId = lastIdResult.rows[0]?.max || 0; // Если таблица пуста, используем 0
    const newId = Number(lastId) + 1;

    // Вставка данных в таблицу
    const sql = `
      INSERT INTO "post" (id, sender, receiver, date, text, "user", theme)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    const values = [newId, data.companySender, data.companyReceiver, data.dateField, data.letterText, data.currentUser, data.letterTheme];

    await client.query(sql, values);
  } catch (error) {
    console.error("Ошибка при сохранении данных в БД:", error.message);
    throw error;
  }
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
  const result = await client.query(sql);
  return result.rows[0].max;
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
