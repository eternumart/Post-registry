const pageURL = document.location.pathname;
const form = document.querySelector(".registration");
const formInputs = form.querySelectorAll(".input");
const formButton = form.querySelector(".button");
const inputDateWrapper = form.querySelector(".input__date").parentElement;
const inputDate = inputDateWrapper.querySelector(".input__date");
const inputDateEditBtn = inputDateWrapper.querySelector(".input__edit");
const formFields = form.querySelectorAll(".input");
const companySender = form.querySelector("#companySender");
const formData = [];
const allPopups = document.querySelectorAll(".popup");
const loginForm = document.querySelector(".login__form");
const popupLogin = document.querySelector("#popup-login");
const loginInput = loginForm.querySelector("#login");
const eMailError = loginForm.querySelector("#emailError");
const passwordInput = loginForm.querySelector("#password");
const passwordError = loginForm.querySelector("#passwordError");
const loginButton = loginForm.querySelector("#login-button");
const reLoginButton = document.querySelector("#reLogin");
const checkPopup = document.querySelector("#popup-check");
const sender = checkPopup.querySelector(".preview__sender-value");
const reciever = checkPopup.querySelector(".preview__reciever-value");
const recieverName = checkPopup.querySelector(".preview__name-value");
const theme = checkPopup.querySelector(".preview__theme-value");
const letterText = checkPopup.querySelector(".preview__text");
const editorInstance = CKEDITOR.instances["letterText"];
const letterDate = checkPopup.querySelector(".preview__date-value");
const changeLetterButton = checkPopup.querySelector("#changeLetter");
const saveLetterButton = checkPopup.querySelector("#saveLetter");
const saveLetterError = checkPopup.querySelector(".preview__error");
const downloadLetterButton = checkPopup.querySelector("#downloadLetter");

// Конфиг для запросов на бек
const fetchConfig = {
  address: {
    protocol: "http://",
    host: `${document.location.hostname}`,
    port: `:${document.location.port}`,
  },
  methods: {
    post: "POST",
    get: "GET",
  },
  addresses: {
    saveData: "/save-data",
    getLogin: "/get-login",
    download: "/download",
  },
  contentTypes: {
    json: "application/json;charset=utf-8",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
};

// Тексты ошибок для валидации
const errors = {
  email: {
    empty: "Поле не должно быть пустым",
    notEmail: "E-mail должен содержать @",
    wrongDomain: "E-mail должен оканчиваться на .ru",
    wrongEmail: "Не верное имя пользователя или пароль",
  },
  password: {
    empty: "Поле не должно быть пустым",
    wrongPassword: "Не верное имя пользователя или пароль",
  },
};

//Обработчики событий

form.addEventListener("submit", handlerFormSubmit);
form.addEventListener("input", checkEmptyInputs);
inputDateEditBtn.addEventListener("click", editDate);
loginForm.addEventListener("submit", handlerLogin);
reLoginButton.addEventListener("click", logOut);
changeLetterButton.addEventListener("click", () => {
  closePopup(checkPopup);
});
saveLetterButton.addEventListener("click", async () => {
  const token = sessionStorage.getItem("sessionToken");
  const data = JSON.parse(localStorage.getItem("previousLetter")) || {};
  data.token = token;
  console.log("Отправляемые данные:", data);
  console.log("URL:", `${fetchConfig.address.protocol}${fetchConfig.address.host}${fetchConfig.address.port}${fetchConfig.addresses.saveData}`);
  console.log("Метод:", fetchConfig.methods.post);
  console.log("Content-Type:", fetchConfig.contentTypes.json);

  sendData(data, fetchConfig.addresses.saveData, fetchConfig.methods.post, fetchConfig.contentTypes.json);
});
downloadLetterButton.addEventListener("click", () => {
  const token = sessionStorage.getItem("sessionToken");
  const fileName = `document_${token}`;
  downloadLetter(fetchConfig.addresses.download, fileName, token);
});
// Привязка функции к событиям
form.addEventListener("input", checkEmptyInputs);
if (editorInstance) {
  editorInstance.on("change", checkEmptyInputs);
}

async function fetchToken() {
  const response = await fetch("/generate-token?username=guest"); // Replace 'guest' with actual user info
  const data = await response.json();
  sessionStorage.setItem("sessionToken", data.token);
}

// Fetch token on page load
window.onload = fetchToken;


// Сбор данных из полей для ввода
function handlerFormSubmit(evt) {
  evt.preventDefault();

  const data = {};

  formFields.forEach((field) => {
    if (field.id === "letterText") {
      // CKEditor берет данные вместо этого поля
      const editorContent = editorInstance ? editorInstance.getData().trim() : "";
      data[field.id] = editorContent || "<p>Нет данных</p>";
    } else {
      data[field.id] = field.value;
    }
  });

  data.currentUser = JSON.parse(localStorage.getItem("currentUser")).login;

  checkDataPopup(data);
  saveLetterCopy(data);
}

// Смена кнопки "сохранить" на кнопку "скачать" и обратно
function changeCheckPopupButtons() {
  saveLetterButton.parentElement.classList.toggle("preview__error-wrapper_hidden");
  downloadLetterButton.parentElement.classList.toggle("preview__error-wrapper_hidden");
}

// Сохранение копии письма в браузер для передачи на бек
function saveLetterCopy(data) {
  if (localStorage.getItem("previousLetter")) {
    localStorage.removeItem("previousLetter");
    localStorage.setItem("previousLetter", JSON.stringify(data));
  } else {
    localStorage.setItem("previousLetter", JSON.stringify(data));
  }
}

// Запрос docx файла с бека и обработка байтных данных
async function downloadLetter(way, token) {
  await fetch(`${fetchConfig.address.protocol}${fetchConfig.address.host}${fetchConfig.address.port}${way}?token=${token}`, {
    method: fetchConfig.methods.get,
  })
    .then(checkResponse)
    .then((res) => res.blob())
    .then((res) => URL.createObjectURL(res))
    .then((res) => saveByteArray(res));
}

// Скачивание docx файла на фронте
function saveByteArray(objectURL) {
  const a = document.createElement("a");
  a.setAttribute("href", objectURL);
  a.setAttribute("download", `document_${timestamp}.docx`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectURL);
}

// Отправка данных на бекенд (логин, запросы, сохранения)
async function sendData(data, way, method, contentType) {
  await fetch(`${fetchConfig.address.protocol}${fetchConfig.address.host}${fetchConfig.address.port}${way}`, {
    method: method,
    headers: {
      "Content-Type": contentType,
    },
    body: contentType === "application/json" ? JSON.stringify(data) : data,
  })
    .then(checkResponse)
    .catch((err) => {
      console.error("Ошибка при отправке данных:", err);
      if (way === fetchConfig.addresses.saveData && checkPopup.classList.contains("popup_visible")) {
        saveLetterError.classList.add("preview__error_visible");
      }
    })
    .then((res) => {
      return res.json();
    })
    .then((res) => {
      console.log("Ответ от сервера:", res);
      final(res, way);
    });
}

// Проверка ответов сервера
function checkResponse(res) {
  if (res.ok) {
    return res;
  }
  return Promise.reject(`Ошибка: ${res.status}`);
}

// Финальная обработка полученных с бека данных на фронте
function final(res, way) {
  if ((way = fetchConfig.addresses.saveData) && checkPopup.classList.contains("popup_visible")) {
    saveLetterError.classList.remove("preview__error_visible");
    changeCheckPopupButtons();
  }
  if ((way = fetchConfig.addresses.getLogin)) {
    if (!res.loginIsPossible) {
      loginInput.classList.add("input__error");
      passwordInput.classList.add("input__error");
      eMailError.textContent = errors.email.wrongEmail;
      passwordError.textContent = errors.password.wrongPassword;
      return;
    }
    const currentUser = {
      login: res.username,
      isAdmin: res.isAdmin,
    };
    localStorage.setItem("currentUser", JSON.stringify(currentUser));
  }
}

// Заполнение попапа "проверки" письма перед сохранением
function checkDataPopup(data) {
  const prerpareDate = data.dateField.split("-");

  // Установка текста в элементы попапа
  sender.textContent = data.companySender;
  reciever.textContent = data.companyReciever;
  recieverName.textContent = data.recieverName;
  theme.textContent = data.letterTheme;

  // Вставка HTML из CKEditor в попап
  letterText.innerHTML = data.letterText;

  // Установка даты
  letterDate.textContent = `${prerpareDate[2]}.${prerpareDate[1]}.${prerpareDate[0]}`;
  saveLetterError.classList.remove("preview__error_visible");
  openPopup(checkPopup);
}

// Очистка попапа "проверки" письма после сохранения
function cleanPopup() {
  const paragraphs = letterText.querySelectorAll(".preview__paragraph");
  sender.textContent = "";
  reciever.textContent = "";
  recieverName.textContent = "";
  theme.textContent = "";
  letterDate.textContent = "";

  paragraphs.forEach((p) => {
    p.remove();
  });
}

// Проверка на незаполненность полей
function checkEmptyInputs() {
  // Обновление данных для обычных полей
  for (let i = 0; i < formInputs.length; i++) {
    const input = formInputs[i];

    // Игнорируем скрытое поле CKEditor
    if (input.classList.contains("input__textarea")) continue;

    formData[i] = input.value.trim();
  }
  // Добавляем данные из CKEditor в formData
  const editorContent = editorInstance ? editorInstance.getData().trim() : "";

  formData[formInputs.length] = editorContent; // Добавляем CKEditor как последний элемент

  // Проверка на пустые поля
  const emptyField = formData.find((elem) => elem === "");

  // Управление состоянием кнопки
  if (emptyField === "") {
    formButton.classList.add("button_disabled");
  } else {
    formButton.classList.remove("button_disabled");
  }
}

// Установка текущей даты в инпут с датой
function setDateToInput() {
  const date = new Date();
  let currentDay = date.getDate();
  let currentMonth = date.getMonth() + 1;
  const currentYear = date.getFullYear();
  if (currentDay < 10) {
    currentDay = `0${currentDay}`;
  }
  if (currentMonth < 10) {
    currentMonth = `0${currentMonth}`;
  }
  const currentDate = `${currentYear}-${currentMonth}-${currentDay}`;
  inputDate.value = currentDate;
}

// Открытие возможности редактирования даты для админа
function editDate() {
  inputDate.classList.remove("input__date_disabled");
  inputDate.classList.add("input__date_active");
  inputDateEditBtn.classList.add("input__edit_hidden");
  inputDate.click();
}

// Проверка пользователя на админские права
function checkUser() {
  if (!JSON.parse(localStorage.getItem("currentUser")).isAdmin) {
    blockUserFunctions();
  }
}

// Блокировка функций для не админа
function blockUserFunctions() {
  inputDate.classList.add("input__date_disabled");
  inputDateEditBtn.classList.add("input__edit_hidden");
}

// Проверка на прошлые залогинивания
function checkLogin() {
  if (localStorage.getItem("currentUser")) {
    const localData = JSON.parse(localStorage.getItem("currentUser"));
    reLoginButton.textContent = localData.login;
    checkUser();
  } else {
    openPopup(popupLogin);
  }
}

// Авторизация
async function handlerLogin(evt) {
  if (!popupLogin.classList.contains("popup_visible")) {
    return;
  }
  evt.preventDefault();
  // 1. reading login and password
  const userData = {
    username: loginInput.value,
    password: passwordInput.value,
  };
  // 1.1 launch validation
  if (!loginValidation()) {
    return;
  }

  // 2. check in DB
  await sendData(userData, fetchConfig.addresses.getLogin, fetchConfig.methods.post, fetchConfig.contentTypes.json);

  // 3. Res from DB through LocalStorage
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));

  // 4. Check user rules
  reLoginButton.textContent = currentUser.login;
  closePopup(popupLogin);
  checkUser();
  return;
}

function openPopup(currentPopup) {
  currentPopup.classList.add("popup_visible");
  window.addEventListener("keydown", closeByEscape);
}

function closePopup(currentPopup) {
  currentPopup.classList.remove("popup_visible");
  window.removeEventListener("keydown", closeByEscape);
  if (currentPopup === checkPopup) {
    setTimeout(cleanPopup, 500);
  }
}

function closePopupByOverlay(evt) {
  if (evt.type === "click") {
    if (evt.target === evt.currentTarget) {
      closePopup(evt.target);
    }
  }
}

function closeByEscape(event) {
  if (event.key === "Escape") {
    const openedPopUp = document.querySelector(".popup_visible");
    closePopup(openedPopUp);
  }
}

// Выход из профиля
function logOut() {
  localStorage.removeItem("currentUser");
  location.reload();
}

// Валидация полей авторизации
function loginValidation() {
  loginInput.addEventListener("input", loginValidation);
  passwordInput.addEventListener("input", loginValidation);
  const eMail = loginInput.value;
  const password = passwordInput.value;
  let validationOk = true;
  const prepareEmail = eMail.split("@");
  if (eMail === "") {
    loginInput.classList.add("input__error");
    eMailError.textContent = errors.email.empty;
    validationOk = false;
  } else {
    loginInput.classList.remove("input__error");
    validationOk = true;
    eMailError.textContent = "";
  }
  if (prepareEmail[0] === eMail) {
    loginInput.classList.add("input__error");
    eMailError.textContent = errors.email.notEmail;
    validationOk = false;
  } else {
    const prepareEmailDomain = prepareEmail[1].split(".");
    if (prepareEmailDomain.length < 1 || prepareEmailDomain[1] !== "ru") {
      eMailError.textContent = errors.email.wrongDomain;
    } else {
      loginInput.classList.remove("input__error");
      validationOk = true;
      eMailError.textContent = "";
    }
  }
  if (password === "") {
    passwordInput.classList.add("input__error");
    passwordError.textContent = errors.password.empty;
    validationOk = false;
  } else {
    passwordInput.classList.remove("input__error");
    validationOk = true;
    passwordError.textContent = "";
  }

  return validationOk;
}

// Проверяем пользоваателя на админа и устанавливаем текущую дату в инпут при инициализации
checkLogin();
setDateToInput();
