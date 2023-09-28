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

const pageURL = document.location.pathname;
const form = document.querySelector(".registration");
const formInputs = form.querySelectorAll(".input");
const formButton = form.querySelector(".button");
const inputDateWrapper = form.querySelector(".input__date").parentElement;
const inputDate = inputDateWrapper.querySelector(".input__date");
const inputDateEditBtn = inputDateWrapper.querySelector(".input__edit");
const formFields = form.querySelectorAll(".input");
const formData = [];
const allPopups = document.querySelectorAll(".popup");
const loginForm = document.querySelector(".login__form");
const popupLogin = document.querySelector("#popup-login");
const loginInput = loginForm.querySelector("#login");
const passwordInput = loginForm.querySelector("#password");
const loginButton = loginForm.querySelector("#login-button");
const reLoginButton = document.querySelector("#reLogin");
const checkPopup = document.querySelector("#popup-check");
const sender = checkPopup.querySelector(".preview__sender-value");
const reciever = checkPopup.querySelector(".preview__reciever-value");
const recieverName = checkPopup.querySelector(".preview__name-value");
const theme = checkPopup.querySelector(".preview__theme-value");
const letterText = checkPopup.querySelector(".preview__text");
const letterDate = checkPopup.querySelector(".preview__date-value");
const changeLetterButton = checkPopup.querySelector("#changeLetter");
const saveLetterButton = checkPopup.querySelector("#saveLetter");

form.addEventListener("submit", handlerFormSubmit);
form.addEventListener("input", checkEmptyInputs);
inputDateEditBtn.addEventListener("click", editDate);
loginForm.addEventListener("submit", handlerLogin);
reLoginButton.addEventListener("click", logOut);
changeLetterButton.addEventListener("click", () => {
  closePopup(checkPopup);
});
saveLetterButton.addEventListener("click", saveData);

function handlerFormSubmit(evt) {
  evt.preventDefault();
  const data = new Object();

  formFields.forEach((field) => {
    data[field.id] = field.value;
  });
  data.currentUser = JSON.parse(localStorage.getItem("currentUser")).login;

  checkDataPopup(data);
  saveLetterCopy(data);
}

function saveLetterCopy(data) {
  if (localStorage.getItem("previousLetter")) {
    localStorage.removeItem("previousLetter");
    localStorage.setItem("previousLetter", JSON.stringify(data));
  } else {
    localStorage.setItem("previousLetter", JSON.stringify(data));
  }
}

function saveData() {
  const data = localStorage.getItem("previousLetter");

  fetch(`http://localhost:3000/save-data`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=utf-8",
    },
    body: data,
  })
    .then(checkResponse)
    .catch((err) => {
      console.log(err);
    })
    .finally(() => {
      closePopup(checkPopup);
    });
}

const checkResponse = (res) => {
  if (res.ok) {
    return res.json();
  }
  return Promise.reject(`Ошибка: ${res.status}`);
};

function checkDataPopup(data) {
  sender.textContent = data.companySender;
  reciever.textContent = data.companyReciever;
  recieverName.textContent = data.recieverName;
  theme.textContent = data.letterTheme;
  letterText.textContent = data.letterText;

  const prerpareDate = data.dateField.split("-");

  letterDate.textContent = `${prerpareDate[2]}.${prerpareDate[1]}.${prerpareDate[0]}`;
  openPopup(checkPopup);
}

function cleanPopup() {
  sender.textContent = "";
  reciever.textContent = "";
  recieverName.textContent = "";
  theme.textContent = "";
  letterText.textContent = "";
  letterDate.textContent = "";
}

function checkEmptyInputs() {
  for (let i = 0; i < formInputs.length; i++) {
    formData[i] = formInputs[i].value;
  }
  const emptyField = formData.find((elem) => {
    return elem === "";
  });
  if (emptyField !== undefined) {
    formButton.classList.add("button_disabled");
  } else {
    formButton.classList.remove("button_disabled");
  }
}

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

function editDate() {
  inputDate.classList.remove("input__date_disabled");
  inputDate.classList.add("input__date_active");
  inputDateEditBtn.classList.add("input__edit_hidden");
  inputDate.click();
}

function checkUser() {
  if (!JSON.parse(localStorage.getItem("currentUser")).isAdmin) {
    blockUserFunctions();
  }
}

function blockUserFunctions() {
  inputDate.classList.add("input__date_disabled");
  inputDateEditBtn.classList.add("input__edit_hidden");
}

function checkLogin() {
  if (localStorage.getItem("currentUser")) {
    localData = JSON.parse(localStorage.getItem("currentUser"));
    closePopup(popupLogin);
    checkUser();
  } else {
    openPopup(popupLogin);
  }
}

function handlerLogin(evt) {
  evt.preventDefault();
  // 1. reading login and password
  const login = loginInput.value;
  const password = passwordInput.value;

  // 2. check in DB
  // 2.1 if error - show error

  // 3. Res from DB
  logins = Object.keys(users);

  // 4. Check user rules (shuld be without cycle)
  for (i = 0; i < logins.length; i++) {
    if (login === logins[i]) {
      if (password === users[logins[i]].password) {
        const currentUser = {
          login: login,
          isAdmin: users[logins[i]].isAdmin,
        };
        localStorage.setItem("currentUser", JSON.stringify(currentUser));
        debugger;
        reLoginButton.textContent = currentUser.login;
        closePopup(popupLogin);
        checkUser();
        return;
      }
    }
  }
  loginInput.classList.add("input__error");
  passwordInput.classList.add("input__error");
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
    const openedPopUp = document.querySelector(".popup_opened");
    closePopup(openedPopUp);
  }
}

function logOut() {
  localStorage.removeItem("currentUser");
  location.reload();
}

checkLogin();
setDateToInput();
