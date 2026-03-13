import api from "../services/api";

export const registerUser = async (data) => {

  const res = await api.post("/auth/register", data);

  return res.data;
};

export const loginUser = async (data) => {

  const res = await api.post("/auth/login", data);

  localStorage.setItem("token", res.data.access_token);
  localStorage.setItem("role", res.data.role);
  localStorage.setItem("username", res.data.username);

  return res.data;
};

export const logoutUser = () => {

  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("username");

};