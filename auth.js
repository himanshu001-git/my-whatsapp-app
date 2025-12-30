// ================= SIGNUP =================
async function signup() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (!email || !password) {
    alert("All fields required");
    return;
  }

  const res = await fetch("http://localhost:5000/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (res.ok) {
    alert(data.message);
    window.location.href = "home.html";
  } else {
    alert(data.message);
  }
}

// ================= LOGIN =================
async function login() {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  const res = await fetch("http://localhost:5000/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (res.ok) {
    localStorage.setItem("token", data.token);
    window.location.href = "http://127.0.0.1:5500/dashboard.html";

  } else {
    alert(data.message);
  }
}

// ================= LOAD PROFILE (PROTECTED) =================
async function loadProfile() {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "home.html";
    return;
  }

  try {
    const res = await fetch("http://localhost:5000/profile", {
      headers: {
        Authorization: "Bearer " + token
      }
    });

    if (!res.ok) throw new Error("Unauthorized");

    const data = await res.json();
    document.getElementById("profileInfo").innerText =
      "Logged in as: " + data.email;

  } catch {
    localStorage.removeItem("token");
    window.location.href = "home.html";
  }
}

// ================= LOGOUT =================
function logout() {
  localStorage.removeItem("token");
  window.location.href = "home.html";
}
