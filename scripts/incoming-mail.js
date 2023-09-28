const currentUser = {
  login: "",
  isAdmin: undefined,
};

const users = {
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
const companyReciever = form.querySelector("#company-reciever");
const companySender = form.querySelector("#company-sender");
const fileInput = form.querySelector(".input_download");
const formData = [];
const allPopups = document.querySelectorAll(".popup");
const loginForm = document.querySelector(".login__form");
const reLoginButton = document.querySelector("#reLogin");

window.addEventListener("DOMContentLoaded", () => {
  checkLogin();
  checkUser();
  setDateToInput();
});
form.addEventListener("submit", handlerFormSubmit);
form.addEventListener("input", checkEmptyInputs);
inputDateEditBtn.addEventListener("click", editDate);
reLoginButton.addEventListener("click", logOut);

function handlerFormSubmit(evt) {
  evt.preventDefault();
  const data = new FormData();
  data.append("scan", fileInput.files[0]);
  data.append("company-sender", companySender.value);
  data.append("company-reciever", companyReciever.value);
  data.append("date", inputDate.value);
  data.append("currentUser", currentUser.login);

  console.log(data);
  return data;
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
  if (!currentUser.isAdmin) {
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
    currentUser.login = localData.login;
    currentUser.isAdmin = localData.isAdmin;
  } else {
    location.replace("/");
  }
}

function handlerLogin(evt) {
  evt.preventDefault();
  login = loginInput.value;
  password = passwordInput.value;
  logins = Object.keys(users);

  for (i = 0; i < logins.length; i++) {
    if (login === logins[i]) {
      if (password === users[logins[i]].password) {
        currentUser.login = login;
        currentUser.isAdmin = users[logins[i]].isAdmin;
        localStorage.setItem("currentUser", JSON.stringify(currentUser));
        closePopup(popupLogin);
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
  location.replace("/");
}
